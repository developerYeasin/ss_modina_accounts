/**
 * Applies schema.sql to the configured database.
 * Every statement is CREATE TABLE IF NOT EXISTS, so it is safe to re-run.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
  });
  try {
    console.log(`→ migrating ${env.db.database}@${env.db.host}`);
    await conn.query(sql);
    const [tables] = await conn.query('SHOW TABLES');
    console.log(`✔ migration complete — ${tables.length} tables:`);
    tables.forEach((t) => console.log('   •', Object.values(t)[0]));
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('✖ migration failed:', err.message);
  process.exit(1);
});
