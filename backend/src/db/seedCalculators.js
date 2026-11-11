/**
 * Loads the starting rate tables for the map calculators (জানালা / কার্টেন ওয়াল /
 * সিলিং) from data/calculator-products.json. Each table is filled only while it is
 * still empty, so re-running never duplicates or overwrites rates edited in the app.
 *
 *   npm run seed:calculators
 */
const path = require('path');
const { pool, query } = require('../config/db');
const { newId } = require('../utils/id');
const data = require(path.join(__dirname, 'data', 'calculator-products.json'));

async function fill(table, rows) {
  const [{ n }] = await query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  if (Number(n) > 0) { console.log(`• ${table}: already has ${n} rows — skipped`); return; }
  const cols = Object.keys(rows[0]);
  const sql = `INSERT INTO \`${table}\` (id, ${cols.map((c) => `\`${c}\``).join(', ')}) VALUES ?`;
  const values = rows.map((r) => [newId(), ...cols.map((c) => (r[c] === undefined ? null : r[c]))]);
  await pool.query(sql, [values]);
  console.log(`✔ ${table}: inserted ${rows.length} rows`);
}

(async () => {
  try {
    await fill('map_products', data.map);
    await fill('curtain_wall_products', data.cw);
    await fill('curtain_wall_hardware', data.cwHardware);
  } catch (err) {
    console.error('✖ calculator seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
