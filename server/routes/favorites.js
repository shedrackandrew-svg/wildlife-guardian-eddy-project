const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/:userId', async (req, res) => {
    await db.read();
    const rows = (db.data.favorites || []).filter(f => String(f.user_id) === String(req.params.userId));
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const { user_id, species_id } = req.body;
    await db.read();
    const exists = db.data.favorites.find(f => String(f.user_id) === String(user_id) && String(f.species_id) === String(species_id));
    if (!exists) db.data.favorites.push({ user_id, species_id });
    await db.write();
    res.json({ ok: true });
  });

  router.delete('/', async (req, res) => {
    const { user_id, species_id } = req.body;
    await db.read();
    db.data.favorites = (db.data.favorites || []).filter(f => !(String(f.user_id) === String(user_id) && String(f.species_id) === String(species_id)));
    await db.write();
    res.json({ ok: true });
  });

  return router;
};
