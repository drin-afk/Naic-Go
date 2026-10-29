const { query } = require('../config/db');
const { asyncHandler, ok, paginate, pageMeta } = require('../utils/http');

exports.list = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = paginate(req, 20);
  const unreadOnly = req.query.unread === 'true';
  const where = `user_id = ?${unreadOnly ? ' AND read_at IS NULL' : ''}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM notifications WHERE ${where}`, [req.user.id]);
  const [{ unread }] = await query('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
  const rows = await query(
    `SELECT id, type, title, message, link, read_at, created_at FROM notifications WHERE ${where}
      ORDER BY id DESC LIMIT ? OFFSET ?`, [req.user.id, pageSize, offset]);
  ok(res, rows, { ...pageMeta(page, pageSize, total), unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  // user_id condition guarantees users can only change their own notifications
  await query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL', [req.params.id, req.user.id]);
  ok(res, { id: req.params.id });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
  ok(res, { done: true });
});
