/**
 * Applies schema.sql to the configured database.
 * Every statement is CREATE TABLE IF NOT EXISTS, so it is safe to re-run.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

/**
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS cannot
 * add them to a table that already exists, so each is applied only when the
 * column is genuinely missing — which keeps `npm run migrate` re-runnable.
 */
const ADDED_COLUMNS = [
  ['suppliers', 'opening_due', 'DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER materials_supplied'],
];

async function addMissingColumns(conn) {
  for (const [table, column, definition] of ADDED_COLUMNS) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [env.db.database, table, column],
    );
    if (rows.length) continue;
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`   + ${table}.${column}`);
  }
}

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
    await addMissingColumns(conn);
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
