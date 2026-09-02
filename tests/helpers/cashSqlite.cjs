const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const buildRoot = path.join(__dirname, '..', '..', '.test-build', 'src');

// Real SQLite and the application's migrations/repository. Only the Expo bridge
// is replaced. This checks SQL/rollback, not Android scheduling or native locks.
async function createCashDatabase(filename = ':memory:') {
  let connection = new DatabaseSync(filename);
  const executor = {
    async getAllAsync(sql, params = []) {
      return connection.prepare(sql).all(...params).map(row => ({ ...row }));
    },
    async getFirstAsync(sql, params = []) {
      const row = connection.prepare(sql).get(...params);
      return row ? { ...row } : null;
    },
    async runAsync(sql, params = []) {
      const result = connection.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async execAsync(sql) {
      connection.exec(sql);
    },
  };
  const transaction = async fn => {
    connection.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn(executor);
      connection.exec('COMMIT');
      return result;
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
  };
  const db = {
    ...executor,
    withExclusiveTransactionAsync: transaction,
    withTransactionAsync: fn => transaction(() => fn()),
  };

  for (const name of ['sqlite.js', 'index.js']) {
    const filename = path.join(buildRoot, 'data', 'db', name);
    require.cache[filename] = { id: filename, filename, loaded: true, exports: { getDb: async () => db } };
  }
  const load = relative => {
    const filename = path.join(buildRoot, relative);
    delete require.cache[require.resolve(filename)];
    return require(filename);
  };
  const { runMigrations } = load('data/db/migrations.js');
  await runMigrations();
  const { cashRepo } = load('data/repositories/cashRepo.js');
  const { salesRepo } = load('data/repositories/salesRepo.js');
  const { withdrawalsRepo } = load('data/repositories/withdrawalsRepo.js');

  return {
    db,
    cashRepo,
    salesRepo,
    withdrawalsRepo,
    runMigrations,
    async snapshot() {
      return {
        cash: await db.getAllAsync('SELECT * FROM cash_state ORDER BY id'),
        movements: await db.getAllAsync('SELECT * FROM cash_movements ORDER BY id'),
        settings: await db.getAllAsync('SELECT * FROM app_settings ORDER BY key'),
      };
    },
    reopen() {
      if (filename === ':memory:') throw new Error('Reopening requires a file database');
      connection.close();
      connection = new DatabaseSync(filename);
    },
    close() { connection.close(); },
  };
}

module.exports = { createCashDatabase };
