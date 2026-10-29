const env = require('../config/env');
const { query, transaction } = require('../config/db');
const { ApiError, asyncHandler, ok, created, paginate, pageMeta } = require('../utils/http');
const { audit } = require('../utils/audit');
const { notifyAdmins } = require('../utils/notify');

/** Vehicles this driver currently has an ACTIVE assignment for. */
async function assignedVehicleIds(driverId) {
  const rows = await query('SELECT DISTINCT vehicle_id FROM vehicle_assignments WHERE driver_id = ? AND is_active = 1', [driverId]);
  return rows.map((r) => r.vehicle_id);
}

async function assertAssigned(driverId, vehicleId) {
  const ids = await assignedVehicleIds(driverId);
  if (!ids.includes(Number(vehicleId))) {
    // Same response whether the vehicle exists or not.
    throw ApiError.forbidden('This vehicle is not assigned to you.');
  }
}

const ASSIGNMENT_SQL = `
  SELECT va.id, va.start_date, va.end_date, va.is_active, va.notes, va.created_at,
         v.id AS vehicle_id, v.identifier AS vehicle_identifier, v.status AS vehicle_status, vt.code AS vehicle_type,
         r.id AS route_id, r.code AS route_code, r.name AS route_name, r.origin, r.destination,
         t.id AS terminal_id, t.name AS terminal_name
    FROM vehicle_assignments va
    JOIN vehicles v ON v.id = va.vehicle_id
    JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    LEFT JOIN routes r ON r.id = va.route_id
    LEFT JOIN terminals t ON t.id = va.terminal_id
   WHERE va.driver_id = ?`;

/* Profile (also usable while approval is pending) */
exports.getProfile = asyncHandler(async (req, res) => {
  const [p] = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.status, u.email_verified_at, u.created_at,
            dp.contact_number, dp.operator_name, dp.association_name, dp.vehicle_details, dp.approval_status,
            dp.approval_reason, dp.reviewed_at, vt.code AS vehicle_type, vt.name AS vehicle_type_name
       FROM users u JOIN driver_profiles dp ON dp.user_id = u.id JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id
      WHERE u.id = ?`, [req.user.id]);
  ok(res, { ...p, email_verified: Boolean(p.email_verified_at) });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { full_name, contact_number, operator_name, association_name } = req.body;
  await transaction(async (conn) => {
    if (full_name) await query('UPDATE users SET full_name = ? WHERE id = ?', [full_name, req.user.id], conn);
    await query(
      'UPDATE driver_profiles SET contact_number = ?, operator_name = ?, association_name = ? WHERE user_id = ?',
      [contact_number || null, operator_name || null, association_name || null, req.user.id], conn);
  });
  await audit(req, 'driver.profile_updated', 'user', req.user.id);
  ok(res, { message: 'Profile updated.' });
});

exports.dashboard = asyncHandler(async (req, res) => {
  const [assignments, latest, [pending], [unread], recentDecisions] = await Promise.all([
    query(`${ASSIGNMENT_SQL} AND va.is_active = 1 ORDER BY va.start_date DESC`, [req.user.id]),
    query(
      `SELECT var.id, var.vehicle_id, var.status, var.note, var.reported_at, v.identifier AS vehicle_identifier,
              t.name AS terminal_name, TIMESTAMPDIFF(MINUTE, var.reported_at, NOW()) AS minutes_ago
         FROM vehicle_availability_reports var
         JOIN vehicles v ON v.id = var.vehicle_id
         LEFT JOIN terminals t ON t.id = var.terminal_id
        WHERE var.driver_id = ? ORDER BY var.id DESC LIMIT 5`, [req.user.id]),
    query("SELECT COUNT(*) AS n FROM driver_update_requests WHERE driver_id = ? AND status = 'pending'", [req.user.id]),
    query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id]),
    query(
      `SELECT id, title, status, review_notes, reviewed_at FROM driver_update_requests
        WHERE driver_id = ? AND status <> 'pending' ORDER BY reviewed_at DESC LIMIT 5`, [req.user.id]),
  ]);
  ok(res, {
    assignments,
    latest_reports: latest.map((r) => ({ ...r, is_fresh: r.minutes_ago <= env.availabilityFreshMinutes })),
    pending_update_requests: pending.n,
    unread_notifications: unread.n,
    recent_decisions: recentDecisions,
    fresh_window_minutes: env.availabilityFreshMinutes,
  });
});

exports.assignments = asyncHandler(async (req, res) => {
  const rows = await query(`${ASSIGNMENT_SQL} ORDER BY va.is_active DESC, va.start_date DESC`, [req.user.id]);
  ok(res, rows.map((r) => ({ ...r, is_active: Boolean(r.is_active) })));
});

exports.vehicles = asyncHandler(async (req, res) => {
  const ids = await assignedVehicleIds(req.user.id);
  if (!ids.length) return ok(res, []);
  const rows = await query(
    `SELECT v.id, v.identifier, v.description, v.capacity, v.color, v.status, v.is_demo, v.updated_at,
            vt.code AS vehicle_type, vt.name AS vehicle_type_name,
            (SELECT var.status FROM vehicle_availability_reports var WHERE var.vehicle_id = v.id ORDER BY var.id DESC LIMIT 1) AS latest_status,
            (SELECT var.reported_at FROM vehicle_availability_reports var WHERE var.vehicle_id = v.id ORDER BY var.id DESC LIMIT 1) AS latest_reported_at
       FROM vehicles v JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE v.id IN (?) ORDER BY v.identifier`, [ids]);
  const assignments = await query(`${ASSIGNMENT_SQL} AND va.is_active = 1`, [req.user.id]);
  ok(res, rows.map((v) => ({ ...v, is_demo: Boolean(v.is_demo), assignments: assignments.filter((a) => a.vehicle_id === v.id) })));
});

/** Drivers may edit only descriptive fields of vehicles assigned to them. Identifier/type/status are admin-only. */
exports.updateVehicle = asyncHandler(async (req, res) => {
  await assertAssigned(req.user.id, req.params.id);
  const fields = [];
  const params = [];
  for (const key of ['description', 'color', 'capacity']) {
    if (req.body[key] !== undefined) { fields.push(`${key} = ?`); params.push(req.body[key] === '' ? null : req.body[key]); }
  }
  if (!fields.length) throw ApiError.badRequest('Nothing to update.');
  await query(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`, [...params, req.params.id]);
  await audit(req, 'driver.vehicle_updated', 'vehicle', req.params.id, req.body);
  ok(res, { message: 'Vehicle information updated.' });
});

exports.reportAvailability = asyncHandler(async (req, res) => {
  const { vehicle_id, status, terminal_id, note } = req.body;
  await assertAssigned(req.user.id, vehicle_id);
  const [v] = await query('SELECT status FROM vehicles WHERE id = ?', [vehicle_id]);
  if (v.status !== 'active') throw ApiError.badRequest('This vehicle is not active. Contact the administrator.');
  if (terminal_id && !(await query("SELECT id FROM terminals WHERE id = ? AND status = 'active'", [terminal_id])).length) {
    throw ApiError.badRequest('Selected terminal does not exist.');
  }
  const r = await query(
    'INSERT INTO vehicle_availability_reports (vehicle_id, driver_id, terminal_id, status, note) VALUES (?, ?, ?, ?, ?)',
    [vehicle_id, req.user.id, terminal_id || null, status, note || null]);
  await audit(req, 'driver.availability_reported', 'vehicle', vehicle_id, { status, terminal_id: terminal_id || null });
  created(res, { id: r.insertId, message: 'Availability report saved. Commuters will see it as driver-reported information.' });
});

exports.availabilityHistory = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM vehicle_availability_reports WHERE driver_id = ?', [req.user.id]);
  const rows = await query(
    `SELECT var.id, var.status, var.note, var.reported_at, v.identifier AS vehicle_identifier, t.name AS terminal_name
       FROM vehicle_availability_reports var JOIN vehicles v ON v.id = var.vehicle_id LEFT JOIN terminals t ON t.id = var.terminal_id
      WHERE var.driver_id = ? ORDER BY var.id DESC LIMIT ? OFFSET ?`, [req.user.id, pageSize, offset]);
  ok(res, rows, pageMeta(page, pageSize, total));
});

exports.createUpdateRequest = asyncHandler(async (req, res) => {
  const { entity_type, entity_id, title, proposed_changes, reason } = req.body;
  // For fare requests, entity_id identifies the ROUTE whose fare should change.
  const tables = { route: 'routes', fare: 'routes', terminal: 'terminals', vehicle: 'vehicles' };
  if (entity_id && tables[entity_type]) {
    const exists = await query(`SELECT id FROM ${tables[entity_type]} WHERE id = ?`, [entity_id]);
    if (!exists.length) throw ApiError.badRequest('The selected record does not exist.');
  }
  if (entity_type === 'vehicle' && entity_id) await assertAssigned(req.user.id, entity_id);
  const id = await transaction(async (conn) => {
    const r = await query(
      `INSERT INTO driver_update_requests (driver_id, entity_type, entity_id, title, proposed_changes, reason)
       VALUES (?, ?, ?, ?, ?, ?)`, [req.user.id, entity_type, entity_id || null, title, proposed_changes, reason || null], conn);
    await notifyAdmins('update_request', 'New information update request',
      `${req.user.full_name} proposed a ${entity_type} update: "${title}".`, '/admin/update-requests', conn);
    return r.insertId;
  });
  await audit(req, 'driver.update_request_submitted', 'driver_update_request', id, { entity_type, entity_id });
  created(res, { id, status: 'pending', message: 'Your update request was submitted for administrator review.' });
});

exports.listUpdateRequests = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT id, entity_type, entity_id, title, proposed_changes, reason, status, review_notes, reviewed_at, created_at
       FROM driver_update_requests WHERE driver_id = ? ORDER BY created_at DESC LIMIT 100`, [req.user.id]);
  ok(res, rows);
});

/** Small option lists for driver forms (routes / terminals / fares for update requests). */
exports.options = asyncHandler(async (req, res) => {
  const [routes, terminals] = await Promise.all([
    query("SELECT id, code, name FROM routes WHERE status = 'active' ORDER BY code"),
    query("SELECT id, name FROM terminals WHERE status = 'active' ORDER BY name"),
  ]);
  ok(res, { routes, terminals });
});
