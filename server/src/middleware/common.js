const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const env = require('../config/env');
const { ApiError } = require('../utils/http');

/** Return 422 with field errors if express-validator rules failed. */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: e.msg }));
  return res.status(422).json({ success: false, message: 'Please correct the highlighted fields.', errors });
}

/**
 * Basic CSRF defence for cookie-authenticated, state-changing requests:
 * if the browser sends an Origin header it must be one of the allowed client origins.
 * (SameSite=Lax cookies already block most cross-site POSTs; this is defence in depth.)
 */
function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // non-browser clients / same-origin navigations
  const selfOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin === selfOrigin || env.clientOrigin.includes(origin)) return next();
  return next(ApiError.forbidden('Request origin not allowed.'));
}

const limiter = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
    skip: () => process.env.NODE_ENV === 'test',
  });

const rateLimiters = {
  api: limiter(15, 1000, 'Too many requests. Please try again later.'),
  auth: limiter(15, 20, 'Too many login or registration attempts. Please wait 15 minutes and try again.'),
  passwordReset: limiter(60, 5, 'Too many password reset requests. Please try again later.'),
  complaint: limiter(60, 5, 'You have submitted several reports recently. Please wait before submitting another.'),
};

/** Evidence upload: memory storage, then validated & written to private storage by the controller. */
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxBytes, files: env.upload.maxFiles, fields: 30 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Evidence must be a JPG, PNG, WEBP image or a PDF file.'));
    }
    cb(null, true);
  },
});

/** Verify file signature ("magic bytes") — the declared MIME type alone is not trusted. */
function detectFileType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (buffer.slice(0, 5).toString('ascii') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? `Each file must be ${Math.round(env.upload.maxBytes / 1048576)} MB or smaller.`
      : err.code === 'LIMIT_FILE_COUNT'
        ? `You can attach up to ${env.upload.maxFiles} files.`
        : 'File upload failed.';
    return res.status(400).json({ success: false, message: msg });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request is too large.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON body.' });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'A record with the same unique value already exists.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ success: false, message: 'A referenced record does not exist.' });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ success: false, message: 'This record is in use by other records. Archive or deactivate it instead.' });
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR') {
    console.error('[db]', err.code, err.message);
    return res.status(503).json({ success: false, message: 'The database is unavailable. Please make sure MySQL is running.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    ...(err.errors ? { errors: err.errors } : {}),
  });
}

module.exports = { validate, originCheck, rateLimiters, evidenceUpload, detectFileType, notFound, errorHandler, ALLOWED_MIME };
