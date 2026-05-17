const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.get('/:speciesId', async (req, res) => {
    await db.read();
    const rows = (db.data.comments || []).filter(c => String(c.species_id) === String(req.params.speciesId));
    res.json(rows);
  });

  router.post('/:speciesId', async (req, res) => {
    const speciesId = req.params.speciesId;
    const { user_id, text } = req.body;
    await db.read();
    const id = (db.data.comments.reduce((m, c) => Math.max(m, c.id || 0), 0) || 0) + 1;
    const rec = { id, user_id: user_id || null, species_id: speciesId, text: text || null, created_at: new Date().toISOString() };
    db.data.comments.unshift(rec);
    await db.write();
    res.json({ id });
  });

  return router;
};
