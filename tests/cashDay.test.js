const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { getCurrentLocalDateStr } = require('../.test-build/src/shared/utils/dates');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Real in-memory SQLite, with an async adapter for the Expo repository API.
// This checks SQL and rollback; native connection locking still needs device QA.
const fixture = (afterWrite = () => {}) => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE cash_state (id INTEGER PRIMARY KEY, denominations_json TEXT, updated_at TEXT);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE cash_movements (
      id INTEGER PRIMARY KEY, type TEXT, total_cents INTEGER,
      denominations_json TEXT, note TEXT, created_at TEXT
    );
    INSERT INTO cash_state VALUES (1, '{"100":5}', 'old');
    INSERT INTO app_settings VALUES ('cash_state_last_reset_day', '2000-01-01');
    INSERT INTO app_settings VALUES ('cash_counter_draft', '{"100":"2"}');
  `);
  let failResetMarker = false;
  const executor = {
    async getAllAsync(sql, params = []) { return sqlite.prepare(sql).all(...params); },
    async runAsync(sql, params = []) {
      if (failResetMarker && params[0] === 'cash_state_last_reset_day') throw new Error('marker write failed');
      const result = sqlite.prepare(sql).run(...params);
      afterWrite();
      return result;
    },
  };
  let tail = Promise.resolve();
  const db = {
    ...executor,
    withExclusiveTransactionAsync(task) {
      const operation = tail.then(async () => {
        sqlite.exec('BEGIN');
        try {
          await task(executor);
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      });
      tail = operation.catch(() => {});
      return operation;
    },
  };
  const dbPath = path.resolve(__dirname, '../.test-build/src/data/db/sqlite.js');
  const repoPath = path.resolve(__dirname, '../.test-build/src/data/repositories/cashRepo.js');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getDb: async () => db } };
  delete require.cache[repoPath];
  const { cashRepo } = require(repoPath);
  return {
    cashRepo, sqlite,
    failMarker: () => { failResetMarker = true; },
    state: () => JSON.parse(sqlite.prepare('SELECT denominations_json FROM cash_state').get().denominations_json),
    resetDay: () => sqlite.prepare("SELECT value FROM app_settings WHERE key = 'cash_state_last_reset_day'").get().value,
    close: () => sqlite.close(),
  };
};

test('first movement of a new day resets the old balance atomically and survives a late refresh', async () => {
  const f = fixture();
  try {
    await f.cashRepo.applyMovement('IN', { 100: 2 });
    assert.equal(f.state()['100'], 2, 'old-day balance must not carry into today');
    assert.equal(f.resetDay(), getCurrentLocalDateStr());
    assert.equal(await f.cashRepo.resetCashStateIfNewDay(), false);
    assert.equal(f.state()['100'], 2, 'late daily refresh must not erase the new movement');
    assert.deepEqual(await f.cashRepo.getCashCounterDraft(), { 100: '2' });
    assert.equal((await f.cashRepo.listCashMovements()).length, 1);
  } finally { f.close(); }
});

test('reset and confirmation preserve new-day money in either execution order', async () => {
  for (const resetFirst of [true, false]) {
    const f = fixture();
    try {
      const reset = () => f.cashRepo.resetCashStateIfNewDay();
      const movement = () => f.cashRepo.applyMovement('IN', { 50: 3 });
      await Promise.all(resetFirst ? [reset(), movement()] : [movement(), reset()]);
      assert.equal(f.state()['50'], 3);
      assert.equal(f.state()['100'], 0);
      assert.equal((await f.cashRepo.listCashMovements()).length, 1);
    } finally { f.close(); }
  }
});

test('a cash operation spanning midnight uses one date for both marker and movement', async () => {
  const RealDate = global.Date;
  const before = new RealDate(2026, 11, 31, 23, 59, 59, 999);
  let clockMs = before.getTime();
  const f = fixture(() => { clockMs = new RealDate(2027, 0, 1, 0, 0, 0, 50).getTime(); });
  try {
    global.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [clockMs])); }
      static now() { return clockMs; }
    };
    await f.cashRepo.applyMovement('IN', { 50: 1 });
    const [movement] = await f.cashRepo.listCashMovements();
    assert.equal(movement.created_at, before.toISOString());
    assert.equal(f.resetDay(), getCurrentLocalDateStr(before));
  } finally {
    global.Date = RealDate;
    f.close();
  }
});

test('a failed day-marker write rolls back the cash reset', async () => {
  const f = fixture();
  try {
    f.failMarker();
    await assert.rejects(() => f.cashRepo.resetCashStateIfNewDay(), /marker write failed/);
    assert.deepEqual(f.state(), { 100: 5 });
    assert.equal(f.resetDay(), '2000-01-01');
  } finally { f.close(); }
});

test('a rejected new-day withdrawal cannot consume yesterday cash or partially commit the reset', async () => {
  const f = fixture();
  try {
    await assert.rejects(() => f.cashRepo.applyMovement('OUT', { 100: 1 }), /No hay suficientes/);
    assert.deepEqual(f.state(), { 100: 5 });
    assert.equal(f.resetDay(), '2000-01-01');
    assert.equal((await f.cashRepo.listCashMovements()).length, 0);
    await f.cashRepo.resetCashStateIfNewDay();
    assert.equal(f.state()['100'], 0);
  } finally { f.close(); }
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try { await fn(); console.log(`ok - ${name}`); }
    catch (error) { failed++; console.error(`not ok - ${name}`, error); }
  }
  console.log(`${tests.length - failed}/${tests.length} SQLite day-boundary tests passed`);
  if (failed) process.exitCode = 1;
})();
