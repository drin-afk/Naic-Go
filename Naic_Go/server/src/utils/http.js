/** Application error with an HTTP status code. */
class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
  static badRequest(msg = 'Invalid request.', errors) { return new ApiError(400, msg, errors); }
  static unauthorized(msg = 'Authentication required.') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to perform this action.') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found.') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict.') { return new ApiError(409, msg); }
}

/** Wrap an async route handler so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Consistent JSON success envelope. */
function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}
const created = (res, data) => ok(res, data, undefined, 201);

/** Parse page / pageSize query params with sane bounds. */
function paginate(req, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(req.query.pageSize, 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
function pageMeta(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Choose a safe ORDER BY from a whitelist. */
function sortClause(req, allowed, fallback) {
  const key = String(req.query.sort || '');
  const col = allowed[key] || allowed[fallback];
  const dir = String(req.query.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return `${col} ${dir}`;
}

/** Escape LIKE wildcards in user input. */
const likeTerm = (s) => `%${String(s).replace(/[\\%_]/g, (m) => '\\' + m)}%`;

module.exports = { ApiError, asyncHandler, ok, created, paginate, pageMeta, sortClause, likeTerm };
