const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { newId } = require('../utils/id');
const { signToken } = require('../middleware/auth');
const { badRequest, unauthorized, conflict, notFound } = require('../utils/errors');

const asyncH = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const publicUser = (u) => ({
  id: u.id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  photo_url: u.photo_url,
  branch_id: u.branch_id,
  active: Boolean(u.active),
  created_date: u.created_date,
});

const register = asyncH(async (req, res) => {
  const { full_name, email, password, phone } = req.body || {};
  if (!full_name || !email || !password) throw badRequest('নাম, ইমেইল ও পাসওয়ার্ড দিন');
  if (String(password).length < 6) throw badRequest('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');

  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length) throw conflict('এই ইমেইল আগে থেকেই ব্যবহৃত');

  // The very first account owns the workspace.
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM users');
  const role = Number(total) === 0 ? 'admin' : 'user';

  const id = newId();
  await query(
    `INSERT INTO users (id, full_name, email, password_hash, role, phone)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, full_name, email, await bcrypt.hash(password, 10), role, phone || null],
  );

  const [user] = await query('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

const login = asyncH(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw badRequest('ইমেইল ও পাসওয়ার্ড দিন');

  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (!rows.length) throw unauthorized('ইমেইল বা পাসওয়ার্ড ভুল');

  const user = rows[0];
  if (!(await bcrypt.compare(password, user.password_hash))) {
    throw unauthorized('ইমেইল বা পাসওয়ার্ড ভুল');
  }
  if (!user.active) throw unauthorized('অ্যাকাউন্টটি নিষ্ক্রিয়');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  res.json({ token: signToken(user), user: publicUser(user) });
});

const me = asyncH(async (req, res) => {
  res.json(publicUser(req.user));
});

const updateMe = asyncH(async (req, res) => {
  const { full_name, phone, photo_url } = req.body || {};
  await query(
    'UPDATE users SET full_name = COALESCE(?, full_name), phone = ?, photo_url = ? WHERE id = ?',
    [full_name || null, phone ?? req.user.phone, photo_url ?? req.user.photo_url, req.user.id],
  );
  const [user] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json(publicUser(user));
});

const changePassword = asyncH(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || String(new_password).length < 6) {
    throw badRequest('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
  }
  const [user] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password || '', user.password_hash))) {
    throw unauthorized('বর্তমান পাসওয়ার্ড ভুল');
  }
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [
    await bcrypt.hash(new_password, 10),
    req.user.id,
  ]);
  res.json({ success: true });
});

// ---- user administration (admin only) ----

const listUsers = asyncH(async (_req, res) => {
  const rows = await query('SELECT * FROM users ORDER BY created_date DESC');
  res.json(rows.map(publicUser));
});

const createUser = asyncH(async (req, res) => {
  const { full_name, email, password, role = 'user', phone, branch_id } = req.body || {};
  if (!full_name || !email || !password) throw badRequest('নাম, ইমেইল ও পাসওয়ার্ড দিন');
  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length) throw conflict('এই ইমেইল আগে থেকেই ব্যবহৃত');

  const id = newId();
  await query(
    `INSERT INTO users (id, full_name, email, password_hash, role, phone, branch_id, created_by_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, full_name, email, await bcrypt.hash(password, 10), role, phone || null,
      branch_id || null, req.user.id],
  );
  const [user] = await query('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json(publicUser(user));
});

const updateUser = asyncH(async (req, res) => {
  const { full_name, role, phone, branch_id, active, password } = req.body || {};
  const rows = await query('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!rows.length) throw notFound('ইউজার পাওয়া যায়নি');

  const sets = [];
  const params = [];
  if (full_name !== undefined) { sets.push('full_name = ?'); params.push(full_name); }
  if (role !== undefined) { sets.push('role = ?'); params.push(role); }
  if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
  if (branch_id !== undefined) { sets.push('branch_id = ?'); params.push(branch_id || null); }
  if (active !== undefined) { sets.push('active = ?'); params.push(active ? 1 : 0); }
  if (password) { sets.push('password_hash = ?'); params.push(await bcrypt.hash(password, 10)); }
  if (sets.length) {
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, req.params.id]);
  }
  const [user] = await query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.json(publicUser(user));
});

const deleteUser = asyncH(async (req, res) => {
  if (req.params.id === req.user.id) throw badRequest('নিজের অ্যাকাউন্ট মুছা যাবে না');
  await query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ id: req.params.id, deleted: true });
});

module.exports = {
  register, login, me, updateMe, changePassword,
  listUsers, createUser, updateUser, deleteUser, publicUser,
};
