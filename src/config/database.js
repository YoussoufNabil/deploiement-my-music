const mysql = require('mysql2/promise');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

async function resolveDatabasePassword() {
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;

  const parameterName = process.env.DB_PASSWORD_PARAMETER || '/my-music/prod/app_db_password';
  if (!parameterName) {
    throw new Error('DB_PASSWORD or DB_PASSWORD_PARAMETER must be configured.');
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  const client = new SSMClient({ region });
  const result = await client.send(new GetParameterCommand({
    Name: parameterName,
    WithDecryption: true
  }));

  if (!result.Parameter || !result.Parameter.Value) {
    throw new Error(`SSM parameter ${parameterName} is empty or unavailable.`);
  }
  return result.Parameter.Value;
}

async function createDatabasePool() {
  const password = await resolveDatabasePassword();
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'app_user',
    password,
    database: process.env.DB_NAME || 'my_music',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    timezone: 'Z',
    charset: 'utf8mb4'
  });
}

async function waitForDatabase(pool, attempts = 30, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      return;
    } catch (error) {
      lastError = error;
      console.error(`Database not ready (${attempt}/${attempts}): ${error.message}`);
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Unable to connect to MySQL after ${attempts} attempts: ${lastError?.message}`);
}

module.exports = { createDatabasePool, waitForDatabase };
