const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { unauthorized, forbidden } = require('../utils/errors');

const ROLE_RANK = { user: 1, manager: 2, admin: 3 };

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('Missing access token');

    let payload;
    try {
      payload = jwt.verify(token, env.jwt.secret);
    } catch {
      throw unauthorized('Invalid or expired token');
    }

    const rows = await query(
      `SELECT id, full_name, email, role, phone, photo_url, branch_id, active,
              created_date, updated_date
         FROM users WHERE id = ? LIMIT 1`,
      [payload.sub],
    );
    if (!rows.length) throw unauthorized('User no longer exists');
    if (!rows[0].active) throw forbidden('Account is disabled');

    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

/** requireRole('manager') allows manager and admin. */
function requireRole(minRole) {
  return (req, _res, next) => {
    const have = ROLE_RANK[req.user?.role] || 0;
    const need = ROLE_RANK[minRole] || 0;
    if (have < need) return next(forbidden(`Requires ${minRole} role`));
    next();
  };
}

module.exports = { signToken, authenticate, requireRole, ROLE_RANK };
