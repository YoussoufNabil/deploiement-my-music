const express = require('express');
const storage = require('../services/storage');

module.exports = function userRoutes(db) {
  const router = express.Router();
  router.get('/:id', async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, name, bio, avatar_key, created_at FROM users WHERE id = ? LIMIT 1',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'User not found.' });
      const [counts] = await db.execute('SELECT COUNT(*) AS tracks_count FROM musiques WHERE user_id = ?', [req.params.id]);
      const user = rows[0];
      user.avatar_url = await storage.getFileUrl(user.avatar_key);
      user.tracks_count = counts[0].tracks_count;
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  });
  return router;
};
