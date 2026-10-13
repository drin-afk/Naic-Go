/**
 * NaicGo API integration tests (node:test + supertest) — run against a REAL MySQL database.
 *
 * Prerequisites: XAMPP MySQL running, database/schema.sql AND database/seed.sql imported,
 * server/.env configured. Then from /server:   npm test
 *
 * The tests create their own uniquely-named accounts and delete them afterwards.
 */
process.env.NODE_ENV = 'test';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { query, pool } = require('../src/config/db');

const run = Date.now().toString(36);
const PW = 'Testpass123';
const made = [];

const commuterA = request.agent(app);
const commuterB = request.agent(app);
const driver = request.agent(app);
const admin = request.agent(app);

async function register(agent, kind, name, extra = {}) {
  const body = {
    full_name: `Test ${name}`, username: `t_${name}_${run}`, email: `t_${name}_${run}@test.local`,
    password: PW, confirm_password: PW, accept_terms: true, ...extra,
  };
  const res = await agent.post(`/api/auth/register-${kind}`).send(body);
  if (res.body?.data?.user) made.push(res.body.data.user.id);
  return res;
}

before(async () => {
  await query('SELECT 1');
  const hash = await bcrypt.hash(PW, 10);
  const r = await query(
    "INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES (?, ?, ?, 'Test Admin', 'admin', 'active')",
    [`t_admin_${run}`, `t_admin_${run}@test.local`, hash]);
  made.push(r.insertId);
});

after(async () => {
  if (made.length) await query('DELETE FROM users WHERE id IN (?)', [made]);
  await pool.end();
});

test('health endpoint reports database ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.database, 'ok');
});

test('guest can browse terminals without logging in', async () => {
  const res = await request(app).get('/api/terminals');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.meta.total >= 1, 'seed data should provide terminals');
});

test('route finder respects direction of documented stops', async () => {
  const fwd = await request(app).get('/api/routes').query({ from: 'Town Proper', to: 'Highway Junction' });
  assert.equal(fwd.status, 200);
  const codes = fwd.body.data.results.map((r) => r.code);
  assert.ok(codes.includes('DEMO-J01'));
  assert.ok(!codes.includes('DEMO-J02'), 'return-direction route must not match');
});

test('route finder filters by transportation type', async () => {
  const res = await request(app).get('/api/routes').query({ type: 'tricycle' });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.results.every((r) => r.vehicle_type === 'tricycle'));
});

test('route finder returns empty results (not fake data) for unknown places', async () => {
  const res = await request(app).get('/api/routes').query({ from: 'Nonexistent Place XYZ', to: 'Nowhere ABC' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.results.length, 0);
});

test('fares are published with labels', async () => {
  const res = await request(app).get('/api/fares');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((f) => typeof f.label === 'string'));
});

test('documented alternatives are returned for an obstructed route', async () => {
  const [r] = await query("SELECT id FROM routes WHERE code = 'DEMO-T01'");
  const res = await request(app).get(`/api/routes/${r.id}/alternatives`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.alternatives.some((a) => a.code === 'DEMO-T03'));
  assert.ok(res.body.data.obstructions.length >= 1);
});

test('commuter registration validates input and hashes password', async () => {
  const weak = await register(request(app), 'commuter', 'weak', { password: 'abc', confirm_password: 'abc' });
  assert.equal(weak.status, 422);

  const res = await register(commuterA, 'commuter', 'ca');
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.role, 'commuter');
  const [u] = await query('SELECT password_hash FROM users WHERE id = ?', [res.body.data.user.id]);
  assert.match(u.password_hash, /^\$2[aby]\$/);
  assert.notEqual(u.password_hash, PW);

  const dup = await register(request(app), 'commuter', 'ca');
  assert.equal(dup.status, 409);
});

test('public registration cannot create an administrator', async () => {
  const res = await register(request(app), 'commuter', 'sneaky', { role: 'admin' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.role, 'commuter');
});

test('invalid credentials return a generic error', async () => {
  const a = await request(app).post('/api/auth/login').send({ identifier: `t_ca_${run}`, password: 'WrongPass1' });
  const b = await request(app).post('/api/auth/login').send({ identifier: `nobody_${run}`, password: 'WrongPass1' });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.message, b.body.message);
});

test('role-based access control is enforced server-side', async () => {
  assert.equal((await request(app).get('/api/commuter/reports')).status, 401);
  assert.equal((await commuterA.get('/api/admin/dashboard')).status, 403);
  assert.equal((await commuterA.get('/api/driver/dashboard')).status, 403);
});

let reportId;
test('commuter submits a complaint and receives a unique reference', async () => {
  const res = await commuterA.post('/api/commuter/reports')
    .field('vehicle_type', 'jeepney')
    .field('vehicle_identifier', 'TEST-123')
    .field('incident_date', new Date().toISOString().slice(0, 10))
    .field('category', 'overcharging')
    .field('description', 'The driver charged more than the posted fare for a short trip.');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.data.reference_no, /^NG-\d{8}-[A-Z2-9]{6}$/);
  reportId = res.body.data.id;

  const dup = await commuterA.post('/api/commuter/reports')
    .field('vehicle_type', 'jeepney').field('vehicle_identifier', 'TEST-123')
    .field('incident_date', new Date().toISOString().slice(0, 10)).field('category', 'overcharging')
    .field('description', 'The driver charged more than the posted fare for a short trip.');
  assert.equal(dup.status, 409);
});

test('evidence uploads are validated by file content', async () => {
  const res = await commuterA.post('/api/commuter/reports')
    .field('vehicle_type', 'bus')
    .field('incident_date', new Date().toISOString().slice(0, 10))
    .field('category', 'unsafe_driving')
    .field('description', 'Bus was driving dangerously fast near the school zone.')
    .attach('evidence', Buffer.from('MZ fake executable content here'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
  assert.equal(res.status, 400);
});

test("a commuter cannot read another commuter's report", async () => {
  await register(commuterB, 'commuter', 'cb');
  const res = await commuterB.get(`/api/commuter/reports/${reportId}`);
  assert.equal(res.status, 404);
  const own = await commuterA.get(`/api/commuter/reports/${reportId}`);
  assert.equal(own.status, 200);
});

let driverId;
test('driver registration starts pending and blocks protected features', async () => {
  const res = await register(driver, 'driver', 'drv', { vehicle_type: 'jeepney', association_name: 'Test Assoc' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.approval_status, 'pending');
  driverId = res.body.data.user.id;
  assert.equal((await driver.get('/api/driver/dashboard')).status, 403);
  assert.equal((await driver.get('/api/driver/profile')).status, 200);
});

test('administrator approves driver; driver gains access', async () => {
  const login = await admin.post('/api/auth/login').send({ identifier: `t_admin_${run}`, password: PW });
  assert.equal(login.status, 200);
  const ap = await admin.post(`/api/admin/drivers/${driverId}/approve`).send({});
  assert.equal(ap.status, 200);
  assert.equal((await driver.get('/api/driver/dashboard')).status, 200);
  const [log] = await query("SELECT id FROM audit_logs WHERE action = 'driver.approved' AND entity_id = ?", [driverId]);
  assert.ok(log, 'approval must be audit-logged');
});

test('driver can only report availability for assigned vehicles', async () => {
  const [v] = await query("SELECT id FROM vehicles WHERE identifier = 'DEMO-JEEP-001'");
  const denied = await driver.post('/api/driver/availability').send({ vehicle_id: v.id, status: 'available' });
  assert.equal(denied.status, 403);
  const asg = await admin.post('/api/admin/assignments').send({ driver_id: driverId, vehicle_id: v.id, start_date: new Date().toISOString().slice(0, 10) });
  assert.equal(asg.status, 201, JSON.stringify(asg.body));
  const okRes = await driver.post('/api/driver/availability').send({ vehicle_id: v.id, status: 'available' });
  assert.equal(okRes.status, 201);
});

test('admin reviews complaint; private notes never reach the commuter', async () => {
  const bad = await admin.patch(`/api/admin/reports/${reportId}`).send({ status: 'rejected' });
  assert.equal(bad.status, 422, 'rejection requires a reason');
  const res = await admin.patch(`/api/admin/reports/${reportId}`).send({ status: 'under_review', admin_notes: 'SECRET internal note', public_note: 'We are reviewing your report.' });
  assert.equal(res.status, 200);
  const view = await commuterA.get(`/api/commuter/reports/${reportId}`);
  assert.equal(view.body.data.status, 'under_review');
  assert.ok(!JSON.stringify(view.body).includes('SECRET'));
  assert.equal(view.body.data.admin_notes, undefined);
});

test('drivers cannot access complaint data', async () => {
  assert.equal((await driver.get(`/api/admin/reports/${reportId}`)).status, 403);
  assert.equal((await driver.get(`/api/commuter/reports/${reportId}`)).status, 403);
});

test('data persists in MySQL', async () => {
  const [r] = await query('SELECT reference_no, status FROM driver_reports WHERE id = ?', [reportId]);
  assert.equal(r.status, 'under_review');
});

test('logout clears the session', async () => {
  await commuterA.post('/api/auth/logout');
  assert.equal((await commuterA.get('/api/auth/me')).status, 401);
});
