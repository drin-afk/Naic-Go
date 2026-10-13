/**
 * Secure administrator initialisation.
 * Public registration can NEVER create administrators — use this script on the server instead.
 *
 * Usage (from the server folder):
 *   npm run create-admin
 * or non-interactively:
 *   npm run create-admin -- --username admin --email admin@example.com --name "System Administrator"
 *   (the password is always typed at a hidden prompt, or supplied via the ADMIN_PASSWORD env variable)
 */
const readline = require('readline');
const bcrypt = require('bcrypt');
const { query, pool } = require('../config/db');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write('*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const strong = (p) => p.length >= 10 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

(async () => {
  try {
    const username = arg('username') || (await ask('Admin username: '));
    const email = (arg('email') || (await ask('Admin email: '))).toLowerCase();
    const fullName = arg('name') || (await ask('Full name: '));
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw new Error('Username must be 3-40 letters, numbers, dots, dashes or underscores.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Invalid email address.');
    if (fullName.length < 2) throw new Error('Full name is required.');

    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = await ask('Password (min 10 chars, upper, lower, number): ', { hidden: true });
      const confirm = await ask('Confirm password: ', { hidden: true });
      if (password !== confirm) throw new Error('Passwords do not match.');
    }
    if (!strong(password)) throw new Error('Password must be at least 10 characters with uppercase, lowercase and a number.');

    const existing = await query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) throw new Error('A user with that username or email already exists.');

    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role, status, email_verified_at, terms_accepted_at)
       VALUES (?, ?, ?, ?, 'admin', 'active', NOW(), NOW())`, [username, email, hash, fullName]);
    await query("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES (?, 'admin.initialized', 'user', ?, ?)",
      [r.insertId, r.insertId, JSON.stringify({ via: 'create-admin script' })]);
    console.log(`\n✔ Administrator "${username}" created (id ${r.insertId}). You can now log in at /login.`);
  } catch (err) {
    console.error(`\n✖ ${err.code === 'ECONNREFUSED' ? 'Cannot connect to MySQL — is it running in XAMPP?' : err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
