const { badRequest } = require('../utils/errors');

/** Columns every table carries; they are filterable/sortable but never written directly. */
const SYSTEM_COLUMNS = ['id', 'created_date', 'updated_date', 'created_by_id'];

const OPERATORS = {
  $eq: '=', $ne: '<>', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=',
  $like: 'LIKE', $in: 'IN', $nin: 'NOT IN',
};

function assertColumn(entity, col) {
  const known = Object.keys(entity.fields).concat(SYSTEM_COLUMNS);
  if (!known.includes(col)) throw badRequest(`Unknown field "${col}" on ${entity.name}`);
  return col;
}

/**
 * Build the WHERE clause from a filter object.
 * Values may be scalars ({status:"New"}) or operator objects
 * ({date:{$gte:"2026-01-01",$lte:"2026-01-31"}}).
 */
function buildWhere(entity, filter = {}, search = '') {
  const clauses = [];
  const params = [];

  for (const [col, cond] of Object.entries(filter)) {
    if (cond === undefined) continue;
    assertColumn(entity, col);

    if (cond === null) {
      clauses.push(`\`${col}\` IS NULL`);
      continue;
    }

    if (typeof cond === 'object' && !Array.isArray(cond)) {
      for (const [op, value] of Object.entries(cond)) {
        const sqlOp = OPERATORS[op];
        if (!sqlOp) throw badRequest(`Unsupported operator "${op}"`);
        if (op === '$in' || op === '$nin') {
          const list = Array.isArray(value) ? value : [value];
          if (!list.length) { clauses.push(op === '$in' ? '1=0' : '1=1'); continue; }
          clauses.push(`\`${col}\` ${sqlOp} (${list.map(() => '?').join(',')})`);
          params.push(...list);
        } else {
          clauses.push(`\`${col}\` ${sqlOp} ?`);
          params.push(value);
        }
      }
      continue;
    }

    if (Array.isArray(cond)) {
      if (!cond.length) { clauses.push('1=0'); continue; }
      clauses.push(`\`${col}\` IN (${cond.map(() => '?').join(',')})`);
      params.push(...cond);
      continue;
    }

    clauses.push(`\`${col}\` = ?`);
    params.push(cond);
  }

  const term = String(search || '').trim();
  if (term && entity.search && entity.search.length) {
    const ors = entity.search.map((c) => `\`${c}\` LIKE ?`);
    clauses.push(`(${ors.join(' OR ')})`);
    entity.search.forEach(() => params.push(`%${term}%`));
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

/** "-created_date" => ORDER BY `created_date` DESC. Multiple keys comma-separated. */
function buildOrderBy(entity, sort) {
  const spec = sort || entity.sort || '-created_date';
  const parts = String(spec)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const desc = s.startsWith('-');
      const col = assertColumn(entity, desc ? s.slice(1) : s);
      return `\`${col}\` ${desc ? 'DESC' : 'ASC'}`;
    });
  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

function buildLimit(limit, offset) {
  const l = Math.min(Math.max(Number(limit) || 500, 1), 5000);
  const o = Math.max(Number(offset) || 0, 0);
  return { sql: `LIMIT ${l} OFFSET ${o}`, limit: l, offset: o };
}

module.exports = { buildWhere, buildOrderBy, buildLimit, SYSTEM_COLUMNS };
