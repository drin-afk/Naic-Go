const env = require('../config/env');
const { query } = require('../config/db');
const { verifySession } = require('../utils/tokens');
const { ApiError } = require('../utils/http');

/**
 * Load the session user from the HTTP-only cookie.
 * The role/status are ALWAYS read from the database — never trusted from the token or client —
 * so suspensions and role changes take effect immediately.
 */
async function loadUser(req) {
  const token = req.cookies?.[env.cookieName];
  if (!token) return null;
  let payload;
  try {
    payload = verifySession(token);
  } catch {
    return null;
  }
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.role, u.status, u.email_verified_at,
            dp.approval_status
       FROM users u
       LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.id = ? LIMIT 1`,
    [payload.sub]
  );
  const user = rows[0];
  if (!user) return null;
  // Only active accounts and drivers awaiting approval keep a session.
  if (!['active', 'pending'].includes(user.status)) return null;
  return user;
}

const authenticate = async (req, res, next) => {
  try {
    const user = await loadUser(req);
    if (!user) {
      res.clearCookie(env.cookieName, { path: '/' });
      return next(ApiError.unauthorized('Please log in to continue.'));
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/** Attach req.user if a valid session exists, but never block the request. */
const optionalAuth = async (req, res, next) => {
  try {
    req.user = (await loadUser(req)) || null;
  } catch {
    req.user = null;
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

/** Account must be fully active (not pending approval). */
const requireActive = (req, res, next) => {
  if (req.user?.status !== 'active') {
    return next(ApiError.forbidden('Your account is not active yet.'));
  }
  next();
};

/** Drivers may use protected driver features only after administrator approval. */
const requireApprovedDriver = (req, res, next) => {
  if (req.user?.role !== 'driver') return next(ApiError.forbidden());
  if (req.user.status !== 'active' || req.user.approval_status !== 'approved') {
    return next(ApiError.forbidden('Your driver account is awaiting administrator approval.'));
  }
  next();
};

module.exports = { authenticate, optionalAuth, requireRole, requireActive, requireApprovedDriver };
