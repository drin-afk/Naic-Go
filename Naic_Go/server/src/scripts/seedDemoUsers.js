/**
 * Creates DEMONSTRATION user accounts, assignments and availability reports for development/usability testing.
 * Requires database/seed.sql to be imported first (it uses the DEMO vehicles/routes/terminals).
 *
 *   npm run seed:demo-users
 *
 * Password for every demo account: value of DEMO_PASSWORD env var, or "Demo@12345".
 * Refuses to run when NODE_ENV=production.
 */
const bcrypt = require('bcrypt');
const env = require('../config/env');
const { query, transaction, pool } = require('../config/db');

const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';

const users = [
  { username: 'demo_commuter', email: 'commuter@demo.naicgo.local', full_name: 'Demo Commuter', role: 'commuter', status: 'active' },
  { username: 'demo_jeep_driver', email: 'jeep.driver@demo.naicgo.local', full_name: 'Demo Jeepney Driver', role: 'driver', status: 'active', type: 'jeepney', approval: 'approved' },
  { username: 'demo_tric_driver', email: 'tric.driver@demo.naicgo.local', full_name: 'Demo Tricycle Driver', role: 'driver', status: 'active', type: 'tricycle', approval: 'approved' },
  { username: 'demo_pending_driver', email: 'pending.driver@demo.naicgo.local', full_name: 'Demo Pending Driver', role: 'driver', status: 'pending', type: 'bus', approval: 'pending' },
];

(async () => {
  try {
    if (env.isProd) throw new Error('Refusing to create demo accounts when NODE_ENV=production.');
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM vehicles WHERE identifier LIKE 'DEMO-%'");
    if (!n) throw new Error('Demo vehicles not found. Import database/seed.sql first.');
    const hash = await bcrypt.hash(PASSWORD, 12);

    await transaction(async (conn) => {
      const ids = {};
      for (const u of users) {
        const [existing] = await query('SELECT id FROM users WHERE username = ?', [u.username], conn);
        if (existing) { ids[u.username] = existing.id; continue; }
        const r = await query(
          `INSERT INTO users (username, email, password_hash, full_name, role, status, email_verified_at, terms_accepted_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`, [u.username, u.email, hash, u.full_name, u.role, u.status], conn);
        ids[u.username] = r.insertId;
        if (u.role === 'commuter') {
          await query('INSERT INTO commuter_profiles (user_id) VALUES (?)', [r.insertId], conn);
        } else {
          const [vt] = await query('SELECT id FROM vehicle_types WHERE code = ?', [u.type], conn);
          await query(
            `INSERT INTO driver_profiles (user_id, vehicle_type_id, association_name, approval_status, reviewed_at)
             VALUES (?, ?, 'Demo Drivers Association', ?, ?)`,
            [r.insertId, vt.id, u.approval, u.approval === 'approved' ? new Date() : null], conn);
        }
      }

      const assign = async (driver, vehicleIdent, routeCode, terminalName) => {
        const [v] = await query('SELECT id FROM vehicles WHERE identifier = ?', [vehicleIdent], conn);
        const [r] = await query('SELECT id FROM routes WHERE code = ?', [routeCode], conn);
        const [t] = await query('SELECT id FROM terminals WHERE name = ?', [terminalName], conn);
        const exists = await query('SELECT id FROM vehicle_assignments WHERE driver_id = ? AND vehicle_id = ? AND is_active = 1', [ids[driver], v.id], conn);
        if (!exists.length) {
          await query(
            `INSERT INTO vehicle_assignments (driver_id, vehicle_id, route_id, terminal_id, start_date, is_active, notes)
             VALUES (?, ?, ?, ?, CURDATE(), 1, 'Demo assignment')`, [ids[driver], v.id, r?.id || null, t?.id || null], conn);
        }
        return { vehicleId: v.id, terminalId: t?.id || null };
      };
      const j1 = await assign('demo_jeep_driver', 'DEMO-JEEP-001', 'DEMO-J01', 'DEMO Terminal A – Town Proper');
      const j2 = await assign('demo_jeep_driver', 'DEMO-JEEP-002', 'DEMO-J02', 'DEMO Terminal C – Highway Junction');
      const t1 = await assign('demo_tric_driver', 'DEMO-TRI-001', 'DEMO-T01', 'DEMO Terminal A – Town Proper');
      const t2 = await assign('demo_tric_driver', 'DEMO-TRI-002', 'DEMO-T03', 'DEMO Terminal B – Public Market Area');

      // One fresh and one outdated report so both UI states can be demonstrated.
      await query(`INSERT INTO vehicle_availability_reports (vehicle_id, driver_id, terminal_id, status, note, reported_at) VALUES
        (?, ?, ?, 'available', 'Demo report', NOW()),
        (?, ?, ?, 'unavailable', 'Demo report (old)', DATE_SUB(NOW(), INTERVAL 1 DAY)),
        (?, ?, ?, 'available', 'Demo report', DATE_SUB(NOW(), INTERVAL 20 MINUTE)),
        (?, ?, ?, 'temporarily_suspended', 'Demo report', DATE_SUB(NOW(), INTERVAL 10 MINUTE))`,
      [j1.vehicleId, ids.demo_jeep_driver, j1.terminalId,
       j2.vehicleId, ids.demo_jeep_driver, j2.terminalId,
       t1.vehicleId, ids.demo_tric_driver, t1.terminalId,
       t2.vehicleId, ids.demo_tric_driver, t2.terminalId], conn);
    });

    console.log('\n✔ Demo accounts ready (DEMONSTRATION ONLY):');
    for (const u of users) console.log(`   ${u.role.padEnd(8)}  ${u.username.padEnd(20)}  status: ${u.approval || u.status}`);
    console.log(`   Password for all demo accounts: ${process.env.DEMO_PASSWORD ? '(from DEMO_PASSWORD)' : PASSWORD}`);
    console.log('   Create the administrator separately with: npm run create-admin\n');
  } catch (err) {
    console.error(`\n✖ ${err.code === 'ECONNREFUSED' ? 'Cannot connect to MySQL — is it running in XAMPP?' : err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
