const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const { authenticate } = require('../middleware/auth');
const storage = require('../services/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    if (file.fieldname === 'audio' && !file.mimetype.startsWith('audio/')) {
      return callback(new Error('The audio field must contain an audio file.'));
    }
    if (file.fieldname === 'cover' && !file.mimetype.startsWith('image/')) {
      return callback(new Error('The cover field must contain an image.'));
    }
    return callback(null, true);
  }
}).fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

module.exports = function musicRoutes(db) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const search = String(req.query.q || '').trim();
      const params = [];
      let where = '';
      if (search) {
        where = 'WHERE (m.titre LIKE ? OR m.artiste LIKE ? OR m.genre LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }
      const [rows] = await db.execute(`
        SELECT m.id, m.titre, m.artiste, m.genre, m.description,
               m.cover_key, m.mime_type, m.created_at,
               u.name AS uploader_name,
               COALESCE(l.likes_count, 0) AS likes_count,
               COALESCE(d.total, 0) AS downloads
        FROM musiques m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN (SELECT musique_id, COUNT(*) AS likes_count FROM likes GROUP BY musique_id) l
          ON l.musique_id = m.id
        LEFT JOIN nb_telechargements d ON d.musique_id = m.id
        ${where}
        ORDER BY m.created_at DESC
        LIMIT 100
      `, params);
      const music = await Promise.all(rows.map(async item => ({
        ...item,
        cover_url: await storage.getFileUrl(item.cover_key)
      })));
      return res.json({ music });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        `SELECT m.id, m.titre, m.artiste, m.genre, m.description, m.cover_key,
                m.mime_type, m.created_at, u.name AS uploader_name
         FROM musiques m JOIN users u ON u.id = m.user_id WHERE m.id = ? LIMIT 1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Track not found.' });
      const item = rows[0];
      item.cover_url = await storage.getFileUrl(item.cover_key);
      return res.json({ music: item });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id/stream', async (req, res, next) => {
    try {
      const [rows] = await db.execute('SELECT id, audio_key FROM musiques WHERE id = ? LIMIT 1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Track not found.' });
      await db.execute(`
        INSERT INTO nb_telechargements (musique_id, total, last_downloaded_at)
        VALUES (?, 1, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE total = total + 1, last_downloaded_at = CURRENT_TIMESTAMP
      `, [req.params.id]);
      return res.json({ url: await storage.getFileUrl(rows[0].audio_key), expires_in: Number(process.env.S3_SIGNED_URL_TTL || 300) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', authenticate, (req, res, next) => {
    upload(req, res, async error => {
      if (error) return next(error);
      try {
        const audio = req.files?.audio?.[0];
        const cover = req.files?.cover?.[0];
        const titre = String(req.body.titre || '').trim();
        const artiste = String(req.body.artiste || '').trim();
        if (!audio) return res.status(400).json({ error: 'An audio file is required (field: audio).' });
        if (!titre || !artiste) return res.status(400).json({ error: 'Title and artist are required.' });

        const audioKey = await storage.saveFile(audio, 'audio');
        let coverKey = null;
        try {
          if (cover) coverKey = await storage.saveFile(cover, 'covers');
          const [result] = await db.execute(
            `INSERT INTO musiques (user_id, titre, artiste, genre, description, audio_key, cover_key, mime_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, titre, artiste, req.body.genre || null, req.body.description || null,
             audioKey, coverKey, audio.mimetype || 'application/octet-stream']
          );
          return res.status(201).json({ id: result.insertId, message: 'Track uploaded.' });
        } catch (dbError) {
          await storage.deleteFile(audioKey).catch(() => {});
          if (coverKey) await storage.deleteFile(coverKey).catch(() => {});
          throw dbError;
        }
      } catch (uploadError) {
        return next(uploadError);
      }
    });
  });

  router.post('/:id/like', authenticate, async (req, res, next) => {
    try {
      await db.execute('INSERT IGNORE INTO likes (user_id, musique_id) VALUES (?, ?)', [req.user.id, req.params.id]);
      const [[count]] = await db.execute('SELECT COUNT(*) AS likes_count FROM likes WHERE musique_id = ?', [req.params.id]);
      return res.json({ liked: true, likes_count: count.likes_count });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id/like', authenticate, async (req, res, next) => {
    try {
      await db.execute('DELETE FROM likes WHERE user_id = ? AND musique_id = ?', [req.user.id, req.params.id]);
      const [[count]] = await db.execute('SELECT COUNT(*) AS likes_count FROM likes WHERE musique_id = ?', [req.params.id]);
      return res.json({ liked: false, likes_count: count.likes_count });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/share', authenticate, async (req, res, next) => {
    try {
      const [tracks] = await db.execute('SELECT id FROM musiques WHERE id = ? LIMIT 1', [req.params.id]);
      if (!tracks.length) return res.status(404).json({ error: 'Track not found.' });
      const token = randomUUID();
      await db.execute('INSERT INTO partages (musique_id, user_id, share_token) VALUES (?, ?, ?)', [req.params.id, req.user.id, token]);
      return res.status(201).json({ share_token: token, share_url: `/share/${token}` });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id', authenticate, async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, user_id, audio_key, cover_key FROM musiques WHERE id = ? LIMIT 1',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Track not found.' });
      if (Number(rows[0].user_id) !== Number(req.user.id)) return res.status(403).json({ error: 'You cannot delete this track.' });
      await db.execute('DELETE FROM musiques WHERE id = ?', [req.params.id]);
      await Promise.all([storage.deleteFile(rows[0].audio_key), storage.deleteFile(rows[0].cover_key)]);
      return res.json({ message: 'Track deleted.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
};
