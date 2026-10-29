const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
  dateStrings: true,       // return DATE/DATETIME as strings (avoids timezone shifts)
  decimalNumbers: true,    // DECIMAL -> JS number for coordinates/fares
  timezone: 'local',
});

/**
 * Run a parameterized query and return rows.
 * Uses mysql2's placeholder escaping (`?`), so user input is never concatenated into SQL.
 * pool.query (rather than execute) is used so IN (?) lists and LIMIT ? work consistently
 * on both MySQL and the MariaDB bundled with XAMPP.
 */
async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

/** Run fn(conn) inside a transaction; commits on success, rolls back on error. */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  await pool.query('SELECT 1');
}

module.exports = { pool, query, transaction, ping };
