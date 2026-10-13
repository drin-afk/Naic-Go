const { query } = require('../config/db');

/** Create a notification for one user. */
async function notifyUser(userId, type, title, message, link = null, conn) {
  if (!userId) return;
  await query(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title.slice(0, 150), message.slice(0, 500), link],
    conn
  );
}

/** Create a notification for every active administrator (dashboard alerts). */
async function notifyAdmins(type, title, message, link = null, conn) {
  const admins = await query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'", [], conn);
  for (const a of admins) await notifyUser(a.id, type, title, message, link, conn);
}

module.exports = { notifyUser, notifyAdmins };
