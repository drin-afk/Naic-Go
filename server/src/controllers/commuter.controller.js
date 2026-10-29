const env = require('../config/env');
const { query, transaction } = require('../config/db');
const { ApiError, asyncHandler, ok, created, paginate, pageMeta } = require('../utils/http');
const { complaintReference } = require('../utils/tokens');
const { audit } = require('../utils/audit');
const { notifyAdmins, notifyUser } = require('../utils/notify');
const evidence = require('../utils/evidence');

const CATEGORY_LABELS = {
  scam_fraud: 'Suspected scam or fraud',
  overcharging: 'Overcharging or fare dispute',
  misconduct_harassment: 'Driver misconduct or harassment',
  unsafe_driving: 'Unsafe driving',
  route_deviation: 'Failure to follow the documented route',
  discrimination: 'Discrimination or mistreatment',
  other: 'Other transportation-related concern',
};
exports.CATEGORY_LABELS = CATEGORY_LABELS;

/* ------------------------------- Profile -------------------------------- */

exports.getProfile = asyncHandler(async (req, res) => {
  const [p] = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.email_verified_at, u.created_at, u.last_login_at,
            cp.contact_number, cp.preferred_contact
       FROM users u LEFT JOIN commuter_profiles cp ON cp.user_id = u.id WHERE u.id = ?`, [req.user.id]);
  const [stats] = await query(
    `SELECT COUNT(*) AS total,
            SUM(status IN ('submitted','under_review','info_requested')) AS open,
            SUM(status IN ('resolved','closed','rejected')) AS closed
       FROM driver_reports WHERE commuter_id = ?`, [req.user.id]);
  ok(res, { ...p, email_verified: Boolean(p.email_verified_at), report_stats: { total: stats.total, open: Number(stats.open || 0), closed: Number(stats.closed || 0) } });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { full_name, contact_number, preferred_contact } = req.body;
  await transaction(async (conn) => {
    if (full_name) await query('UPDATE users SET full_name = ? WHERE id = ?', [full_name, req.user.id], conn);
    await query(
      `INSERT INTO commuter_profiles (user_id, contact_number, preferred_contact) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE contact_number = VALUES(contact_number), preferred_contact = VALUES(preferred_contact)`,
      [req.user.id, contact_number || null, preferred_contact || 'email'], conn);
  });
  ok(res, { message: 'Profile updated.' });
});

/* ------------------------------- Reports -------------------------------- */

const COMMUTER_REPORT_FIELDS = `
  d.id, d.reference_no, d.vehicle_identifier, d.driver_identifier, d.incident_date, d.incident_time, d.category,
  d.description, d.preferred_contact, d.contact_detail, d.status, d.resolution_summary, d.rejection_reason,
  d.created_at, d.updated_at, vt.code AS vehicle_type, vt.name AS vehicle_type_name,
  r.code AS route_code, r.name AS route_name, t.name AS terminal_name`;
// NOTE: admin_notes, driver_id, driver_response and assigned_admin_id are intentionally NOT selected.

exports.listReports = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 10, 50);
  const where = ['d.commuter_id = ?'];
  const params = [req.user.id];
  if (req.query.status) { where.push('d.status = ?'); params.push(String(req.query.status)); }
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM driver_reports d WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT ${COMMUTER_REPORT_FIELDS}
       FROM driver_reports d
       JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
       LEFT JOIN routes r ON r.id = d.route_id
       LEFT JOIN terminals t ON t.id = d.terminal_id
      WHERE ${where.join(' AND ')}
      ORDER BY d.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows.map((r) => ({ ...r, category_label: CATEGORY_LABELS[r.category] })), pageMeta(page, pageSize, total));
});

/** Ownership enforced in SQL: a commuter can only ever load rows where commuter_id = their id. */
async function loadOwnReport(req) {
  const [report] = await query(
    `SELECT ${COMMUTER_REPORT_FIELDS}
       FROM driver_reports d
       JOIN vehicle_types vt ON vt.id = d.vehicle_type_id
       LEFT JOIN routes r ON r.id = d.route_id
       LEFT JOIN terminals t ON t.id = d.terminal_id
      WHERE d.id = ? AND d.commuter_id = ?`, [req.params.id, req.user.id]);
  if (!report) throw ApiError.notFound('Report not found.'); // 404 (not 403) to avoid revealing other users' reports
  return report;
}

exports.getReport = asyncHandler(async (req, res) => {
  const report = await loadOwnReport(req);
  const [history, files] = await Promise.all([
    query(
      `SELECT h.id, h.action, h.from_status, h.to_status, h.note, h.created_at,
              CASE WHEN u.role = 'admin' THEN 'NaicGo Administrator' WHEN u.id = ? THEN 'You' ELSE 'System' END AS actor
         FROM driver_report_history h LEFT JOIN users u ON u.id = h.actor_id
        WHERE h.report_id = ? AND h.is_internal = 0 ORDER BY h.created_at, h.id`, [req.user.id, report.id]),
    query('SELECT id, original_name, mime_type, size_bytes, created_at FROM driver_report_evidence WHERE report_id = ? AND uploaded_by = ?', [report.id, req.user.id]),
  ]);
  ok(res, { ...report, category_label: CATEGORY_LABELS[report.category], history, evidence: files });
});

exports.createReport = asyncHandler(async (req, res) => {
  if (env.requireEmailVerification && !req.user.email_verified_at) {
    throw ApiError.forbidden('Please verify your email address before submitting a report.');
  }
  const b = req.body;
  const [vt] = await query('SELECT id FROM vehicle_types WHERE code = ?', [b.vehicle_type]);
  if (!vt) throw ApiError.badRequest('Unknown transportation type.');

  // Validate optional references exist (prefilled from route/vehicle/terminal pages).
  if (b.route_id && !(await query('SELECT id FROM routes WHERE id = ?', [b.route_id])).length) throw ApiError.badRequest('Selected route does not exist.');
  if (b.terminal_id && !(await query('SELECT id FROM terminals WHERE id = ?', [b.terminal_id])).length) throw ApiError.badRequest('Selected terminal does not exist.');
  if (b.vehicle_id && !(await query('SELECT id FROM vehicles WHERE id = ?', [b.vehicle_id])).length) throw ApiError.badRequest('Selected vehicle does not exist.');

  // Duplicate guard: same commuter, same incident date, same category & vehicle in the last 24 hours.
  const dup = await query(
    `SELECT reference_no FROM driver_reports
      WHERE commuter_id = ? AND incident_date = ? AND category = ?
        AND COALESCE(vehicle_identifier,'') = COALESCE(?, '') AND COALESCE(route_id,0) = COALESCE(?,0)
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 1`,
    [req.user.id, b.incident_date, b.category, b.vehicle_identifier || null, b.route_id || null]);
  if (dup.length) {
    throw ApiError.conflict(`It looks like you already reported this incident (reference ${dup[0].reference_no}). You can follow up from your report page.`);
  }

  const inspected = evidence.inspect(req.files || []); // rejects disguised/invalid files before anything is stored
  let writtenFiles = [];
  const result = await transaction(async (conn) => {
    let reference, insert;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      reference = complaintReference();
      try {
        insert = await query(
          `INSERT INTO driver_reports (reference_no, commuter_id, vehicle_type_id, vehicle_identifier, driver_identifier,
                                       vehicle_id, route_id, terminal_id, incident_date, incident_time, category, description,
                                       preferred_contact, contact_detail, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
          [reference, req.user.id, vt.id, b.vehicle_identifier || null, b.driver_identifier || null,
           b.vehicle_id || null, b.route_id || null, b.terminal_id || null, b.incident_date, b.incident_time || null,
           b.category, b.description, b.preferred_contact || 'email', b.contact_detail || null], conn);
        break;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY' || attempt === 4) throw e; // reference collision -> retry
      }
    }
    const reportId = insert.insertId;
    writtenFiles = await evidence.save(inspected, reportId, req.user.id, conn);
    await query(
      `INSERT INTO driver_report_history (report_id, actor_id, action, to_status, note)
       VALUES (?, ?, 'submitted', 'submitted', 'Report submitted by commuter.')`, [reportId, req.user.id], conn);
    await notifyAdmins('passenger_report', 'New passenger report',
      `Report ${reference} (${CATEGORY_LABELS[b.category]}) was submitted and awaits review.`, `/admin/reports/${reportId}`, conn);
    await notifyUser(req.user.id, 'report_submitted', 'Report received',
      `Your report ${reference} was received. We will update you as it is reviewed.`, `/commuter/reports/${reportId}`, conn);
    return { id: reportId, reference_no: reference };
  }).catch(async (err) => {
    await evidence.removeFiles(writtenFiles);
    throw err;
  });

  await audit(req, 'complaint.submitted', 'driver_report', result.id, { reference: result.reference_no, files: inspected.length });
  created(res, { ...result, status: 'submitted', message: 'Your report has been submitted.' });
});

/** Commuter adds information (typically after "Additional Information Requested"). */
exports.respondToReport = asyncHandler(async (req, res) => {
  const report = await loadOwnReport(req);
  if (['closed', 'rejected'].includes(report.status)) throw ApiError.badRequest('This report is closed and can no longer be updated.');
  const inspected = evidence.inspect(req.files || []);
  let writtenFiles = [];
  await transaction(async (conn) => {
    const newStatus = report.status === 'info_requested' ? 'under_review' : report.status;
    await query(
      `INSERT INTO driver_report_history (report_id, actor_id, action, from_status, to_status, note)
       VALUES (?, ?, 'commuter_response', ?, ?, ?)`,
      [report.id, req.user.id, report.status, newStatus, req.body.message], conn);
    if (newStatus !== report.status) await query('UPDATE driver_reports SET status = ? WHERE id = ?', [newStatus, report.id], conn);
    writtenFiles = await evidence.save(inspected, report.id, req.user.id, conn);
    const [{ assigned_admin_id: adminId }] = await query('SELECT assigned_admin_id FROM driver_reports WHERE id = ?', [report.id], conn);
    const msg = `The commuter added information to report ${report.reference_no}.`;
    if (adminId) await notifyUser(adminId, 'report_response', 'Commuter responded', msg, `/admin/reports/${report.id}`, conn);
    else await notifyAdmins('report_response', 'Commuter responded', msg, `/admin/reports/${report.id}`, conn);
  }).catch(async (err) => { await evidence.removeFiles(writtenFiles); throw err; });
  await audit(req, 'complaint.commuter_response', 'driver_report', report.id);
  ok(res, { message: 'Your additional information was added to the report.' });
});

exports.downloadOwnEvidence = asyncHandler(async (req, res) => {
  await loadOwnReport(req);
  const [row] = await query('SELECT * FROM driver_report_evidence WHERE id = ? AND report_id = ? AND uploaded_by = ?',
    [req.params.fileId, req.params.id, req.user.id]);
  if (!row) throw ApiError.notFound('File not found.');
  evidence.send(res, row);
});
