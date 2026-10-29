const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';

function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined && !isProd) return fallback;
    if (fallback !== undefined && isProd && name !== 'JWT_SECRET') return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const jwtSecret = required('JWT_SECRET', isProd ? undefined : 'dev-only-insecure-secret-change-me');
if (isProd && (jwtSecret.length < 32 || jwtSecret.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be a long random value in production.');
}

module.exports = {
  isProd,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: required('DB_NAME', 'naicgo_db'),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  cookieName: 'naicgo_session',
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  availabilityFreshMinutes: parseInt(process.env.AVAILABILITY_FRESH_MINUTES || '120', 10),
  upload: {
    dir: path.resolve(__dirname, '../..', process.env.UPLOAD_DIR || 'storage/evidence'),
    maxBytes: parseFloat(process.env.UPLOAD_MAX_MB || '5') * 1024 * 1024,
    maxFiles: parseInt(process.env.UPLOAD_MAX_FILES || '3', 10),
  },
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.MAIL_FROM || 'NaicGo <no-reply@naicgo.local>',
  },
  trustProxy: process.env.TRUST_PROXY === 'true',
};
