const { getEntity } = require('../models/registry');
const svc = require('../services/entityService');
const { notFound, forbidden, badRequest } = require('../utils/errors');
const { ROLE_RANK } = require('../middleware/auth');

/** Resolve :entity from the URL and stash it on the request. */
function resolveEntity(req, _res, next) {
  const entity = getEntity(req.params.entity);
  if (!entity) return next(notFound(`Unknown entity "${req.params.entity}"`));
  req.entity = entity;
  next();
}

function assertRole(req, action) {
  const need = req.entity.roles?.[action] || 'user';
  if ((ROLE_RANK[req.user.role] || 0) < (ROLE_RANK[need] || 0)) {
    throw forbidden(`${req.entity.name}: ${action} requires ${need} role`);
  }
}

/** ?filter={"status":"New"}&sort=-created_date&limit=500&search=abc */
function parseListQuery(req) {
  let filter = {};
  if (req.query.filter) {
    try {
      filter = JSON.parse(req.query.filter);
    } catch {
      throw badRequest('filter must be valid JSON');
    }
  }
  // Any other query key that matches a column is treated as an equality filter.
  for (const [k, v] of Object.entries(req.query)) {
    if (['filter', 'sort', 'limit', 'offset', 'search', 'page'].includes(k)) continue;
    if (k in req.entity.fields) filter[k] = v;
  }
  const limit = req.query.limit;
  const offset = req.query.page
    ? (Math.max(Number(req.query.page), 1) - 1) * (Number(limit) || 500)
    : req.query.offset;

  return { filter, search: req.query.search || '', sort: req.query.sort, limit, offset };
}

const asyncH = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const listRecords = asyncH(async (req, res) => {
  const opts = parseListQuery(req);
  const rows = await svc.list(req.entity, opts);
  res.json(rows);
});

const countRecords = asyncH(async (req, res) => {
  const opts = parseListQuery(req);
  res.json({ count: await svc.count(req.entity, opts) });
});

const getRecord = asyncH(async (req, res) => {
  res.json(await svc.get(req.entity, req.params.id));
});

const createRecord = asyncH(async (req, res) => {
  assertRole(req, 'write');
  if (Array.isArray(req.body)) {
    return res.status(201).json(await svc.bulkCreate(req.entity, req.body, req.user.id));
  }
  res.status(201).json(await svc.create(req.entity, req.body, req.user.id));
});

const updateRecord = asyncH(async (req, res) => {
  assertRole(req, 'write');
  res.json(await svc.update(req.entity, req.params.id, req.body));
});

const deleteRecord = asyncH(async (req, res) => {
  assertRole(req, 'delete');
  res.json(await svc.remove(req.entity, req.params.id));
});

module.exports = {
  resolveEntity, listRecords, countRecords, getRecord,
  createRecord, updateRecord, deleteRecord,
};
