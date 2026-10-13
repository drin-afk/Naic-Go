const { query, transaction } = require('../config/db');
const { ApiError, asyncHandler, ok, created, paginate, pageMeta, likeTerm, sortClause } = require('../utils/http');
const { audit } = require('../utils/audit');
const routeService = require('../services/route.service');
const { notifyUser } = require('../utils/notify');

/** Build "col = ?" pairs for whitelisted keys present in body. */
function pick(body, keys) {
  const cols = [];
  const vals = [];
  for (const k of keys) {
    if (body[k] !== undefined) {
      cols.push(`${k} = ?`);
      let v = body[k];
      if (v === '') v = null;
      if (typeof v === 'boolean') v = v ? 1 : 0;
      vals.push(v);
    }
  }
  return { cols, vals };
}

async function getOr404(table, id, label) {
  const [row] = await query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) throw ApiError.notFound(`${label} not found.`);
  return row;
}

/* ================================ Options ================================ */

exports.options = asyncHandler(async (req, res) => {
  const [vehicleTypes, terminals, routes, vehicles, drivers, admins] = await Promise.all([
    query('SELECT id, code, name FROM vehicle_types ORDER BY id'),
    query("SELECT id, name, status FROM terminals WHERE status <> 'archived' ORDER BY name"),
    query("SELECT r.id, r.code, r.name, r.status, vt.code AS vehicle_type FROM routes r JOIN vehicle_types vt ON vt.id = r.vehicle_type_id WHERE r.status <> 'archived' ORDER BY r.code"),
    query("SELECT v.id, v.identifier, v.status, vt.code AS vehicle_type FROM vehicles v JOIN vehicle_types vt ON vt.id = v.vehicle_type_id WHERE v.status <> 'archived' ORDER BY v.identifier"),
    query(`SELECT u.id, u.full_name, u.username, vt.code AS vehicle_type FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
            JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id WHERE u.role = 'driver' AND u.status = 'active' AND dp.approval_status = 'approved' ORDER BY u.full_name`),
    query("SELECT id, full_name FROM users WHERE role = 'admin' AND status = 'active' ORDER BY full_name"),
  ]);
  ok(res, { vehicleTypes, terminals, routes, vehicles, drivers, admins });
});

/* =============================== Terminals =============================== */

const TERMINAL_FIELDS = ['name', 'address', 'barangay', 'latitude', 'longitude', 'description', 'operating_hours',
  'status', 'verification_status', 'verified_at'];

exports.listTerminals = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const where = ['1=1'];
  const params = [];
  if (req.query.q) { const l = likeTerm(req.query.q); where.push('(t.name LIKE ? OR t.address LIKE ? OR t.barangay LIKE ?)'); params.push(l, l, l); }
  if (req.query.status) { where.push('t.status = ?'); params.push(req.query.status); }
  if (req.query.verification) { where.push('t.verification_status = ?'); params.push(req.query.verification); }
  const order = sortClause(req, { name: 't.name', updated: 't.updated_at', status: 't.status' }, 'name');
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM terminals t WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT t.*, (SELECT GROUP_CONCAT(tvt.vehicle_type_id) FROM terminal_vehicle_types tvt WHERE tvt.terminal_id = t.id) AS vehicle_type_ids,
            (SELECT COUNT(*) FROM route_terminals rt WHERE rt.terminal_id = t.id) AS route_count
       FROM terminals t WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows.map((t) => ({ ...t, is_demo: Boolean(t.is_demo), vehicle_type_ids: t.vehicle_type_ids ? t.vehicle_type_ids.split(',').map(Number) : [] })),
    pageMeta(page, pageSize, total));
});

exports.createTerminal = asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.verification_status === 'verified' && (b.latitude == null || b.longitude == null)) {
    throw ApiError.badRequest('A terminal can only be marked verified when verified coordinates are provided.');
  }
  const id = await transaction(async (conn) => {
    const { cols, vals } = pick(b, TERMINAL_FIELDS);
    const r = await query(`INSERT INTO terminals SET ${cols.join(', ')}`, vals, conn);
    for (const vt of b.vehicle_type_ids || []) await query('INSERT INTO terminal_vehicle_types VALUES (?, ?)', [r.insertId, vt], conn);
    return r.insertId;
  });
  await audit(req, 'terminal.created', 'terminal', id, { name: b.name });
  created(res, { id });
});

exports.updateTerminal = asyncHandler(async (req, res) => {
  const before = await getOr404('terminals', req.params.id, 'Terminal');
  const b = req.body;
  const lat = b.latitude !== undefined ? b.latitude : before.latitude;
  const lng = b.longitude !== undefined ? b.longitude : before.longitude;
  if ((b.verification_status || before.verification_status) === 'verified' && (lat == null || lng == null)) {
    throw ApiError.badRequest('A terminal can only be marked verified when verified coordinates are provided.');
  }
  await transaction(async (conn) => {
    const { cols, vals } = pick(b, TERMINAL_FIELDS);
    if (b.verification_status === 'verified' || b.verification_status === 'unverified') cols.push('is_demo = 0');
    if (cols.length) await query(`UPDATE terminals SET ${cols.join(', ')} WHERE id = ?`, [...vals, before.id], conn);
    if (Array.isArray(b.vehicle_type_ids)) {
      await query('DELETE FROM terminal_vehicle_types WHERE terminal_id = ?', [before.id], conn);
      for (const vt of b.vehicle_type_ids) await query('INSERT INTO terminal_vehicle_types VALUES (?, ?)', [before.id, vt], conn);
    }
  });
  await audit(req, 'terminal.updated', 'terminal', before.id, { before: { name: before.name, status: before.status, latitude: before.latitude, longitude: before.longitude }, changes: b });
  ok(res, { id: before.id });
});

exports.setTerminalStatus = asyncHandler(async (req, res) => {
  const t = await getOr404('terminals', req.params.id, 'Terminal');
  const status = req.body.status;
  if (!['active', 'inactive', 'archived'].includes(status)) throw ApiError.badRequest('Invalid status.');
  await query('UPDATE terminals SET status = ? WHERE id = ?', [status, t.id]);
  await audit(req, `terminal.${status === 'active' ? 'activated' : status === 'archived' ? 'archived' : 'deactivated'}`, 'terminal', t.id, { from: t.status, to: status });
  ok(res, { id: t.id, status });
});

/* ================================= Routes ================================ */

const ROUTE_FIELDS = ['code', 'name', 'origin', 'destination', 'vehicle_type_id', 'distance_km', 'description',
  'requires_transfer', 'transfer_notes', 'status', 'verification_status', 'verified_at'];

exports.listRoutes = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const where = ['1=1'];
  const params = [];
  if (req.query.q) { const l = likeTerm(req.query.q); where.push('(r.code LIKE ? OR r.name LIKE ? OR r.origin LIKE ? OR r.destination LIKE ?)'); params.push(l, l, l, l); }
  if (req.query.status) { where.push('r.status = ?'); params.push(req.query.status); }
  if (req.query.type) { where.push('vt.code = ?'); params.push(req.query.type); }
  const order = sortClause(req, { code: 'r.code', name: 'r.name', updated: 'r.updated_at' }, 'code');
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM routes r JOIN vehicle_types vt ON vt.id = r.vehicle_type_id WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT r.*, vt.code AS vehicle_type,
            (SELECT COUNT(*) FROM route_stops s WHERE s.route_id = r.id) AS stop_count,
            (SELECT COUNT(*) FROM fares f WHERE f.route_id = r.id AND f.is_current = 1) AS current_fares
       FROM routes r JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
      WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows.map((r) => ({ ...r, is_demo: Boolean(r.is_demo), requires_transfer: Boolean(r.requires_transfer) })), pageMeta(page, pageSize, total));
});

exports.getRoute = asyncHandler(async (req, res) => {
  const [route] = await routeService.loadRoutes({ ids: [req.params.id], includeInactive: true });
  if (!route) throw ApiError.notFound('Route not found.');
  const alts = await query('SELECT alternative_route_id FROM route_alternatives WHERE route_id = ?', [route.id]);
  ok(res, { ...route, alternative_route_ids: alts.map((a) => a.alternative_route_id) });
});

async function writeRouteChildren(conn, routeId, b) {
  if (Array.isArray(b.stops)) {
    await query('DELETE FROM route_stops WHERE route_id = ?', [routeId], conn);
    let order = 1;
    for (const s of b.stops) {
      await query(
        `INSERT INTO route_stops (route_id, stop_order, name, terminal_id, latitude, longitude, is_boarding, is_dropoff, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [routeId, order++, s.name, s.terminal_id || null, s.latitude ?? null, s.longitude ?? null,
         s.is_boarding === false ? 0 : 1, s.is_dropoff === false ? 0 : 1, s.notes || null], conn);
    }
  }
  if (Array.isArray(b.terminals)) {
    await query('DELETE FROM route_terminals WHERE route_id = ?', [routeId], conn);
    const seen = new Set();
    for (const t of b.terminals) {
      if (seen.has(t.terminal_id)) continue;
      seen.add(t.terminal_id);
      await query('INSERT INTO route_terminals (route_id, terminal_id, role) VALUES (?, ?, ?)', [routeId, t.terminal_id, t.role], conn);
    }
  }
  if (Array.isArray(b.alternative_route_ids)) {
    await query('DELETE FROM route_alternatives WHERE route_id = ?', [routeId], conn);
    for (const alt of new Set(b.alternative_route_ids)) {
      if (Number(alt) === Number(routeId)) continue;
      await query('INSERT INTO route_alternatives (route_id, alternative_route_id) VALUES (?, ?)', [routeId, alt], conn);
    }
  }
}

exports.createRoute = asyncHandler(async (req, res) => {
  const b = req.body;
  const id = await transaction(async (conn) => {
    const { cols, vals } = pick(b, ROUTE_FIELDS);
    const r = await query(`INSERT INTO routes SET ${cols.join(', ')}`, vals, conn);
    await writeRouteChildren(conn, r.insertId, b);
    return r.insertId;
  });
  await audit(req, 'route.created', 'route', id, { code: b.code, name: b.name, stops: (b.stops || []).length });
  created(res, { id });
});

exports.updateRoute = asyncHandler(async (req, res) => {
  const before = await getOr404('routes', req.params.id, 'Route');
  const b = req.body;
  await transaction(async (conn) => {
    const { cols, vals } = pick(b, ROUTE_FIELDS);
    if (b.verification_status === 'verified' || b.verification_status === 'unverified') cols.push('is_demo = 0');
    if (cols.length) await query(`UPDATE routes SET ${cols.join(', ')} WHERE id = ?`, [...vals, before.id], conn);
    await writeRouteChildren(conn, before.id, b);
  });
  await audit(req, 'route.updated', 'route', before.id, {
    before: { code: before.code, name: before.name, origin: before.origin, destination: before.destination, status: before.status },
    changes: { ...b, stops: b.stops ? `${b.stops.length} stops` : undefined },
  });
  ok(res, { id: before.id });
});

exports.setRouteStatus = asyncHandler(async (req, res) => {
  const r = await getOr404('routes', req.params.id, 'Route');
  const status = req.body.status;
  if (!['active', 'inactive', 'suspended', 'archived'].includes(status)) throw ApiError.badRequest('Invalid status.');
  await query('UPDATE routes SET status = ? WHERE id = ?', [status, r.id]);
  await audit(req, 'route.status_changed', 'route', r.id, { from: r.status, to: status });
  ok(res, { id: r.id, status });
});

/* ================================= Fares ================================= */

const FARE_FIELDS = ['route_id', 'passenger_category', 'fare_type', 'amount_min', 'amount_max', 'effective_date',
  'source', 'verification_status', 'verified_at', 'is_current', 'notes'];

function normalizeFare(b) {
  const out = { ...b };
  if (out.fare_type === 'fixed') out.amount_max = out.amount_min;
  if (out.fare_type === 'requires_confirmation') { out.amount_min = null; out.amount_max = null; }
  return out;
}

exports.listFares = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 25);
  const where = ['1=1'];
  const params = [];
  if (req.query.route_id) { where.push('f.route_id = ?'); params.push(parseInt(req.query.route_id, 10) || 0); }
  if (req.query.current === 'true') where.push('f.is_current = 1');
  if (req.query.current === 'false') where.push('f.is_current = 0');
  if (req.query.verification) { where.push('f.verification_status = ?'); params.push(req.query.verification); }
  if (req.query.q) { const l = likeTerm(req.query.q); where.push('(r.code LIKE ? OR r.name LIKE ?)'); params.push(l, l); }
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM fares f JOIN routes r ON r.id = f.route_id WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT f.*, r.code AS route_code, r.name AS route_name, vt.code AS vehicle_type, u.full_name AS created_by_name,
            (f.verified_at IS NULL OR f.verified_at < DATE_SUB(CURDATE(), INTERVAL 6 MONTH)) AS needs_reverification
       FROM fares f JOIN routes r ON r.id = f.route_id JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
       LEFT JOIN users u ON u.id = f.created_by
      WHERE ${where.join(' AND ')}
      ORDER BY r.code, f.passenger_category, f.is_current DESC, f.effective_date DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows.map((f) => ({ ...f, is_current: Boolean(f.is_current), needs_reverification: Boolean(f.needs_reverification), label: routeService.fareLabel(f) })),
    pageMeta(page, pageSize, total));
});

exports.createFare = asyncHandler(async (req, res) => {
  const b = normalizeFare({ passenger_category: 'regular', is_current: true, ...req.body });
  await getOr404('routes', b.route_id, 'Route');
  const id = await transaction(async (conn) => {
    if (b.is_current) {
      // Preserve history: previous current fare for the same route/category becomes historical.
      await query('UPDATE fares SET is_current = 0 WHERE route_id = ? AND passenger_category = ? AND is_current = 1',
        [b.route_id, b.passenger_category], conn);
    }
    const { cols, vals } = pick(b, FARE_FIELDS);
    cols.push('created_by = ?'); vals.push(req.user.id);
    const r = await query(`INSERT INTO fares SET ${cols.join(', ')}`, vals, conn);
    return r.insertId;
  });
  await audit(req, 'fare.created', 'fare', id, { route_id: b.route_id, category: b.passenger_category, type: b.fare_type, min: b.amount_min, max: b.amount_max });
  created(res, { id });
});

exports.updateFare = asyncHandler(async (req, res) => {
  const before = await getOr404('fares', req.params.id, 'Fare');
  const b = normalizeFare({ ...req.body, fare_type: req.body.fare_type || before.fare_type });
  await transaction(async (conn) => {
    if (b.is_current === true) {
      await query('UPDATE fares SET is_current = 0 WHERE route_id = ? AND passenger_category = ? AND id <> ?',
        [before.route_id, b.passenger_category || before.passenger_category, before.id], conn);
    }
    const { cols, vals } = pick(b, FARE_FIELDS.filter((f) => f !== 'route_id'));
    if (cols.length) await query(`UPDATE fares SET ${cols.join(', ')} WHERE id = ?`, [...vals, before.id], conn);
  });
  await audit(req, 'fare.updated', 'fare', before.id, {
    before: { type: before.fare_type, min: before.amount_min, max: before.amount_max, is_current: before.is_current },
    after: { type: b.fare_type, min: b.amount_min, max: b.amount_max, is_current: b.is_current },
  });
  ok(res, { id: before.id });
});

/* ================================ Vehicles =============================== */

const VEHICLE_FIELDS = ['identifier', 'vehicle_type_id', 'description', 'capacity', 'color', 'status'];

exports.listVehicles = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const where = ['1=1'];
  const params = [];
  if (req.query.q) { where.push('v.identifier LIKE ?'); params.push(likeTerm(req.query.q)); }
  if (req.query.status) { where.push('v.status = ?'); params.push(req.query.status); }
  if (req.query.type) { where.push('vt.code = ?'); params.push(req.query.type); }
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM vehicles v JOIN vehicle_types vt ON vt.id = v.vehicle_type_id WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT v.*, vt.code AS vehicle_type,
            (SELECT GROUP_CONCAT(u.full_name SEPARATOR ', ') FROM vehicle_assignments va JOIN users u ON u.id = va.driver_id
              WHERE va.vehicle_id = v.id AND va.is_active = 1) AS drivers,
            (SELECT var.status FROM vehicle_availability_reports var WHERE var.vehicle_id = v.id ORDER BY var.id DESC LIMIT 1) AS latest_status,
            (SELECT var.reported_at FROM vehicle_availability_reports var WHERE var.vehicle_id = v.id ORDER BY var.id DESC LIMIT 1) AS latest_reported_at
       FROM vehicles v JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
      WHERE ${where.join(' AND ')} ORDER BY v.identifier LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows.map((v) => ({ ...v, is_demo: Boolean(v.is_demo) })), pageMeta(page, pageSize, total));
});

exports.vehicleAvailabilityHistory = asyncHandler(async (req, res) => {
  await getOr404('vehicles', req.params.id, 'Vehicle');
  const rows = await query(
    `SELECT var.id, var.status, var.note, var.reported_at, u.full_name AS driver_name, t.name AS terminal_name
       FROM vehicle_availability_reports var JOIN users u ON u.id = var.driver_id LEFT JOIN terminals t ON t.id = var.terminal_id
      WHERE var.vehicle_id = ? ORDER BY var.id DESC LIMIT 100`, [req.params.id]);
  ok(res, rows);
});

exports.createVehicle = asyncHandler(async (req, res) => {
  const { cols, vals } = pick(req.body, VEHICLE_FIELDS);
  const r = await query(`INSERT INTO vehicles SET ${cols.join(', ')}`, vals);
  await audit(req, 'vehicle.created', 'vehicle', r.insertId, { identifier: req.body.identifier });
  created(res, { id: r.insertId });
});

exports.updateVehicle = asyncHandler(async (req, res) => {
  const before = await getOr404('vehicles', req.params.id, 'Vehicle');
  const { cols, vals } = pick(req.body, VEHICLE_FIELDS);
  if (cols.length) await query(`UPDATE vehicles SET ${cols.join(', ')} WHERE id = ?`, [...vals, before.id]);
  await audit(req, 'vehicle.updated', 'vehicle', before.id, { before: { identifier: before.identifier, status: before.status }, changes: req.body });
  ok(res, { id: before.id });
});

exports.setVehicleStatus = asyncHandler(async (req, res) => {
  const v = await getOr404('vehicles', req.params.id, 'Vehicle');
  const status = req.body.status;
  if (!['active', 'inactive', 'suspended', 'archived'].includes(status)) throw ApiError.badRequest('Invalid status.');
  await query('UPDATE vehicles SET status = ? WHERE id = ?', [status, v.id]);
  await audit(req, 'vehicle.status_changed', 'vehicle', v.id, { from: v.status, to: status });
  ok(res, { id: v.id, status });
});

/* =============================== Assignments ============================= */

exports.listAssignments = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 25);
  const where = ['1=1'];
  const params = [];
  if (req.query.active === 'true') where.push('va.is_active = 1');
  if (req.query.active === 'false') where.push('va.is_active = 0');
  if (req.query.driver_id) { where.push('va.driver_id = ?'); params.push(parseInt(req.query.driver_id, 10) || 0); }
  if (req.query.vehicle_id) { where.push('va.vehicle_id = ?'); params.push(parseInt(req.query.vehicle_id, 10) || 0); }
  if (req.query.q) { const l = likeTerm(req.query.q); where.push('(u.full_name LIKE ? OR v.identifier LIKE ? OR r.code LIKE ?)'); params.push(l, l, l); }
  const base = `FROM vehicle_assignments va JOIN users u ON u.id = va.driver_id JOIN vehicles v ON v.id = va.vehicle_id
                LEFT JOIN routes r ON r.id = va.route_id LEFT JOIN terminals t ON t.id = va.terminal_id
                LEFT JOIN users a ON a.id = va.assigned_by WHERE ${where.join(' AND ')}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, params);
  const rows = await query(
    `SELECT va.*, u.full_name AS driver_name, v.identifier AS vehicle_identifier, r.code AS route_code, r.name AS route_name,
            t.name AS terminal_name, a.full_name AS assigned_by_name
       ${base} ORDER BY va.is_active DESC, va.start_date DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows.map((r) => ({ ...r, is_active: Boolean(r.is_active) })), pageMeta(page, pageSize, total));
});

exports.createAssignment = asyncHandler(async (req, res) => {
  const { driver_id, vehicle_id, route_id, terminal_id, start_date, end_date, notes } = req.body;
  const [driver] = await query(
    `SELECT u.id, u.full_name FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.id = ? AND u.role = 'driver' AND u.status = 'active' AND dp.approval_status = 'approved'`, [driver_id]);
  if (!driver) throw ApiError.badRequest('Assignments can only be made to approved, active drivers.');
  const vehicle = await getOr404('vehicles', vehicle_id, 'Vehicle');
  if (vehicle.status !== 'active') throw ApiError.badRequest('Only active vehicles can be assigned.');
  if (route_id) {
    const route = await getOr404('routes', route_id, 'Route');
    if (route.vehicle_type_id !== vehicle.vehicle_type_id) throw ApiError.badRequest("The vehicle type does not match the route's transportation type.");
  }
  if (terminal_id) await getOr404('terminals', terminal_id, 'Terminal');
  const dup = await query('SELECT id FROM vehicle_assignments WHERE driver_id = ? AND vehicle_id = ? AND is_active = 1', [driver_id, vehicle_id]);
  if (dup.length) throw ApiError.conflict('This driver already has an active assignment for this vehicle. End it before creating a new one.');
  const r = await query(
    `INSERT INTO vehicle_assignments (driver_id, vehicle_id, route_id, terminal_id, start_date, end_date, is_active, assigned_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [driver_id, vehicle_id, route_id || null, terminal_id || null, start_date, end_date || null, req.user.id, notes || null]);
  await audit(req, 'assignment.created', 'vehicle_assignment', r.insertId, { driver_id, vehicle_id, route_id, terminal_id });
  await notifyUser(driver_id, 'assignment', 'New assignment', `You were assigned to vehicle ${vehicle.identifier}.`, '/driver/assignments');
  created(res, { id: r.insertId });
});

exports.endAssignment = asyncHandler(async (req, res) => {
  const a = await getOr404('vehicle_assignments', req.params.id, 'Assignment');
  if (!a.is_active) throw ApiError.badRequest('This assignment has already ended.');
  await query('UPDATE vehicle_assignments SET is_active = 0, end_date = COALESCE(end_date, CURDATE()) WHERE id = ?', [a.id]);
  await audit(req, 'assignment.ended', 'vehicle_assignment', a.id, { driver_id: a.driver_id, vehicle_id: a.vehicle_id });
  ok(res, { id: a.id });
});
