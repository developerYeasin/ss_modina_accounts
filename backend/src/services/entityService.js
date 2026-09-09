const { query, pool } = require('../config/db');
const { newId } = require('../utils/id');
const { badRequest, notFound } = require('../utils/errors');
const { buildWhere, buildOrderBy, buildLimit } = require('./queryBuilder');

/** Coerce an incoming value to the column's declared type. */
function coerce(type, value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') {
    return type === 'number' ? 0 : type === 'boolean' ? 0 : null;
  }
  switch (type) {
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    case 'boolean':
      return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
    case 'date':
      return String(value).slice(0, 10);
    case 'datetime':
      return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    default:
      return String(value);
  }
}

/** Keep only declared fields, coerced. Unknown keys are dropped silently. */
function pickFields(entity, payload = {}) {
  const out = {};
  for (const [key, type] of Object.entries(entity.fields)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const v = coerce(type, payload[key]);
      if (v !== undefined) out[key] = v;
    }
  }
  return out;
}

/** Normalise a row on the way out: booleans as booleans, decimals as numbers. */
function serialize(entity, row) {
  if (!row) return row;
  const out = { ...row };
  for (const [key, type] of Object.entries(entity.fields)) {
    if (!(key in out)) continue;
    if (type === 'boolean') out[key] = Boolean(out[key]);
    else if (type === 'number' && out[key] !== null) out[key] = Number(out[key]);
  }
  for (const key of ['created_date', 'updated_date']) {
    if (out[key] instanceof Date) out[key] = out[key].toISOString();
  }
  return out;
}

async function list(entity, { filter = {}, search = '', sort, limit, offset } = {}) {
  const where = buildWhere(entity, filter, search);
  const order = buildOrderBy(entity, sort);
  const page = buildLimit(limit, offset);
  const rows = await query(
    `SELECT * FROM \`${entity.table}\` ${where.sql} ${order} ${page.sql}`,
    where.params,
  );
  return rows.map((r) => serialize(entity, r));
}

async function count(entity, { filter = {}, search = '' } = {}) {
  const where = buildWhere(entity, filter, search);
  const rows = await query(
    `SELECT COUNT(*) AS total FROM \`${entity.table}\` ${where.sql}`,
    where.params,
  );
  return Number(rows[0].total);
}

async function get(entity, id, conn) {
  const sql = `SELECT * FROM \`${entity.table}\` WHERE id = ? LIMIT 1`;
  const rows = conn ? (await conn.execute(sql, [id]))[0] : await query(sql, [id]);
  if (!rows.length) throw notFound(`${entity.name} not found`);
  return serialize(entity, rows[0]);
}

async function create(entity, payload, userId, conn = pool) {
  const data = pickFields(entity, payload);
  const id = payload.id || newId();
  const cols = ['id', 'created_by_id', ...Object.keys(data)];
  const vals = [id, userId || null, ...Object.values(data)];
  await conn.execute(
    `INSERT INTO \`${entity.table}\` (${cols.map((c) => `\`${c}\``).join(',')})
     VALUES (${cols.map(() => '?').join(',')})`,
    vals,
  );
  return get(entity, id, conn === pool ? undefined : conn);
}

async function bulkCreate(entity, items = [], userId) {
  if (!Array.isArray(items) || !items.length) throw badRequest('Expected a non-empty array');
  const created = [];
  for (const item of items) created.push(await create(entity, item, userId));
  return created;
}

async function update(entity, id, payload, conn = pool) {
  const data = pickFields(entity, payload);
  const readConn = conn === pool ? undefined : conn;
  if (!Object.keys(data).length) return get(entity, id, readConn);
  const sets = Object.keys(data).map((c) => `\`${c}\` = ?`).join(', ');
  const [res] = await conn.execute(
    `UPDATE \`${entity.table}\` SET ${sets} WHERE id = ?`,
    [...Object.values(data), id],
  );
  if (!res.affectedRows) throw notFound(`${entity.name} not found`);
  return get(entity, id, readConn);
}

async function remove(entity, id, conn = pool) {
  const [res] = await conn.execute(`DELETE FROM \`${entity.table}\` WHERE id = ?`, [id]);
  if (!res.affectedRows) throw notFound(`${entity.name} not found`);
  return { id, deleted: true };
}

module.exports = {
  list, count, get, create, bulkCreate, update, remove,
  pickFields, serialize, coerce,
};
