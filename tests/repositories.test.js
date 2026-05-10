const assert = require('node:assert/strict');
const path = require('node:path');

const buildRoot = path.join(__dirname, '..', '.test-build');
const dbIndexPath = path.join(buildRoot, 'src', 'data', 'db', 'index.js');
const dbSqlitePath = path.join(buildRoot, 'src', 'data', 'db', 'sqlite.js');

const tests = [];
const test = (name, fn) => {
  tests.push({ name, fn });
};

const loadFresh = (modulePath) => {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  return require(resolved);
};

const createMockDb = ({ all = [], first = [], run = [] } = {}) => {
  const calls = [];
  const db = {
    calls,
    allQueue: [...all],
    firstQueue: [...first],
    runQueue: [...run],
    async getAllAsync(sql, params = []) {
      calls.push({ method: 'getAllAsync', sql, params });
      const value = db.allQueue.length ? db.allQueue.shift() : [];
      return typeof value === 'function' ? value(sql, params) : value;
    },
    async getFirstAsync(sql, params = []) {
      calls.push({ method: 'getFirstAsync', sql, params });
      const value = db.firstQueue.length ? db.firstQueue.shift() : undefined;
      return typeof value === 'function' ? value(sql, params) : value;
    },
    async runAsync(sql, params = []) {
      calls.push({ method: 'runAsync', sql, params });
      const value = db.runQueue.length ? db.runQueue.shift() : {};
      return typeof value === 'function' ? value(sql, params) : value;
    },
    async withTransactionAsync(fn) {
      calls.push({ method: 'withTransactionAsync' });
      return await fn();
    },
    async execAsync(sql) {
      calls.push({ method: 'execAsync', sql, params: [] });
    },
  };
  return db;
};

const installDbMock = (db) => {
  const mockModule = {
    id: dbIndexPath,
    filename: dbIndexPath,
    loaded: true,
    exports: { getDb: async () => db },
  };
  require.cache[dbIndexPath] = mockModule;
  require.cache[dbSqlitePath] = { ...mockModule, id: dbSqlitePath, filename: dbSqlitePath };
};

const getRunCalls = (db) => db.calls.filter(call => call.method === 'runAsync');
const getAllCalls = (db) => db.calls.filter(call => call.method === 'getAllAsync');
const getFirstCalls = (db) => db.calls.filter(call => call.method === 'getFirstAsync');

test('productsRepo maps active products and applies search parameters', async () => {
  const db = createMockDb({
    all: [[
      { id: 1, name: 'Cafe', price_cents: 250, active: 1, updated_at: 10 },
    ]],
  });
  installDbMock(db);
  const { productsRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'productsRepo.js'));

  const result = await productsRepo.listActiveProducts('ca');

  assert.deepEqual(result, [{ id: 1, name: 'Cafe', priceCents: 250, active: 1, updatedAt: 10 }]);
  assert.match(getAllCalls(db)[0].sql, /name LIKE \?/);
  assert.deepEqual(getAllCalls(db)[0].params, ['%ca%']);
});

test('productsRepo creates, updates and deactivates products', async () => {
  const db = createMockDb();
  installDbMock(db);
  const { productsRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'productsRepo.js'));

  await productsRepo.createProduct('Cafe', 250);
  await productsRepo.updateProduct(1, { name: 'Cafe grande', priceCents: 300 });
  await productsRepo.deactivateProduct(1);

  const runCalls = getRunCalls(db);
  assert.match(runCalls[0].sql, /INSERT INTO products/);
  assert.deepEqual(runCalls[0].params.slice(0, 2), ['Cafe', 250]);
  assert.match(runCalls[1].sql, /UPDATE products SET name = \?/);
  assert.deepEqual(runCalls[1].params.slice(0, 2), ['Cafe grande', 300]);
  assert.match(runCalls[2].sql, /UPDATE products SET active = 0/);
  assert.equal(runCalls[2].params[1], 1);
});

test('withdrawalsRepo maps, sums, creates and deletes withdrawals', async () => {
  const db = createMockDb({
    all: [[{ id: 1, created_at: 1000, amount_cents: 500, reason: 'Taxi' }]],
    first: [{ total: 700 }],
  });
  installDbMock(db);
  const { withdrawalsRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'withdrawalsRepo.js'));

  await withdrawalsRepo.createWithdrawal(500, '', 1000);
  const list = await withdrawalsRepo.listWithdrawalsByRange(1, 2);
  const sum = await withdrawalsRepo.sumWithdrawalsByRange(1, 2);
  await withdrawalsRepo.deleteWithdrawal(1);

  assert.equal(getRunCalls(db)[0].params[1], null);
  assert.deepEqual(list, [{ id: 1, createdAt: 1000, amountCents: 500, reason: 'Taxi' }]);
  assert.equal(sum, 700);
  assert.match(getRunCalls(db)[1].sql, /DELETE FROM withdrawals/);
});

test('salesRepo creates a sale with snapshot items inside a transaction', async () => {
  const db = createMockDb({
    run: [{ lastInsertRowId: 42 }, {}, {}],
  });
  installDbMock(db);
  const { salesRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'salesRepo.js'));

  await salesRepo.createSale({
    createdAtMs: 1000,
    items: [
      { productId: 1, productNameSnapshot: 'Cafe', unitPriceSnapshotCents: 250, qty: 2 },
      { productId: 2, productNameSnapshot: 'Pan', unitPriceSnapshotCents: 125, qty: 4 },
    ],
  });

  assert.equal(db.calls[0].method, 'withTransactionAsync');
  const runCalls = getRunCalls(db);
  assert.deepEqual(runCalls[0].params, [1000, 1000]);
  assert.deepEqual(runCalls[1].params, [42, 1, 'Cafe', 250, 2, 500]);
  assert.deepEqual(runCalls[2].params, [42, 2, 'Pan', 125, 4, 500]);
});

test('salesRepo maps reads and summary records', async () => {
  const db = createMockDb({
    all: [
      [{ id: 1, created_at: 1000, total_cents: 750 }],
      [{ id: 10, sale_id: 1, product_id: 2, product_name_snapshot: 'Pan', unit_price_snapshot_cents: 125, qty: 6, line_total_cents: 750 }],
      [
        { sale_id: 1, product_name_snapshot: 'Cafe', qty: 2 },
        { sale_id: 1, product_name_snapshot: 'Pan', qty: 3 },
      ],
      [{ product_name_snapshot: 'Cafe', total_qty: 5 }],
    ],
    first: [{ total: 900 }],
  });
  installDbMock(db);
  const { salesRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'salesRepo.js'));

  assert.deepEqual(await salesRepo.listSalesByRange(1, 2), [{ id: 1, createdAt: 1000, totalCents: 750 }]);
  assert.deepEqual(await salesRepo.getSaleItems(1), [{
    id: 10,
    saleId: 1,
    productId: 2,
    productNameSnapshot: 'Pan',
    unitPriceSnapshotCents: 125,
    qty: 6,
    lineTotalCents: 750,
  }]);
  assert.equal(await salesRepo.sumSalesByRange(1, 2), 900);
  assert.deepEqual(await salesRepo.getSaleItemsSummaryMap([1, 2]), { 1: 'Cafe x2, Pan x3', 2: '' });
  assert.deepEqual(await salesRepo.getProductsSoldSummary(1, 2), [{ productName: 'Cafe', totalQty: 5 }]);
});

test('salesRepo updates, recalculates, deletes and stores draft totals', async () => {
  const db = createMockDb({
    first: [
      { qty: 2, unit_price_snapshot_cents: 250 },
      { total: 1200 },
      { value: '345' },
    ],
  });
  installDbMock(db);
  const { salesRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'salesRepo.js'));

  await salesRepo.updateSaleItem(10, { qty: 3 });
  assert.deepEqual(getRunCalls(db)[0].params, [3, 250, 750, 10]);

  assert.equal(await salesRepo.recalcSaleTotal(1), 1200);
  assert.deepEqual(getRunCalls(db)[1].params, [1200, 1]);

  await salesRepo.deleteSale(1);
  assert.equal(db.calls.filter(call => call.method === 'withTransactionAsync').length, 1);
  assert.match(getRunCalls(db)[2].sql, /DELETE FROM sale_items/);
  assert.match(getRunCalls(db)[3].sql, /DELETE FROM sales/);

  assert.equal(await salesRepo.getCurrentSaleDraftTotal(), 345);
  await salesRepo.setCurrentSaleDraftTotal(999);
  assert.deepEqual(getRunCalls(db)[4].params, ['sale_current_total_cents', '999']);
});

test('salesRepo applySaleEdits handles update, delete, add and empty sale cleanup', async () => {
  const db = createMockDb({
    first: [
      { qty: 1, unit_price_snapshot_cents: 100 },
      { total: 500 },
      { count: 0 },
    ],
  });
  installDbMock(db);
  const { salesRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'salesRepo.js'));

  await salesRepo.applySaleEdits(7, [
    { type: 'update', itemId: 1, qty: 2, unitPriceSnapshotCents: 150 },
    { type: 'delete', itemId: 2 },
    { type: 'add', productId: 3, productNameSnapshot: 'Jugo', unitPriceSnapshotCents: 200, qty: 1 },
  ]);

  const runCalls = getRunCalls(db);
  assert.deepEqual(runCalls[0].params, [2, 150, 300, 1]);
  assert.match(runCalls[1].sql, /DELETE FROM sale_items WHERE id/);
  assert.deepEqual(runCalls[2].params, [7, 3, 'Jugo', 200, 1, 200]);
  assert.deepEqual(runCalls[3].params, [500, 7]);
  assert.match(runCalls[4].sql, /DELETE FROM sales/);
});

test('cashRepo reads and persists cash state, draft and movements', async () => {
  const db = createMockDb({
    all: [
      [{ denominations_json: '{"100":2}', updated_at: 'now' }],
      [{ value: '{"100":"2"}' }],
      [{ id: 1, type: 'IN', total_cents: 20000, denominations_json: '{"100":2}', created_at: 'now' }],
      [{ id: 1, type: 'IN', total_cents: 20000, denominations_json: '{"100":2}', created_at: 'now' }],
    ],
  });
  installDbMock(db);
  const { cashRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'cashRepo.js'));

  assert.deepEqual(await cashRepo.getCashState(), { denoms: { 100: 2 }, updatedAt: 'now' });
  await cashRepo.setCashState({ 100: 3 });
  await cashRepo.addCashMovement('IN', 30000, { 100: 3 }, 'nota');
  assert.deepEqual(await cashRepo.getCashCounterDraft(), { 100: '2' });
  await cashRepo.setCashCounterDraft({ 50: '1' });
  assert.deepEqual(await cashRepo.listCashMovements(5), [{ id: 1, type: 'IN', total_cents: 20000, denominations_json: '{"100":2}', created_at: 'now' }]);
  assert.deepEqual(await cashRepo.getCashMovement(1), { id: 1, type: 'IN', total_cents: 20000, denominations_json: '{"100":2}', created_at: 'now' });
});

test('cashRepo applies movements and rejects invalid cash operations', async () => {
  let cashState = { denoms: { 100: 2 }, updatedAt: 'now' };
  const db = createMockDb({
    all: [
      () => [{ denominations_json: JSON.stringify(cashState.denoms), updated_at: cashState.updatedAt }],
      () => [{ denominations_json: JSON.stringify(cashState.denoms), updated_at: cashState.updatedAt }],
      () => [{ denominations_json: JSON.stringify(cashState.denoms), updated_at: cashState.updatedAt }],
    ],
    run: [
      (_sql, params) => { cashState = { denoms: JSON.parse(params[0]), updatedAt: params[1] }; return {}; },
      {},
    ],
  });
  installDbMock(db);
  const { cashRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'cashRepo.js'));

  await cashRepo.applyMovement('IN', { 100: 1 }, 'entrada');
  assert.equal(cashState.denoms[100], 3);
  assert.deepEqual(getRunCalls(db)[1].params.slice(0, 3), ['IN', 10000, '{"100":1}']);

  await assert.rejects(() => cashRepo.applyMovement('OUT', { 1000: 1 }), /No hay suficientes/);
  await assert.rejects(() => cashRepo.applyMovement('IN', {}), /conteo actual/);
});

test('cashRepo deletes movements by reversing denomination effects', async () => {
  let cashState = { denoms: { 100: 3 }, updatedAt: 'now' };
  const db = createMockDb({
    all: [
      [{ id: 1, type: 'IN', total_cents: 10000, denominations_json: '{"100":1}', created_at: 'now' }],
      () => [{ denominations_json: JSON.stringify(cashState.denoms), updated_at: cashState.updatedAt }],
    ],
    run: [
      (_sql, params) => { cashState = { denoms: JSON.parse(params[0]), updatedAt: params[1] }; return {}; },
      {},
    ],
  });
  installDbMock(db);
  const { cashRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'cashRepo.js'));

  await cashRepo.deleteCashMovement(1);

  assert.equal(cashState.denoms[100], 2);
  assert.match(getRunCalls(db)[1].sql, /DELETE FROM cash_movements/);
});

test('cashRepo resetCashStateIfNewDay resets only when date changes', async () => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let db = createMockDb({ all: [[{ value: todayStr }]] });
  installDbMock(db);
  let { cashRepo } = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'cashRepo.js'));
  assert.equal(await cashRepo.resetCashStateIfNewDay(), false);
  assert.equal(getRunCalls(db).length, 0);

  db = createMockDb({ all: [[{ value: '2000-01-01' }]] });
  installDbMock(db);
  cashRepo = loadFresh(path.join(buildRoot, 'src', 'data', 'repositories', 'cashRepo.js')).cashRepo;
  assert.equal(await cashRepo.resetCashStateIfNewDay(), true);
  assert.equal(getRunCalls(db).length, 2);
  assert.match(getRunCalls(db)[0].sql, /UPDATE cash_state/);
  assert.match(getRunCalls(db)[1].sql, /INSERT OR REPLACE INTO app_settings/);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${name}`);
      console.error(error);
    }
  }

  console.log(`${tests.length - failed}/${tests.length} repository tests passed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
})();
