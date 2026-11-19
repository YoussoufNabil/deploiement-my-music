const test = require('node:test');
const assert = require('node:assert/strict');

test('package exposes the expected Node.js entry point', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.main, 'src/server.js');
  assert.equal(pkg.type, 'commonjs');
});

test('the SQL schema declares the six report table names', () => {
  const fs = require('node:fs');
  const sql = fs.readFileSync(require('node:path').join(__dirname, '../database/schema.sql'), 'utf8');
  for (const table of ['users', 'musiques', 'likes', 'nb_telechargements', 'news', 'partages']) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'));
  }
});
