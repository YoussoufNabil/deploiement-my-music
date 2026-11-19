const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { authenticate, createToken, setAuthCookie } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' }
});

module.exports = function authRoutes(db) {
  const router = express.Router();

  router.post('/register', loginLimiter, async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Name must contain 2 to 100 characters.' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
      if (password.length < 10) return res.status(400).json({ error: 'Password must contain at least 10 characters.' });

      const [existing] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (existing.length) return res.status(409).json({ error: 'An account already exists for this email.' });

      const passwordHash = await bcrypt.hash(password, 12);
      const [result] = await db.execute(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [name, email, passwordHash]
      );
      const user = { id: result.insertId, name, email };
      setAuthCookie(res, createToken(user));
      return res.status(201).json({ user });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use.' });
      return next(error);
    }
  });

  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const [rows] = await db.execute(
        'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
        [email]
      );
      const user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }
      setAuthCookie(res, createToken(user));
      return res.json({ user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie('my_music_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.json({ message: 'Signed out.' });
  });

  router.get('/me', authenticate, async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, name, email, avatar_key, bio, created_at FROM users WHERE id = ? LIMIT 1',
        [req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'User not found.' });
      return res.json({ user: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  return router;
};
