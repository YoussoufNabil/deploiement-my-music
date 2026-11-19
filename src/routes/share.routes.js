const express = require('express');
const storage = require('../services/storage');

module.exports = function shareRoutes(db) {
  const router = express.Router();
  router.get('/:token', async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        `SELECT m.id, m.titre, m.artiste, m.cover_key, p.created_at AS shared_at
         FROM partages p JOIN musiques m ON m.id = p.musique_id
         WHERE p.share_token = ? LIMIT 1`,
        [req.params.token]
      );
      if (!rows.length) return res.status(404).json({ error: 'Share link not found.' });
      const track = rows[0];
      track.cover_url = await storage.getFileUrl(track.cover_key);
      track.stream_url = `/api/musiques/${track.id}/stream`;
      return res.json({ music: track });
    } catch (error) {
      return next(error);
    }
  });
  return router;
};
