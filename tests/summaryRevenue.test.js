const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createCashDatabase } = require('./helpers/cashSqlite.cjs');
const { getDayRangeMs } = require('../.test-build/src/shared/utils/dates');

const date = new Date(2026, 8, 2, 12).getTime();
const { startMs, endMs } = getDayRangeMs(new Date(date));
const item = (name, price, qty, productId = 1) => ({
  productId, productNameSnapshot: name, unitPriceSnapshotCents: price, qty,
});

async function setup(t) {
  const fixture = await createCashDatabase();
  t.after(() => fixture.close());
  return fixture;
}

async function reconciled(salesRepo, start = startMs, end = endMs) {
  const products = await salesRepo.getProductsSoldSummary(start, end);
  const total = await salesRepo.sumSalesByRange(start, end);
  assert.equal(products.reduce((sum, product) => sum + product.totalCents, 0), total);
  for (const product of products) assert.ok(Number.isSafeInteger(product.totalCents));
  return products;
}

test('sin ventas: productos vacíos y facturación cero', async t => {
  const { salesRepo } = await setup(t);
  assert.deepEqual(await reconciled(salesRepo), []);
});

test('cada producto muestra su cantidad y facturación exacta en centavos', async t => {
  const { salesRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Café', 12550, 3), item('Pan', 500, 2, 2)] });
  assert.deepEqual(await reconciled(salesRepo), [
    { productName: 'Café', totalQty: 3, totalCents: 37650 },
    { productName: 'Pan', totalQty: 2, totalCents: 1000 },
  ]);
});

test('mismo producto vendido a precios distintos suma lo realmente facturado', async t => {
  const { salesRepo, db } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Café', 100, 2)] });
  await salesRepo.createSale({ createdAtMs: date + 1, items: [item('Café', 250, 3)] });
  await db.runAsync('INSERT INTO products (id, name, price_cents, active, updated_at) VALUES (?, ?, ?, ?, ?)',
    [1, 'Café renombrado', 99999, 0, date]);
  assert.deepEqual(await reconciled(salesRepo), [{ productName: 'Café', totalQty: 5, totalCents: 950 }]);
});

test('nombres largos y caracteres especiales se conservan completos', async t => {
  const { salesRepo } = await setup(t);
  const name = 'Producto de nombre muy largo que debe continuar debajo del contenedor: café con leche "especial" de la casa';
  await salesRepo.createSale({ createdAtMs: date, items: [item(name, 1025, 2)] });
  assert.deepEqual(await reconciled(salesRepo), [{ productName: name, totalQty: 2, totalCents: 2050 }]);
});

test('filas repetidas del mismo nombre se agregan sin perder cantidad ni importe', async t => {
  const { salesRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Café', 101, 2), item('Café', 203, 3)] });
  assert.deepEqual(await reconciled(salesRepo), [{ productName: 'Café', totalQty: 5, totalCents: 811 }]);
});

test('productos gratuitos suman unidades sin aumentar el total facturado', async t => {
  const { salesRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Obsequio', 0, 3), item('Venta', 101, 1, 2)] });
  assert.deepEqual(await reconciled(salesRepo), [
    { productName: 'Obsequio', totalQty: 3, totalCents: 0 },
    { productName: 'Venta', totalQty: 1, totalCents: 101 },
  ]);
});

test('filtro diario incluye ambos límites y excluye ventas de otros días', async t => {
  const { salesRepo } = await setup(t);
  for (const [createdAtMs, name] of [[startMs - 1, 'Antes'], [startMs, 'Inicio'], [endMs, 'Fin'], [endMs + 1, 'Después']]) {
    await salesRepo.createSale({ createdAtMs, items: [item(name, 500, 1)] });
  }
  const products = await reconciled(salesRepo);
  assert.deepEqual(products.map(p => p.productName).sort(), ['Fin', 'Inicio']);
  assert.equal(products.reduce((sum, p) => sum + p.totalCents, 0), 1000);
});

test('borrador de venta y extracciones no se incluyen como facturación de productos', async t => {
  const { salesRepo, withdrawalsRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Venta', 2000, 3)] });
  await salesRepo.setCurrentSaleDraftTotal(999999);
  await withdrawalsRepo.createWithdrawal(500, 'Gasto', date);
  assert.deepEqual(await reconciled(salesRepo), [{ productName: 'Venta', totalQty: 3, totalCents: 6000 }]);
});

test('editar cantidad y precio actualiza a la vez facturado y desglose por producto', async t => {
  const { salesRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Café', 250, 2)] });
  const [sale] = await salesRepo.listSalesByRange(startMs, endMs);
  const [line] = await salesRepo.getSaleItems(sale.id);
  await salesRepo.applySaleEdits(sale.id, [{ type: 'update', itemId: line.id, qty: 5, unitPriceSnapshotCents: 175 }]);
  assert.deepEqual(await reconciled(salesRepo), [{ productName: 'Café', totalQty: 5, totalCents: 875 }]);
});

test('agregar y quitar productos en una edición mantiene la conciliación', async t => {
  const { salesRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Anterior', 100, 2), item('Conservar', 150, 3, 2)] });
  const [sale] = await salesRepo.listSalesByRange(startMs, endMs);
  const lines = await salesRepo.getSaleItems(sale.id);
  await salesRepo.applySaleEdits(sale.id, [
    { type: 'delete', itemId: lines.find(line => line.productNameSnapshot === 'Anterior').id },
    { type: 'add', ...item('Nuevo', 125, 4, 3) },
  ]);
  assert.deepEqual(await reconciled(salesRepo), [
    { productName: 'Nuevo', totalQty: 4, totalCents: 500 },
    { productName: 'Conservar', totalQty: 3, totalCents: 450 },
  ]);
});

test('eliminar el último producto elimina la venta y su facturación', async t => {
  const { salesRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Único', 500, 1)] });
  const [sale] = await salesRepo.listSalesByRange(startMs, endMs);
  const [line] = await salesRepo.getSaleItems(sale.id);
  await salesRepo.applySaleEdits(sale.id, [{ type: 'delete', itemId: line.id }]);
  assert.deepEqual(await reconciled(salesRepo), []);
  assert.deepEqual(await salesRepo.listSalesByRange(startMs, endMs), []);
});

test('eliminar una venta completa deja solamente la facturación de las demás', async t => {
  const { salesRepo } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Café', 100, 2)] });
  await salesRepo.createSale({ createdAtMs: date + 1, items: [item('Café', 150, 3)] });
  const [lastSale] = await salesRepo.listSalesByRange(startMs, endMs);
  await salesRepo.deleteSale(lastSale.id);
  assert.deepEqual(await reconciled(salesRepo), [{ productName: 'Café', totalQty: 2, totalCents: 200 }]);
});

test('fallo al guardar edición conserva el desglose y total anteriores', async t => {
  const { salesRepo, db } = await setup(t);
  await salesRepo.createSale({ createdAtMs: date, items: [item('Café', 100, 2)] });
  const [sale] = await salesRepo.listSalesByRange(startMs, endMs);
  const [line] = await salesRepo.getSaleItems(sale.id);
  const before = await reconciled(salesRepo);
  await db.execAsync("CREATE TRIGGER fail_total BEFORE UPDATE ON sales BEGIN SELECT RAISE(ABORT, 'fallo de prueba'); END;");
  await assert.rejects(() => salesRepo.applySaleEdits(sale.id,
    [{ type: 'update', itemId: line.id, qty: 20, unitPriceSnapshotCents: 300 }]), /fallo de prueba/);
  assert.deepEqual(await reconciled(salesRepo), before);
});

test('100 ventas mixtas concilian sin límites de listado ni errores de redondeo', async t => {
  const { salesRepo } = await setup(t);
  let expected = 0;
  for (let i = 0; i < 100; i += 1) {
    const items = [item('Café', 101 + i, i % 7 + 1), item('Pan', 203, i % 3 + 1, 2)];
    expected += items.reduce((sum, line) => sum + line.qty * line.unitPriceSnapshotCents, 0);
    await salesRepo.createSale({ createdAtMs: date + i, items });
  }
  const products = await reconciled(salesRepo);
  assert.equal(products.length, 2);
  assert.equal(products.reduce((sum, p) => sum + p.totalCents, 0), expected);
});
