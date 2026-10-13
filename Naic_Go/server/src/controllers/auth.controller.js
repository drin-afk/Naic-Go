const bcrypt = require('bcrypt');
const env = require('../config/env');
const { query, transaction } = require('../config/db');
const { ApiError, asyncHandler, ok, created } = require('../utils/http');
const { signSession, makeOneTimeToken, sha256, cookieOptions } = require('../utils/tokens');
const { audit } = require('../utils/audit');
const { notifyAdmins } = require('../utils/notify');
const { sendMail } = require('../utils/mailer');

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the account exists (reduces enumeration).
const DUMMY_HASH = bcrypt.hashSync('naicgo-timing-equalizer', BCRYPT_ROUNDS);

const appUrl = (p) => `${env.clientOrigin[0].replace(/\/$/, '')}${p}`;

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    status: u.status,
    email_verified: Boolean(u.email_verified_at),
    approval_status: u.role === 'driver' ? u.approval_status || 'pending' : undefined,
  };
}

function setSessionCookie(res, user) {
  res.cookie(env.cookieName, signSession(user), cookieOptions());
}

async function ensureUnique(username, email) {
  const rows = await query('SELECT username, email FROM users WHERE username = ? OR email = ?', [username, email]);
  if (rows.length) {
    const errors = [];
    if (rows.some((r) => r.username.toLowerCase() === username.toLowerCase())) errors.push({ field: 'username', message: 'This username is already taken.' });
    if (rows.some((r) => r.email.toLowerCase() === email.toLowerCase())) errors.push({ field: 'email', message: 'An account with this email already exists.' });
    throw new ApiError(409, 'An account with these details already exists.', errors);
  }
}

async function sendVerificationEmail(userId, email, conn) {
  const { token, hash } = makeOneTimeToken();
  await query(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
    [userId, hash], conn
  );
  // Sent after commit by caller (non-blocking).
  return () => sendMail({
    to: email,
    subject: 'Verify your NaicGo email address',
    text: `Welcome to NaicGo!\n\nVerify your email address within 24 hours:\n${appUrl(`/verify-email?token=${token}`)}\n\nIf you did not create this account, ignore this email.`,
  }).catch((e) => console.error('[mail]', e.message));
}

exports.registerCommuter = asyncHandler(async (req, res) => {
  const { full_name, username, email, password, contact_number } = req.body;
  await ensureUnique(username, email);
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let sendLater;
  const userId = await transaction(async (conn) => {
    const r = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role, status, terms_accepted_at)
       VALUES (?, ?, ?, ?, 'commuter', 'active', NOW())`,
      [username, email, hash, full_name], conn
    );
    await query('INSERT INTO commuter_profiles (user_id, contact_number) VALUES (?, ?)', [r.insertId, contact_number || null], conn);
    sendLater = await sendVerificationEmail(r.insertId, email, conn);
    return r.insertId;
  });
  sendLater();

  const [user] = await query('SELECT * FROM users WHERE id = ?', [userId]);
  req.user = user;
  await audit(req, 'auth.register_commuter', 'user', userId);
  setSessionCookie(res, user);
  created(res, { user: publicUser(user) });
});

exports.registerDriver = asyncHandler(async (req, res) => {
  const { full_name, username, email, password, contact_number, vehicle_type, operator_name, association_name, vehicle_details } = req.body;
  await ensureUnique(username, email);
  const [vt] = await query('SELECT id FROM vehicle_types WHERE code = ?', [vehicle_type]);
  if (!vt) throw ApiError.badRequest('Unknown transportation type.');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let sendLater;
  const userId = await transaction(async (conn) => {
    const r = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role, status, terms_accepted_at)
       VALUES (?, ?, ?, ?, 'driver', 'pending', NOW())`,
      [username, email, hash, full_name], conn
    );
    await query(
      `INSERT INTO driver_profiles (user_id, contact_number, vehicle_type_id, operator_name, association_name, vehicle_details, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [r.insertId, contact_number || null, vt.id, operator_name || null, association_name || null, vehicle_details || null], conn
    );
    await notifyAdmins('driver_registration', 'New driver registration',
      `${full_name} registered as a ${vehicle_type} driver and is awaiting approval.`, '/admin/drivers?approval=pending', conn);
    sendLater = await sendVerificationEmail(r.insertId, email, conn);
    return r.insertId;
  });
  sendLater();

  const [user] = await query('SELECT u.*, dp.approval_status FROM users u JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ?', [userId]);
  req.user = user;
  await audit(req, 'auth.register_driver', 'user', userId);
  setSessionCookie(res, user);
  created(res, { user: publicUser(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const rows = await query(
    `SELECT u.*, dp.approval_status FROM users u LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.username = ? OR u.email = ? LIMIT 1`,
    [identifier, identifier.toLowerCase()]
  );
  const user = rows[0];
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) {
    await audit(req, 'auth.login_failed', 'user', user ? user.id : null, { identifier: identifier.slice(0, 60) });
    throw ApiError.unauthorized('Invalid username/email or password.');
  }
  if (user.status === 'suspended') throw ApiError.forbidden('This account has been suspended. Please contact the NaicGo administrator.');
  if (user.status === 'rejected') throw ApiError.forbidden('This driver application was not approved. Please contact the NaicGo administrator.');
  if (user.status === 'inactive') throw ApiError.forbidden('This account is inactive. Please contact the NaicGo administrator.');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  req.user = user;
  await audit(req, 'auth.login', 'user', user.id);
  setSessionCookie(res, user);
  ok(res, { user: publicUser(user) });
});

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie(env.cookieName, { ...cookieOptions() });
  ok(res, { loggedOut: true });
});

exports.me = asyncHandler(async (req, res) => {
  const [unread] = await query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
  ok(res, { user: publicUser(req.user), unread_notifications: unread.n });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const [user] = await query("SELECT id, email, full_name FROM users WHERE email = ? AND status IN ('active','pending')", [email]);
  if (user) {
    const { token, hash } = makeOneTimeToken();
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);
    await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))', [user.id, hash]);
    req.user = user;
  await audit(req, 'auth.password_reset_requested', 'user', user.id);
    sendMail({
      to: user.email,
      subject: 'Reset your NaicGo password',
      text: `Hello ${user.full_name},\n\nUse this link within 30 minutes to reset your password:\n${appUrl(`/reset-password?token=${token}`)}\n\nIf you did not request this, you can ignore this email.`,
    }).catch((e) => console.error('[mail]', e.message));
  }
  // Same response either way to avoid revealing which emails are registered.
  ok(res, { message: 'If an account exists for that email, a password reset link has been sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const [row] = await query(
    'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
    [sha256(token)]
  );
  if (!row) throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await transaction(async (conn) => {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id], conn);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [row.user_id], conn);
  });
  req.user = { id: row.user_id };
  await audit(req, 'auth.password_reset', 'user', row.user_id);
  ok(res, { message: 'Your password has been reset. You can now log in.' });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const [row] = await query(
    'SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
    [sha256(req.body.token)]
  );
  if (!row) throw ApiError.badRequest('This verification link is invalid or has expired.');
  await transaction(async (conn) => {
    await query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [row.user_id], conn);
    await query('UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [row.user_id], conn);
  });
  ok(res, { message: 'Your email address has been verified.' });
});

exports.resendVerification = asyncHandler(async (req, res) => {
  if (req.user.email_verified_at) return ok(res, { message: 'Your email is already verified.' });
  const send = await sendVerificationEmail(req.user.id, req.user.email);
  send();
  ok(res, { message: 'A new verification link has been sent to your email.' });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const [u] = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password, u.password_hash))) {
    throw new ApiError(400, 'Current password is incorrect.', [{ field: 'current_password', message: 'Current password is incorrect.' }]);
  }
  const hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  await audit(req, 'auth.password_changed', 'user', req.user.id);
  ok(res, { message: 'Password updated.' });
});

exports.publicUser = publicUser;
exports.BCRYPT_ROUNDS = BCRYPT_ROUNDS;
