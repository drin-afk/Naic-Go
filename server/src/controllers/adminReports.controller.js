const env = require('../config/env');
const { query, transaction } = require('../config/db');
const { ApiError, asyncHandler, ok, created, paginate, pageMeta, likeTerm } = require('../utils/http');
const { audit } = require('../utils/audit');
const { notifyUser } = require('../utils/notify');
const evidence = require('../utils/evidence');
const { CATEGORY_LABELS } = require('./commuter.controller');

const STATUS_LABELS = {
  submitted: 'Submitted', under_review: 'Under Review', info_requested: 'Additional Information Requested',
  resolved: 'Resolved', closed: 'Closed', rejected: 'Rejected',
};
const TRANSITIONS = {
  submitted: ['under_review', 'info_requested', 'rejected', 'closed'],
  under_review: ['info_requested', 'resolved', 'rejected', 'closed'],
  info_requested: ['under_review', 'resolved', 'rejected', 'closed'],
  resolved: ['closed', 'under_review'],
  closed: ['under_review'],
  rejected: ['under_review'],
};

/* ============================ Dashboard metrics ========================== */

exports.dashboard = asyncHandler(async (req, res) => {
  const [[m], byStatus, byCategory, recentReports, pendingDrivers] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*) FROM terminals WHERE status <> 'archived') AS terminals,
      (SELECT COUNT(*) FROM routes WHERE status <> 'archived') AS routes,
      (SELECT COUNT(*) FROM users WHERE role = 'commuter') AS commuters,
      (SELECT COUNT(*) FROM users WHERE role = 'driver') AS drivers,
      (SELECT COUNT(*) FROM vehicles WHERE status <> 'archived') AS vehicles,
      (SELECT COUNT(*) FROM driver_profiles WHERE approval_status = 'pending') AS pending_drivers,
      (SELECT COUNT(*) FROM driver_update_requests WHERE status = 'pending') AS pending_updates,
      (SELECT COUNT(*) FROM vehicle_availability_reports WHERE reported_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)) AS fresh_availability_reports,
      (SELECT COUNT(DISTINCT vehicle_id) FROM vehicle_availability_reports WHERE reported_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS vehicles_reported_24h,
      (SELECT COUNT(*) FROM driver_reports WHERE status IN ('submitted','under_review','info_requested')) AS pending_complaints,
      (SELECT COUNT(*) FROM road_obstruction_reports WHERE resolution_status = 'active') AS active_obstructions,
      (SELECT COUNT(*) FROM road_obstruction_reports WHERE verification_status = 'pending') AS pending_obstructions,
      (SELECT COUNT(*) FROM terminals WHERE is_demo = 1) + (SELECT COUNT(*) FROM routes WHERE is_demo = 1) AS demo_records`,
    [env.availabilityFreshMinutes]),
    query('SELECT status, COUNT(*) AS n FROM driver_reports GROUP BY status'),
    query('SELECT category, COUNT(*) AS n FROM driver_reports GROUP BY category ORDER BY n DESC'),
    query(`SELECT id, reference_no, category, status, created_at FROM driver_reports ORDER BY created_at DESC LIMIT 5`),
    query(`SELECT u.id, u.full_name, vt.code AS vehicle_type, u.created_at FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
            JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id WHERE dp.approval_status = 'pending' ORDER BY u.created_at LIMIT 5`),
  ]);
  ok(res, {
    metrics: m,
    complaints_by_status: byStatus.map((r) => ({ ...r, label: STATUS_LABELS[r.status] })),
    complaints_by_category: byCategory.map((r) => ({ ...r, label: CATEGORY_LABELS[r.category] })),
    recent_reports: recentReports.map((r) => ({ ...r, category_label: CATEGORY_LABELS[r.category] })),
    pending_drivers: pendingDrivers,
    fresh_window_minutes: env.availabilityFreshMinutes,
  });
});

/* =========================== Passenger reports =========================== */

exports.listReports = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const where = ['1=1'];
  const params = [];
  if (req.query.status) { where.push('d.status = ?'); params.push(req.query.status); }
  if (req.query.category) { where.push('d.category = ?'); params.push(req.query.category); }
  if (req.query.type) { where.push('vt.code = ?'); params.push(req.query.type); }
  if (req.query.assigned === 'me') { where.push('d.assigned_admin_id = ?'); params.push(req.user.id); }
  if (req.query.assigned === 'none') where.push('d.assigned_admin_id IS NULL');
  if (req.query.from) { where.push('d.created_at >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('d.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(req.query.to); }
  if (req.query.q) {
    const l = likeTerm(req.query.q);
    where.push('(d.reference_no LIKE ? OR d.vehicle_identifier LIKE ? OR d.driver_identifier LIKE ? OR d.description LIKE ?)');
    params.push(l, l, l, l);
  }
  const base = `FROM driver_reports d JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
                LEFT JOIN routes r ON r.id = d.route_id LEFT JOIN terminals t ON t.id = d.terminal_id
                LEFT JOIN users a ON a.id = d.assigned_admin_id WHERE ${where.join(' AND ')}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, params);
  const rows = await query(
    `SELECT d.id, d.reference_no, d.incident_date, d.category, d.status, d.vehicle_identifier, d.created_at, d.updated_at,
            vt.code AS vehicle_type, r.code AS route_code, t.name AS terminal_name, a.full_name AS assigned_admin
       ${base} ORDER BY FIELD(d.status,'submitted','info_requested','under_review','resolved','rejected','closed'), d.created_at DESC
      LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows.map((r) => ({ ...r, category_label: CATEGORY_LABELS[r.category], status_label: STATUS_LABELS[r.status] })),
    pageMeta(page, pageSize, total));
});

async function loadReport(id) {
  const [d] = await query(
    `SELECT d.*, vt.code AS vehicle_type, r.code AS route_code, r.name AS route_name, t.name AS terminal_name,
            v.identifier AS linked_vehicle_identifier, dr.full_name AS linked_driver_name,
            c.full_name AS commuter_name, c.email AS commuter_email, cp.contact_number AS commuter_contact,
            a.full_name AS assigned_admin
       FROM driver_reports d
       JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
       JOIN users c ON c.id = d.commuter_id
       LEFT JOIN commuter_profiles cp ON cp.user_id = c.id
       LEFT JOIN routes r ON r.id = d.route_id
       LEFT JOIN terminals t ON t.id = d.terminal_id
       LEFT JOIN vehicles v ON v.id = d.vehicle_id
       LEFT JOIN users dr ON dr.id = d.driver_id
       LEFT JOIN users a ON a.id = d.assigned_admin_id
      WHERE d.id = ?`, [id]);
  if (!d) throw ApiError.notFound('Report not found.');
  return d;
}

exports.getReport = asyncHandler(async (req, res) => {
  const d = await loadReport(req.params.id);
  const [history, files, related] = await Promise.all([
    query(`SELECT h.*, u.full_name AS actor_name, u.role AS actor_role FROM driver_report_history h
             LEFT JOIN users u ON u.id = h.actor_id WHERE h.report_id = ? ORDER BY h.created_at, h.id`, [d.id]),
    query('SELECT id, original_name, mime_type, size_bytes, created_at FROM driver_report_evidence WHERE report_id = ?', [d.id]),
    // Other reports mentioning the same vehicle — context for reviewers, not proof of wrongdoing.
    d.vehicle_identifier || d.vehicle_id
      ? query(`SELECT id, reference_no, category, status, created_at FROM driver_reports
                WHERE id <> ? AND ((? IS NOT NULL AND vehicle_id = ?) OR (? IS NOT NULL AND vehicle_identifier = ?))
                ORDER BY created_at DESC LIMIT 10`,
        [d.id, d.vehicle_id, d.vehicle_id, d.vehicle_identifier, d.vehicle_identifier])
      : Promise.resolve([]),
  ]);
  await audit(req, 'complaint.viewed', 'driver_report', d.id);
  ok(res, {
    ...d,
    category_label: CATEGORY_LABELS[d.category],
    status_label: STATUS_LABELS[d.status],
    allowed_transitions: TRANSITIONS[d.status],
    history,
    evidence: files,
    related_reports: related.map((r) => ({ ...r, category_label: CATEGORY_LABELS[r.category] })),
  });
});

exports.updateReport = asyncHandler(async (req, res) => {
  const d = await loadReport(req.params.id);
  const b = req.body;
  const sets = [];
  const vals = [];
  const historyRows = [];
  let notifyMsg = null;

  if (b.status && b.status !== d.status) {
    if (!TRANSITIONS[d.status].includes(b.status)) {
      throw ApiError.badRequest(`A report cannot move from "${STATUS_LABELS[d.status]}" to "${STATUS_LABELS[b.status]}".`);
    }
    if (b.status === 'rejected' && !b.rejection_reason) throw new ApiError(422, 'A documented reason is required to reject a report.', [{ field: 'rejection_reason', message: 'Enter the reason.' }]);
    if (b.status === 'resolved' && !(b.resolution_summary || d.resolution_summary)) throw new ApiError(422, 'Add a resolution summary before resolving.', [{ field: 'resolution_summary', message: 'Enter the outcome.' }]);
    if (b.status === 'info_requested' && !b.public_note) throw new ApiError(422, 'Tell the commuter what information is needed.', [{ field: 'public_note', message: 'Enter the request for the commuter.' }]);
    sets.push('status = ?'); vals.push(b.status);
    historyRows.push({ action: 'status_changed', from: d.status, to: b.status, note: b.public_note || (b.status === 'rejected' ? b.rejection_reason : null), internal: 0 });
    notifyMsg = `Your report ${d.reference_no} is now "${STATUS_LABELS[b.status]}".${b.public_note ? ' ' + b.public_note : ''}`;
  } else if (b.public_note) {
    historyRows.push({ action: 'update_to_commuter', note: b.public_note, internal: 0 });
    notifyMsg = `There is an update on your report ${d.reference_no}: ${b.public_note}`;
  }

  for (const key of ['resolution_summary', 'rejection_reason', 'driver_response']) {
    if (b[key] !== undefined && b[key] !== d[key]) { sets.push(`${key} = ?`); vals.push(b[key] || null); }
  }
  if (b.admin_notes) {
    // Private investigation notes are appended (never overwritten) to preserve the record.
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const appended = `${d.admin_notes ? d.admin_notes + '\n\n' : ''}[${stamp}] ${req.user.full_name}: ${b.admin_notes}`;
    sets.push('admin_notes = ?'); vals.push(appended);
    historyRows.push({ action: 'internal_note', note: b.admin_notes, internal: 1 });
  }
  if (b.driver_response !== undefined && b.driver_response !== d.driver_response && b.driver_response) {
    historyRows.push({ action: 'driver_response_recorded', note: 'Driver response recorded by administrator.', internal: 1 });
  }
  if (b.assigned_admin_id !== undefined && b.assigned_admin_id !== d.assigned_admin_id) {
    if (b.assigned_admin_id) {
      const [a] = await query("SELECT id FROM users WHERE id = ? AND role = 'admin' AND status = 'active'", [b.assigned_admin_id]);
      if (!a) throw ApiError.badRequest('Assigned administrator not found.');
    }
    sets.push('assigned_admin_id = ?'); vals.push(b.assigned_admin_id || null);
    historyRows.push({ action: 'assigned', note: b.assigned_admin_id ? `Assigned to administrator #${b.assigned_admin_id}` : 'Unassigned', internal: 1 });
  }
  if (b.vehicle_id !== undefined && b.vehicle_id !== d.vehicle_id) {
    if (b.vehicle_id && !(await query('SELECT id FROM vehicles WHERE id = ?', [b.vehicle_id])).length) throw ApiError.badRequest('Vehicle not found.');
    sets.push('vehicle_id = ?'); vals.push(b.vehicle_id || null);
    historyRows.push({ action: 'vehicle_associated', note: b.vehicle_id ? `Associated with vehicle #${b.vehicle_id}` : 'Vehicle association removed', internal: 1 });
  }
  if (b.driver_id !== undefined && b.driver_id !== d.driver_id) {
    if (b.driver_id && !(await query("SELECT id FROM users WHERE id = ? AND role = 'driver'", [b.driver_id])).length) throw ApiError.badRequest('Driver not found.');
    sets.push('driver_id = ?'); vals.push(b.driver_id || null);
    historyRows.push({ action: 'driver_associated', note: b.driver_id ? `Associated with driver #${b.driver_id} (verified by administrator)` : 'Driver association removed', internal: 1 });
  }
  if (!sets.length && !historyRows.length) throw ApiError.badRequest('No changes to save.');

  await transaction(async (conn) => {
    if (sets.length) await query(`UPDATE driver_reports SET ${sets.join(', ')} WHERE id = ?`, [...vals, d.id], conn);
    for (const h of historyRows) {
      await query(
        `INSERT INTO driver_report_history (report_id, actor_id, action, from_status, to_status, note, is_internal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [d.id, req.user.id, h.action, h.from || null, h.to || null, h.note || null, h.internal], conn);
    }
    if (notifyMsg) await notifyUser(d.commuter_id, 'report_update', 'Report update', notifyMsg, `/commuter/reports/${d.id}`, conn);
  });
  await audit(req, b.status && b.status !== d.status ? 'complaint.status_changed' : 'complaint.updated', 'driver_report', d.id,
    { from: d.status, to: b.status || d.status, fields: Object.keys(b).filter((k) => k !== 'admin_notes') });
  ok(res, { id: d.id });
});

exports.downloadEvidence = asyncHandler(async (req, res) => {
  const [row] = await query('SELECT * FROM driver_report_evidence WHERE id = ? AND report_id = ?', [req.params.fileId, req.params.id]);
  if (!row) throw ApiError.notFound('File not found.');
  await audit(req, 'complaint.evidence_viewed', 'driver_report', Number(req.params.id), { file_id: row.id });
  evidence.send(res, row);
});

/* ============================ Road obstructions ========================== */

const OBSTRUCTION_FIELDS = ['title', 'location_description', 'latitude', 'longitude', 'description', 'affected_route_id',
  'reported_at', 'verification_status', 'resolution_status', 'is_published', 'admin_notes'];

function pickFields(b, keys) {
  const cols = []; const vals = [];
  for (const k of keys) if (b[k] !== undefined) { cols.push(`${k} = ?`); vals.push(typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : (b[k] === '' ? null : b[k])); }
  return { cols, vals };
}

exports.listObstructions = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const where = ['1=1'];
  const params = [];
  if (req.query.verification) { where.push('o.verification_status = ?'); params.push(req.query.verification); }
  if (req.query.resolution) { where.push('o.resolution_status = ?'); params.push(req.query.resolution); }
  if (req.query.q) { const l = likeTerm(req.query.q); where.push('(o.title LIKE ? OR o.location_description LIKE ?)'); params.push(l, l); }
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM road_obstruction_reports o WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT o.*, r.code AS route_code, r.name AS route_name, u.full_name AS reviewed_by_name,
            (SELECT COUNT(*) FROM route_alternatives ra WHERE ra.route_id = o.affected_route_id) AS documented_alternatives
       FROM road_obstruction_reports o LEFT JOIN routes r ON r.id = o.affected_route_id LEFT JOIN users u ON u.id = o.reviewed_by
      WHERE ${where.join(' AND ')} ORDER BY FIELD(o.verification_status,'pending','verified','rejected'), o.reported_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]);
  ok(res, rows.map((o) => ({ ...o, is_published: Boolean(o.is_published), is_demo: Boolean(o.is_demo) })), pageMeta(page, pageSize, total));
});

function checkPublishable(b, current = {}) {
  const verification = b.verification_status ?? current.verification_status ?? 'pending';
  const published = b.is_published ?? Boolean(current.is_published);
  if (published && verification !== 'verified') throw ApiError.badRequest('Only verified obstruction reports can be published.');
}

exports.createObstruction = asyncHandler(async (req, res) => {
  const b = { ...req.body };
  if (!b.reported_at) delete b.reported_at; // column default handled below
  if (b.reported_at && b.reported_at.includes('T')) b.reported_at = b.reported_at.slice(0, 19).replace('T', ' ');
  checkPublishable(b);
  const { cols, vals } = pickFields(b, OBSTRUCTION_FIELDS);
  if (!b.reported_at) cols.push('reported_at = NOW()');
  cols.push('reported_by = ?', 'reviewed_by = ?'); vals.push(req.user.id, req.user.id);
  const r = await query(`INSERT INTO road_obstruction_reports SET ${cols.join(', ')}`, vals);
  await audit(req, 'obstruction.created', 'road_obstruction', r.insertId, { title: b.title, published: b.is_published });
  created(res, { id: r.insertId });
});

exports.updateObstruction = asyncHandler(async (req, res) => {
  const [o] = await query('SELECT * FROM road_obstruction_reports WHERE id = ?', [req.params.id]);
  if (!o) throw ApiError.notFound('Obstruction report not found.');
  const b = { ...req.body };
  if (!b.reported_at) delete b.reported_at;
  if (b.reported_at && b.reported_at.includes('T')) b.reported_at = b.reported_at.slice(0, 19).replace('T', ' ');
  if (b.verification_status === 'rejected') b.is_published = false;
  checkPublishable(b, o);
  const { cols, vals } = pickFields(b, OBSTRUCTION_FIELDS);
  cols.push('reviewed_by = ?'); vals.push(req.user.id);
  await query(`UPDATE road_obstruction_reports SET ${cols.join(', ')} WHERE id = ?`, [...vals, o.id]);
  await audit(req, 'obstruction.updated', 'road_obstruction', o.id,
    { before: { verification: o.verification_status, resolution: o.resolution_status, published: o.is_published }, changes: b });
  ok(res, { id: o.id });
});

/* ========================= Reports, analytics, CSV ======================= */

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => {
  if (!rows.length) return 'No records\n';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
};

const REPORTS = {
  terminals: {
    title: 'Terminals',
    sql: `SELECT t.id, t.name, t.barangay, t.address, t.latitude, t.longitude, t.status, t.verification_status, t.verified_at,
                 IF(t.is_demo,'yes','no') AS demo_record, t.created_at, t.updated_at
            FROM terminals t WHERE t.created_at >= ? AND t.created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY t.name`,
  },
  routes: {
    title: 'Routes',
    sql: `SELECT r.id, r.code, r.name, vt.name AS vehicle_type, r.origin, r.destination, r.distance_km, r.status,
                 r.verification_status, r.verified_at, IF(r.is_demo,'yes','no') AS demo_record,
                 (SELECT COUNT(*) FROM route_stops s WHERE s.route_id = r.id) AS stops, r.updated_at
            FROM routes r JOIN vehicle_types vt ON vt.id = r.vehicle_type_id
           WHERE r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY r.code`,
  },
  categories: {
    title: 'Transportation categories',
    sql: `SELECT vt.name AS vehicle_type,
                 (SELECT COUNT(*) FROM routes r WHERE r.vehicle_type_id = vt.id AND r.status = 'active') AS active_routes,
                 (SELECT COUNT(*) FROM vehicles v WHERE v.vehicle_type_id = vt.id AND v.status = 'active') AS active_vehicles,
                 (SELECT COUNT(*) FROM driver_profiles dp WHERE dp.vehicle_type_id = vt.id AND dp.approval_status = 'approved') AS approved_drivers,
                 (SELECT COUNT(*) FROM driver_reports d WHERE d.vehicle_type_id = vt.id AND d.created_at >= ? AND d.created_at < DATE_ADD(?, INTERVAL 1 DAY)) AS complaints_in_period
            FROM vehicle_types vt ORDER BY vt.id`,
  },
  driver_registrations: {
    title: 'Driver registrations',
    sql: `SELECT u.id, u.full_name, u.username, vt.name AS vehicle_type, dp.association_name, dp.approval_status,
                 dp.approval_reason, u.status AS account_status, u.created_at AS registered_at, dp.reviewed_at
            FROM users u JOIN driver_profiles dp ON dp.user_id = u.id JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id
           WHERE u.created_at >= ? AND u.created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY u.created_at DESC`,
  },
  availability: {
    title: 'Vehicle availability submissions',
    sql: `SELECT var.id, v.identifier AS vehicle, vt.name AS vehicle_type, var.status, t.name AS terminal, var.note,
                 u.full_name AS reported_by, var.reported_at
            FROM vehicle_availability_reports var JOIN vehicles v ON v.id = var.vehicle_id
            JOIN vehicle_types vt ON vt.id = v.vehicle_type_id JOIN users u ON u.id = var.driver_id
            LEFT JOIN terminals t ON t.id = var.terminal_id
           WHERE var.reported_at >= ? AND var.reported_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY var.reported_at DESC`,
  },
  fare_changes: {
    title: 'Fare changes',
    sql: `SELECT f.id, r.code AS route, f.passenger_category, f.fare_type, f.amount_min, f.amount_max, f.effective_date,
                 IF(f.is_current,'current','historical') AS state, f.verification_status, f.verified_at, f.source,
                 u.full_name AS entered_by, f.created_at, f.updated_at
            FROM fares f JOIN routes r ON r.id = f.route_id LEFT JOIN users u ON u.id = f.created_by
           WHERE f.updated_at >= ? AND f.updated_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY r.code, f.created_at DESC`,
  },
  complaints: {
    title: 'Passenger complaints (no personal data)',
    sql: `SELECT d.reference_no, vt.name AS vehicle_type, d.category, d.status, d.incident_date, r.code AS route,
                 t.name AS terminal, d.created_at AS submitted_at, d.updated_at AS last_update
            FROM driver_reports d JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
            LEFT JOIN routes r ON r.id = d.route_id LEFT JOIN terminals t ON t.id = d.terminal_id
           WHERE d.created_at >= ? AND d.created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY d.created_at DESC`,
  },
  obstructions: {
    title: 'Road obstruction reports',
    sql: `SELECT o.id, o.title, o.location_description, r.code AS affected_route, o.verification_status, o.resolution_status,
                 IF(o.is_published,'yes','no') AS published, o.reported_at, o.updated_at
            FROM road_obstruction_reports o LEFT JOIN routes r ON r.id = o.affected_route_id
           WHERE o.reported_at >= ? AND o.reported_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY o.reported_at DESC`,
  },
};

function dateRange(req) {
  const valid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const to = valid(req.query.to) ? req.query.to : new Date().toISOString().slice(0, 10);
  const from = valid(req.query.from) ? req.query.from : '2000-01-01';
  return { from, to };
}

exports.listReportTypes = asyncHandler(async (req, res) => {
  ok(res, Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title })));
});

exports.runReport = asyncHandler(async (req, res) => {
  const def = REPORTS[req.params.type];
  if (!def) throw ApiError.notFound('Unknown report.');
  const { from, to } = dateRange(req);
  const rows = await query(def.sql, [from, to]);
  if (req.query.format === 'csv') {
    await audit(req, 'report.exported', 'report', null, { type: req.params.type, from, to, rows: rows.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="naicgo-${req.params.type}-${from}-to-${to}.csv"`);
    return res.send('﻿' + `# NaicGo ${def.title} | ${from} to ${to} | Database records only - not independently verified real-world counts\n` + toCsv(rows));
  }
  ok(res, { title: def.title, from, to, rows, note: 'Counts reflect records stored in NaicGo, not independently verified real-world totals.' });
});

/* ================================ Audit logs ============================== */

exports.listAuditLogs = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 50, 200);
  const where = ['1=1'];
  const params = [];
  if (req.query.action) { where.push('l.action LIKE ?'); params.push(likeTerm(req.query.action)); }
  if (req.query.entity_type) { where.push('l.entity_type = ?'); params.push(req.query.entity_type); }
  if (req.query.actor) { const l = likeTerm(req.query.actor); where.push('(u.full_name LIKE ? OR u.username LIKE ?)'); params.push(l, l); }
  if (req.query.from) { where.push('l.created_at >= ?'); params.push(req.query.from); }
  if (req.query.to) { where.push('l.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(req.query.to); }
  const base = `FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_id WHERE ${where.join(' AND ')}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, params);
  const rows = await query(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.ip_address, l.created_at,
            u.full_name AS actor_name, u.role AS actor_role
       ${base} ORDER BY l.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows, pageMeta(page, pageSize, total));
});
