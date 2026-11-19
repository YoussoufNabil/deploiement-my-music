require('dotenv').config();
const { createDatabasePool, waitForDatabase } = require('./config/database');
const { createApp } = require('./app');

async function main() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set JWT_SECRET to a random value of at least 32 characters.');
  }

  const db = await createDatabasePool();
  await waitForDatabase(db);
  const app = createApp(db);
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(port, host, () => {
    console.log(`My Music API listening on http://${host}:${port}`);
    console.log(`Storage driver: ${process.env.STORAGE_DRIVER || (process.env.S3_BUCKET ? 's3' : 'local')}`);
  });

  const shutdown = signal => {
    console.log(`${signal} received; shutting down...`);
    server.close(async () => {
      await db.end().catch(error => console.error('Error closing database pool:', error));
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
  console.error('Application startup failed:', error);
  process.exit(1);
});
