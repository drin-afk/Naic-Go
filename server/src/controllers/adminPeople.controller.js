const { query, transaction } = require('../config/db');
const { ApiError, asyncHandler, ok, paginate, pageMeta, likeTerm } = require('../utils/http');
const { audit } = require('../utils/audit');
const { notifyUser } = require('../utils/notify');

/* ================================ Drivers ================================ */

exports.listDrivers = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const where = ["u.role = 'driver'"];
  const params = [];
  if (req.query.approval) { where.push('dp.approval_status = ?'); params.push(req.query.approval); }
  if (req.query.status) { where.push('u.status = ?'); params.push(req.query.status); }
  if (req.query.type) { where.push('vt.code = ?'); params.push(req.query.type); }
  if (req.query.q) { const l = likeTerm(req.query.q); where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR dp.association_name LIKE ?)'); params.push(l, l, l, l); }
  const base = `FROM users u JOIN driver_profiles dp ON dp.user_id = u.id JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id WHERE ${where.join(' AND ')}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, params);
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.status, u.created_at, u.last_login_at,
            dp.contact_number, dp.operator_name, dp.association_name, dp.vehicle_details, dp.approval_status,
            dp.approval_reason, dp.reviewed_at, vt.code AS vehicle_type,
            (SELECT COUNT(*) FROM vehicle_assignments va WHERE va.driver_id = u.id AND va.is_active = 1) AS active_assignments
       ${base} ORDER BY FIELD(dp.approval_status,'pending','approved','rejected'), u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]);
  ok(res, rows, pageMeta(page, pageSize, total));
});

async function loadDriver(id) {
  const [d] = await query(
    `SELECT u.id, u.full_name, u.status, dp.approval_status FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.id = ? AND u.role = 'driver'`, [id]);
  if (!d) throw ApiError.notFound('Driver not found.');
  return d;
}

exports.approveDriver = asyncHandler(async (req, res) => {
  const d = await loadDriver(req.params.id);
  if (d.approval_status === 'approved' && d.status === 'active') throw ApiError.badRequest('This driver is already approved.');
  await transaction(async (conn) => {
    await query("UPDATE users SET status = 'active' WHERE id = ?", [d.id], conn);
    await query(
      "UPDATE driver_profiles SET approval_status = 'approved', approval_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE user_id = ?",
      [req.body.reason || null, req.user.id, d.id], conn);
    await notifyUser(d.id, 'driver_approved', 'Driver account approved',
      'Your NaicGo driver account was approved. You can now use the driver dashboard.', '/driver/dashboard', conn);
  });
  await audit(req, 'driver.approved', 'user', d.id, { reason: req.body.reason || null });
  ok(res, { id: d.id, approval_status: 'approved' });
});

exports.rejectDriver = asyncHandler(async (req, res) => {
  const d = await loadDriver(req.params.id);
  const reason = (req.body.reason || '').trim();
  if (!reason) throw new ApiError(422, 'A reason is required when rejecting an application.', [{ field: 'reason', message: 'Enter a reason.' }]);
  await transaction(async (conn) => {
    await query("UPDATE users SET status = 'rejected' WHERE id = ?", [d.id], conn);
    await query(
      "UPDATE driver_profiles SET approval_status = 'rejected', approval_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE user_id = ?",
      [reason, req.user.id, d.id], conn);
    await query('UPDATE vehicle_assignments SET is_active = 0, end_date = COALESCE(end_date, CURDATE()) WHERE driver_id = ? AND is_active = 1', [d.id], conn);
    await notifyUser(d.id, 'driver_rejected', 'Driver application not approved', `Reason: ${reason}`, null, conn);
  });
  await audit(req, 'driver.rejected', 'user', d.id, { reason });
  ok(res, { id: d.id, approval_status: 'rejected' });
});

/* ================================= Users ================================= */

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 25);
  const where = ['1=1'];
  const params = [];
  if (req.query.role) { where.push('u.role = ?'); params.push(req.query.role); }
  if (req.query.status) { where.push('u.status = ?'); params.push(req.query.status); }
  if (req.query.q) { const l = likeTerm(req.query.q); where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)'); params.push(l, l, l); }
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM users u WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.role, u.status, u.email_verified_at, u.last_login_at, u.created_at
       FROM users u WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  ok(res, rows, pageMeta(page, pageSize, total));
});

exports.setUserStatus = asyncHandler(async (req, res) => {
  const [u] = await query(
    'SELECT u.id, u.role, u.status, dp.approval_status FROM users u LEFT JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ?',
    [req.params.id]);
  if (!u) throw ApiError.notFound('User not found.');
  if (u.id === req.user.id) throw ApiError.badRequest('You cannot change the status of your own account.');
  if (u.role === 'admin') throw ApiError.forbidden('Administrator accounts are managed with the server-side admin script.');
  const { status, reason } = req.body;
  if (u.role === 'driver' && status === 'active' && u.approval_status !== 'approved') {
    throw ApiError.badRequest('Approve the driver application instead of activating the account directly.');
  }
  await query('UPDATE users SET status = ? WHERE id = ?', [status, u.id]);
  if (status !== 'active' && u.role === 'driver') {
    await query('UPDATE vehicle_assignments SET is_active = 0, end_date = COALESCE(end_date, CURDATE()) WHERE driver_id = ? AND is_active = 1', [u.id]);
  }
  await audit(req, status === 'suspended' ? 'user.suspended' : status === 'active' ? 'user.activated' : 'user.deactivated',
    'user', u.id, { from: u.status, to: status, reason: reason || null });
  ok(res, { id: u.id, status });
});

/* ======================== Driver information updates ===================== */

exports.listUpdateRequests = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const where = ['1=1'];
  const params = [];
  if (req.query.status) { where.push('r.status = ?'); params.push(req.query.status); }
  if (req.query.entity_type) { where.push('r.entity_type = ?'); params.push(req.query.entity_type); }
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM driver_update_requests r WHERE ${where.join(' AND ')}`, params);
  const rows = await query(
    `SELECT r.*, d.full_name AS driver_name, rv.full_name AS reviewer_name
       FROM driver_update_requests r JOIN users d ON d.id = r.driver_id LEFT JOIN users rv ON rv.id = r.reviewer_id
      WHERE ${where.join(' AND ')}
      ORDER BY FIELD(r.status,'pending','correction_requested','approved','rejected'), r.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]);
  ok(res, rows, pageMeta(page, pageSize, total));
});

/**
 * Review a driver's proposed change. Approval records the decision; the administrator then applies
 * the verified change through the normal management screens (so every published value is entered
 * and audited by an administrator, never copied automatically from a driver's free text).
 */
exports.reviewUpdateRequest = asyncHandler(async (req, res) => {
  const [r] = await query('SELECT * FROM driver_update_requests WHERE id = ?', [req.params.id]);
  if (!r) throw ApiError.notFound('Update request not found.');
  if (['approved', 'rejected'].includes(r.status)) throw ApiError.badRequest('This request has already been decided.');
  const { status, review_notes } = req.body;
  if (status !== 'approved' && !review_notes) {
    throw new ApiError(422, 'Please explain the decision.', [{ field: 'review_notes', message: 'Notes are required for rejections and correction requests.' }]);
  }
  await transaction(async (conn) => {
    await query('UPDATE driver_update_requests SET status = ?, review_notes = ?, reviewer_id = ?, reviewed_at = NOW() WHERE id = ?',
      [status, review_notes || null, req.user.id, r.id], conn);
    const label = { approved: 'approved', rejected: 'rejected', correction_requested: 'returned for correction' }[status];
    await notifyUser(r.driver_id, 'update_request_decision', `Update request ${label}`,
      `Your request "${r.title}" was ${label}.${review_notes ? ' Notes: ' + review_notes : ''}`, '/driver/update-requests', conn);
  });
  await audit(req, 'update_request.reviewed', 'driver_update_request', r.id, { decision: status });
  ok(res, { id: r.id, status });
});
