const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing auth' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'bad auth' });
  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'invalid token' });
  }
}

module.exports = (db) => {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'missing' });
    const hash = bcrypt.hashSync(password, 10);
    await db.read();
    const exists = db.data.users.find(u => u.username === username);
    if (exists) return res.status(400).json({ error: 'user exists' });
    const id = (db.data.users.reduce((m, u) => Math.max(m, u.id || 0), 0) || 0) + 1;
    const user = { id, username, password_hash: hash, is_admin: 0 };
    db.data.users.push(user);
    await db.write();
    const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    await db.read();
    const row = db.data.users.find(u => u.username === username);
    if (!row) return res.status(400).json({ error: 'no user' });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'bad credentials' });
    const user = { id: row.id, username: row.username, is_admin: !!row.is_admin };
    const token = jwt.sign(user, JWT_SECRET);
    res.json({ token, user });
  });

  router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });

  router.post('/change-password', authMiddleware, async (req, res) => {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ error: 'missing' });
    await db.read();
    const user = db.data.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'no user' });
    const ok = bcrypt.compareSync(old_password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'bad credentials' });
    user.password_hash = bcrypt.hashSync(new_password, 10);
    await db.write();
    res.json({ ok: true });
  });

  // Admin: list users (without password hashes)
  router.get('/list', authMiddleware, async (req, res) => {
    if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'forbidden' });
    await db.read();
    const users = (db.data.users || []).map(u => ({ id: u.id, username: u.username, is_admin: !!u.is_admin }));
    res.json(users);
  });

  // Admin: reset password for a user
  router.post('/reset/:id', authMiddleware, async (req, res) => {
    if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'forbidden' });
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'missing' });
    await db.read();
    const user = db.data.users.find(u => String(u.id) === String(id));
    if (!user) return res.status(404).json({ error: 'no user' });
    user.password_hash = bcrypt.hashSync(new_password, 10);
    await db.write();
    res.json({ ok: true });
  });

  router.auth = authMiddleware;
  return router;
};
