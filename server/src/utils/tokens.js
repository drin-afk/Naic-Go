const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signSession = (user) =>
  jwt.sign({ sub: String(user.id), role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
    issuer: 'naicgo',
  });

const verifySession = (token) => jwt.verify(token, env.jwt.secret, { issuer: 'naicgo' });

/** Random single-use token; only its SHA-256 hash is stored in the database. */
function makeOneTimeToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: sha256(token) };
}
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
  };
}

/** Complaint reference: NG-YYYYMMDD-XXXXXX (random, unguessable suffix). */
function complaintReference() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `NG-${ymd}-${suffix}`;
}

module.exports = { signSession, verifySession, makeOneTimeToken, sha256, cookieOptions, complaintReference };
