const express = require('express');

function hasMeaningfulText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    await db.read();
    res.json(db.data.sightings || []);
  });

  router.post('/', async (req, res) => {
    const { user_id, species_id, notes } = req.body;
    if (!hasMeaningfulText(user_id) || !hasMeaningfulText(species_id)) {
      return res.status(400).json({ error: 'missing' });
    }
    await db.read();
    const id = (db.data.sightings.reduce((m, s) => Math.max(m, s.id || 0), 0) || 0) + 1;
    const rec = { id, user_id: user_id || null, species_id: species_id || null, notes: notes || null, created_at: new Date().toISOString() };
    db.data.sightings.unshift(rec);
    await db.write();
    res.json({ id });
  });

  return router;
};
