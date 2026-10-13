const env = require('./config/env');
const app = require('./app');
const { ping, pool } = require('./config/db');

const server = app.listen(env.port, async () => {
  console.log(`NaicGo API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  try {
    await ping();
    console.log(`Connected to MySQL database "${env.db.name}" at ${env.db.host}:${env.db.port}`);
  } catch (err) {
    console.error(`\n[!] Could not connect to MySQL (${err.code || err.message}).`);
    console.error('    Start MySQL in the XAMPP Control Panel and check DB_* values in server/.env\n');
  }
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
