const env = require('../config/env');
const { query } = require('../config/db');

/**
 * Availability is DRIVER-REPORTED, not GPS tracking.
 * For each vehicle we take its most recent report and flag whether it is "fresh"
 * (newer than AVAILABILITY_FRESH_MINUTES). Old reports are never presented as current.
 */
const LATEST_REPORTS_SQL = `
  SELECT var.vehicle_id, var.status, var.reported_at, var.terminal_id, var.note,
         TIMESTAMPDIFF(MINUTE, var.reported_at, NOW()) AS minutes_ago
    FROM vehicle_availability_reports var
    JOIN (SELECT vehicle_id, MAX(id) AS max_id FROM vehicle_availability_reports GROUP BY vehicle_id) latest
      ON latest.max_id = var.id`;

function shape(row) {
  const fresh = row.minutes_ago !== null && row.minutes_ago <= env.availabilityFreshMinutes;
  return {
    vehicle_id: row.vehicle_id,
    vehicle_identifier: row.identifier,
    vehicle_type: row.vehicle_type,
    status: row.status,
    reported_at: row.reported_at,
    minutes_ago: row.minutes_ago,
    is_fresh: fresh,
    route_id: row.route_id ?? null,
    terminal_id: row.report_terminal_id ?? row.assignment_terminal_id ?? null,
    note: row.note || null,
  };
}

function summarize(items) {
  const s = { available: 0, unavailable: 0, temporarily_suspended: 0, outdated: 0, latest_report_at: null, vehicles: items };
  for (const v of items) {
    if (!v.is_fresh) s.outdated += 1;
    else s[v.status] += 1;
    if (!s.latest_report_at || v.reported_at > s.latest_report_at) s.latest_report_at = v.reported_at;
  }
  s.fresh_window_minutes = env.availabilityFreshMinutes;
  return s;
}

/**
 * Latest availability for vehicles currently assigned (active assignment) to the given routes.
 * Returns Map<routeId, summary>.
 */
async function byRoutes(routeIds) {
  const map = new Map();
  if (!routeIds.length) return map;
  const rows = await query(
    `SELECT l.*, v.identifier, vt.code AS vehicle_type, va.route_id, va.terminal_id AS assignment_terminal_id,
            l.terminal_id AS report_terminal_id
       FROM vehicle_assignments va
       JOIN vehicles v ON v.id = va.vehicle_id AND v.status = 'active'
       JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
       JOIN (${LATEST_REPORTS_SQL}) l ON l.vehicle_id = va.vehicle_id
      WHERE va.is_active = 1 AND va.route_id IN (?)`,
    [routeIds]
  );
  const grouped = {};
  for (const r of rows) {
    (grouped[r.route_id] ||= new Map()).set(r.vehicle_id, shape(r)); // de-duplicate vehicles
  }
  for (const id of routeIds) map.set(Number(id), summarize(grouped[id] ? [...grouped[id].values()] : []));
  return map;
}

/** Latest availability for vehicles assigned to a terminal OR whose latest report names that terminal. */
async function byTerminal(terminalId) {
  const rows = await query(
    `SELECT DISTINCT l.*, v.identifier, vt.code AS vehicle_type, va.route_id, va.terminal_id AS assignment_terminal_id,
            l.terminal_id AS report_terminal_id
       FROM (${LATEST_REPORTS_SQL}) l
       JOIN vehicles v ON v.id = l.vehicle_id AND v.status = 'active'
       JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
       LEFT JOIN vehicle_assignments va ON va.vehicle_id = l.vehicle_id AND va.is_active = 1
      WHERE l.terminal_id = ? OR va.terminal_id = ?`,
    [terminalId, terminalId]
  );
  const unique = new Map();
  for (const r of rows) if (!unique.has(r.vehicle_id)) unique.set(r.vehicle_id, shape(r));
  return summarize([...unique.values()]);
}

/** Public availability listing with optional filters. */
async function list({ routeId, terminalId, type } = {}) {
  const where = ['v.status = \'active\''];
  const params = [];
  if (routeId) { where.push('va.route_id = ?'); params.push(routeId); }
  if (terminalId) { where.push('(va.terminal_id = ? OR l.terminal_id = ?)'); params.push(terminalId, terminalId); }
  if (type) { where.push('vt.code = ?'); params.push(type); }
  const rows = await query(
    `SELECT l.*, v.identifier, vt.code AS vehicle_type, va.route_id, va.terminal_id AS assignment_terminal_id,
            l.terminal_id AS report_terminal_id, r.code AS route_code, r.name AS route_name,
            COALESCE(t1.name, t2.name) AS terminal_name
       FROM (${LATEST_REPORTS_SQL}) l
       JOIN vehicles v ON v.id = l.vehicle_id
       JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
       LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.is_active = 1
       LEFT JOIN routes r ON r.id = va.route_id
       LEFT JOIN terminals t1 ON t1.id = l.terminal_id
       LEFT JOIN terminals t2 ON t2.id = va.terminal_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.reported_at DESC
      LIMIT 200`,
    params
  );
  const unique = new Map();
  for (const r of rows) {
    if (unique.has(r.vehicle_id)) continue;
    unique.set(r.vehicle_id, { ...shape(r), route_code: r.route_code, route_name: r.route_name, terminal_name: r.terminal_name });
  }
  return summarize([...unique.values()]);
}

module.exports = { byRoutes, byTerminal, list };
