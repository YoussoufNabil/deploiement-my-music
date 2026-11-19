const express = require('express');
const storage = require('../services/storage');

module.exports = function newsRoutes(db) {
  const router = express.Router();
  router.get('/', async (_req, res, next) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, titre, contenu, image_key, published_at FROM news ORDER BY published_at DESC LIMIT 30'
      );
      const items = await Promise.all(rows.map(async item => ({ ...item, image_url: await storage.getFileUrl(item.image_key) })));
      return res.json({ news: items });
    } catch (error) {
      return next(error);
    }
  });
  return router;
};
