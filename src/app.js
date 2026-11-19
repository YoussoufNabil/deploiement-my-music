const express = require('express');
const path = require('node:path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { notFound, errorHandler } = require('./middleware/errors');
const { localRoot, storageDriver } = require('./services/storage');

const authRoutes = require('./routes/auth.routes');
const musicRoutes = require('./routes/music.routes');
const userRoutes = require('./routes/user.routes');
const newsRoutes = require('./routes/news.routes');
const shareRoutes = require('./routes/share.routes');

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        connectSrc: ["'self'", 'https:']
      }
    }
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (storageDriver === 'local') {
    app.use('/uploads', express.static(localRoot, { fallthrough: false, maxAge: '1h' }));
  }

  app.get('/health', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      return res.json({ status: 'ok', database: 'connected', storage: storageDriver });
    } catch (_error) {
      return res.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
  });

  app.use('/api/auth', authRoutes(db));
  app.use('/api/musiques', musicRoutes(db));
  app.use('/api/users', userRoutes(db));
  app.use('/api/news', newsRoutes(db));
  app.use('/api/partages', shareRoutes(db));

  app.get('/share/:token', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
