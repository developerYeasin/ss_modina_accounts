const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

async function start() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`✔ MySQL connected: ${env.db.database}@${env.db.host}`);
  } catch (err) {
    console.error('✖ MySQL connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`✔ SS Modina API listening on http://localhost:${env.port}/api`);
  });

  const shutdown = (signal) => async () => {
    console.log(`\n${signal} received, shutting down…`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

start();
