const express = require('express');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    await db.read();
    res.json(db.data.species || []);
  });

  router.get('/:id', async (req, res) => {
    await db.read();
    const item = db.data.species.find(s => String(s.id) === String(req.params.id) || s.slug === req.params.id);
    if (!item) return res.status(404).end();
    res.json(item);
  });

  router.post('/', async (req, res) => {
    const { slug, name, data } = req.body;
    if (!nonEmptyString(slug) || !nonEmptyString(name)) {
      return res.status(400).json({ error: 'missing' });
    }
    await db.read();
    const id = (db.data.species.reduce((m, s) => Math.max(m, s.id || 0), 0) || 0) + 1;
    const item = { id, slug, name, data: data || {} };
    db.data.species.push(item);
    await db.write();
    res.json({ id });
  });

  router.put('/:id', async (req, res) => {
    await db.read();
    const item = db.data.species.find(s => String(s.id) === String(req.params.id));
    if (!item) return res.status(404).end();
    Object.assign(item, req.body);
    if (!nonEmptyString(item.slug) || !nonEmptyString(item.name)) {
      return res.status(400).json({ error: 'bad species' });
    }
    await db.write();
    res.json({ ok: true });
  });

  router.delete('/:id', async (req, res) => {
    await db.read();
    db.data.species = db.data.species.filter(s => String(s.id) !== String(req.params.id));
    await db.write();
    res.json({ ok: true });
  });

  return router;
};
