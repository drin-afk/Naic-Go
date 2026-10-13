const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.smtp.host) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
  });
}

const isConfigured = () => Boolean(transporter);

/**
 * Send an email. When SMTP is not configured:
 *  - development: the message (including links) is printed to the server console;
 *  - production: nothing is sent and a warning is logged.
 */
async function sendMail({ to, subject, text }) {
  if (transporter) {
    await transporter.sendMail({ from: env.smtp.from, to, subject, text });
    return true;
  }
  if (!env.isProd) {
    console.log('\n========== [DEV EMAIL — SMTP not configured] ==========');
    console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
    console.log('=======================================================\n');
  } else {
    console.warn('[mail] SMTP not configured; email to', to, 'was not sent.');
  }
  return false;
}

module.exports = { sendMail, isConfigured };
