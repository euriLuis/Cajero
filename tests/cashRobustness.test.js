const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { mkdtempSync, unlinkSync, rmdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createCashDatabase } = require('./helpers/cashSqlite.cjs');
const {
  DEFAULT_DENOMS, EMPTY_CASH_STATE, calculateTotalFromDraft,
  calculateTotalFromState, buildDenomsDelta, calculateDiff, calculateExpectedCash,
} = require('../.test-build/src/features/cash/utils/cashCalculations');
const { getCurrentLocalDateStr } = require('../.test-build/src/shared/utils/dates');

const LEGACY_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5];
const sum = denoms => Object.entries(denoms).reduce((total, [d, q]) => total + Number(d) * q * 100, 0);
const toDraft = denoms => Object.fromEntries(Object.entries(denoms).map(([d, q]) => [d, String(q)]));
const fixedNow = new Date(2026, 8, 2, 12, 0, 0).getTime();

async function setup(t, denoms = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  const fixture = await createCashDatabase();
  t.after(() => fixture.close());
  await fixture.cashRepo.setCashState(denoms);
  await fixture.cashRepo.setCashStateLastResetDay(getCurrentLocalDateStr());
  return fixture;
}

describe('Denominaciones nuevas y compatibilidad del contador', () => {
  test('las 10 denominaciones son únicas, descendentes y conservan las 8 anteriores', () => {
    assert.deepEqual(DEFAULT_DENOMS, [5000, 2000, ...LEGACY_DENOMS]);
    assert.equal(new Set(DEFAULT_DENOMS).size, 10);
    assert.deepEqual(EMPTY_CASH_STATE, Object.fromEntries(DEFAULT_DENOMS.map(d => [d, 0])));
  });

  for (const denom of [5000, 2000, ...LEGACY_DENOMS]) {
    for (const qty of [0, 1, 7, 100000]) {
      test(`$${denom} x ${qty}: conteo, saldo y movimiento coinciden`, () => {
        const state = { [denom]: qty };
        const draft = Object.freeze(toDraft(state));
        assert.equal(calculateTotalFromDraft(draft), denom * qty * 100);
        assert.equal(calculateTotalFromState(state), denom * qty * 100);
        assert.deepEqual(buildDenomsDelta(draft), qty ? state : {});
        assert.equal(calculateTotalFromState(buildDenomsDelta(draft)), calculateTotalFromDraft(draft));
      });
    }
  }

  test('borrador antiguo sin claves nuevas mantiene exactamente el total anterior', () => {
    const state = Object.fromEntries(LEGACY_DENOMS.map((d, index) => [d, index + 1]));
    assert.equal(calculateTotalFromDraft(toDraft(state)), sum(state));
    assert.equal(calculateTotalFromState(state), sum(state));
    assert.deepEqual(buildDenomsDelta(toDraft(state)), state);
  });

  test('cero, claves ausentes, espacios y ceros iniciales no alteran el conteo', () => {
    assert.equal(calculateTotalFromDraft({}), 0);
    assert.equal(calculateTotalFromState({}), 0);
    assert.equal(calculateTotalFromDraft({ 5000: ' 002 ', 2000: '', 1000: '0' }), 1000000);
    assert.deepEqual(buildDenomsDelta({ 5000: ' 002 ', 2000: ' ', 1000: '0' }), { 5000: 2 });
  });

  test('lista alternativa de denominaciones conserva la API de cálculos', () => {
    const draft = { 5000: '2', 2000: '3', 1000: '4', 1: '5' };
    assert.equal(calculateTotalFromDraft(draft, [1, 1000]), 400500);
    assert.equal(calculateTotalFromState({ 5000: 2, 1: 5 }, [1]), 500);
    assert.deepEqual(buildDenomsDelta(draft, [1, 1000]), { 1: 5, 1000: 4 });
    assert.equal(calculateTotalFromDraft(draft, []), 0);
  });

  test('250 mezclas reproducibles: total independiente, delta y conciliación coinciden', () => {
    let seed = 0x20005000;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let i = 0; i < 250; i += 1) {
      const state = Object.fromEntries(DEFAULT_DENOMS.map(d => [d, random() % 1000]));
      const draft = Object.freeze(toDraft(state));
      const expected = sum(state);
      assert.equal(calculateTotalFromDraft(draft), expected, `mezcla ${i}`);
      assert.equal(calculateTotalFromState(buildDenomsDelta(draft)), expected, `mezcla ${i}`);
      assert.equal(calculateDiff(expected, calculateExpectedCash(expected + 500, 500)), 0);
    }
  });
});

describe('Flujos de caja con SQLite real', () => {
  for (const denom of [5000, 2000, ...LEGACY_DENOMS]) {
    test(`$${denom}: entrada, salida, reversión y agotamiento del saldo`, async t => {
      const { cashRepo } = await setup(t);
      await cashRepo.applyMovement('IN', { [denom]: 5 }, 'entrada');
      await cashRepo.applyMovement('OUT', { [denom]: 2 }, 'salida');
      assert.equal((await cashRepo.getCashState()).denoms[denom], 3);
      const movements = await cashRepo.listCashMovements();
      assert.equal(movements.length, 2);
      const withdrawal = movements.find(m => m.type === 'OUT');
      assert.equal(withdrawal.total_cents, denom * 200);
      assert.deepEqual(JSON.parse(withdrawal.denominations_json), { [denom]: 2 });
      await cashRepo.deleteCashMovement(withdrawal.id);
      assert.equal((await cashRepo.getCashState()).denoms[denom], 5);
      await cashRepo.applyMovement('OUT', { [denom]: 5 });
      assert.equal((await cashRepo.getCashState()).denoms[denom], 0);
      await assert.rejects(() => cashRepo.applyMovement('OUT', { [denom]: 1 }), /No hay suficientes/);
    });
  }

  test('migraciones repetidas no borran caja antigua, borrador ni historial', async t => {
    const { cashRepo, runMigrations, snapshot } = await setup(t, { 1000: 3, 100: 4, 5: 2 });
    await cashRepo.setCashCounterDraft({ 1000: '2', 500: '1' });
    await cashRepo.applyMovement('IN', { 100: 1 });
    const before = await snapshot();
    await runMigrations();
    await runMigrations();
    assert.deepEqual(await snapshot(), before);
    await cashRepo.applyMovement('IN', { 5000: 2, 2000: 1 });
    assert.deepEqual((await cashRepo.getCashState()).denoms, { 1000: 3, 100: 5, 5: 2, 5000: 2, 2000: 1 });
  });

  test('borrador viejo, nuevo y vacío sobreviven al guardado sin modificar el saldo', async t => {
    const { cashRepo } = await setup(t, { 100: 4 });
    for (const draft of [{ 1000: '3', 5: '2' }, { 5000: '2', 2000: '5', 100: '' }, {}]) {
      await cashRepo.setCashCounterDraft(draft);
      assert.deepEqual(await cashRepo.getCashCounterDraft(), draft);
      assert.deepEqual((await cashRepo.getCashState()).denoms, { 100: 4 });
      assert.deepEqual(await cashRepo.listCashMovements(), []);
    }
  });

  test('persistencia real al cerrar y reabrir el archivo SQLite', async t => {
    const directory = mkdtempSync(path.join(tmpdir(), 'cajero-cash-test-'));
    const filename = path.join(directory, 'cash.sqlite');
    const fixture = await createCashDatabase(filename);
    t.after(() => { fixture.close(); unlinkSync(filename); rmdirSync(directory); });
    await fixture.cashRepo.setCashStateLastResetDay(getCurrentLocalDateStr());
    await fixture.cashRepo.applyMovement('IN', { 1000: 1, 2000: 3, 5000: 2 }, 'Depósito mixto');
    await fixture.cashRepo.setCashCounterDraft({ 5000: '7', 100: '1' });
    const before = await fixture.snapshot();
    fixture.reopen();
    assert.deepEqual(await fixture.snapshot(), before);
    assert.equal(calculateTotalFromState((await fixture.cashRepo.getCashState()).denoms), 1700000);
    assert.deepEqual(await fixture.cashRepo.getCashCounterDraft(), { 5000: '7', 100: '1' });
  });

  test('saldo insuficiente en una mezcla no descuenta los billetes que sí existen', async t => {
    const { cashRepo, snapshot } = await setup(t, { 100: 10, 2000: 1, 5000: 0 });
    const before = await snapshot();
    await assert.rejects(() => cashRepo.applyMovement('OUT', { 100: 2, 2000: 1, 5000: 1 }), /\$5000/);
    assert.deepEqual(await snapshot(), before);
  });

  test('no convierte automáticamente un billete grande para una salida pequeña', async t => {
    const { cashRepo, snapshot } = await setup(t, { 5000: 1 });
    const before = await snapshot();
    await assert.rejects(() => cashRepo.applyMovement('OUT', { 1000: 1 }), /\$1000/);
    assert.deepEqual(await snapshot(), before);
  });

  for (const type of ['IN', 'OUT']) {
    test(`${type}: conteo vacío no crea historial ni cambia saldo`, async t => {
      const { cashRepo, snapshot } = await setup(t, { 2000: 1 });
      const before = await snapshot();
      await assert.rejects(() => cashRepo.applyMovement(type, {}), /vacío/);
      await assert.rejects(() => cashRepo.applyMovement(type, { 5000: 0, 2000: 0 }), /vacío/);
      assert.deepEqual(await snapshot(), before);
    });
  }

  test('eliminar un depósito mixto resta solamente su desglose', async t => {
    const { cashRepo } = await setup(t, { 100: 4 });
    await cashRepo.applyMovement('IN', { 2000: 2, 5000: 1 });
    const [movement] = await cashRepo.listCashMovements();
    await cashRepo.deleteCashMovement(movement.id);
    assert.deepEqual((await cashRepo.getCashState()).denoms, { 100: 4, 2000: 0, 5000: 0 });
    assert.equal(await cashRepo.getCashMovement(movement.id), null);
  });

  test('no permite eliminar un depósito cuyos billetes ya se retiraron', async t => {
    const { cashRepo, snapshot } = await setup(t);
    await cashRepo.applyMovement('IN', { 2000: 2, 5000: 1 });
    const [deposit] = await cashRepo.listCashMovements();
    await cashRepo.applyMovement('OUT', { 5000: 1 });
    const before = await snapshot();
    await assert.rejects(() => cashRepo.deleteCashMovement(deposit.id), /No se puede eliminar/);
    assert.deepEqual(await snapshot(), before);
  });

  test('eliminar un movimiento inexistente no cambia ninguna tabla', async t => {
    const { cashRepo, snapshot } = await setup(t, { 5000: 1 });
    const before = await snapshot();
    await assert.rejects(() => cashRepo.deleteCashMovement(999), /Movimiento no encontrado/);
    assert.deepEqual(await snapshot(), before);
  });

  test('historial respeta límite, orden temporal y notas con caracteres especiales', async t => {
    const { cashRepo } = await setup(t);
    for (let i = 0; i < 8; i += 1) {
      t.mock.timers.setTime(fixedNow + i * 1000);
      await cashRepo.applyMovement('IN', { 2000: 1 }, `Entrada ${i}: café ' " ; --`);
    }
    const last = await cashRepo.listCashMovements(3);
    assert.equal(last.length, 3);
    assert.deepEqual(last.map(m => m.id), [8, 7, 6]);
    assert.equal(last[0].note, `Entrada 7: café ' " ; --`);
    assert.equal((await cashRepo.listCashMovements(0)).length, 0);
    assert.equal((await cashRepo.getCashState()).denoms[2000], 8);
  });

  test('120 operaciones mixtas mantienen saldo e historial reconciliados', async t => {
    const { cashRepo } = await setup(t);
    const expected = { ...EMPTY_CASH_STATE };
    for (let i = 0; i < 120; i += 1) {
      const denom = DEFAULT_DENOMS[i % DEFAULT_DENOMS.length];
      const type = i % 3 === 0 && expected[denom] > 0 ? 'OUT' : 'IN';
      const qty = type === 'OUT' ? 1 : (i % 7) + 1;
      await cashRepo.applyMovement(type, { [denom]: qty });
      expected[denom] += type === 'IN' ? qty : -qty;
      const actual = (await cashRepo.getCashState()).denoms;
      assert.equal(actual[denom], expected[denom], `operación ${i}`);
      assert.equal(calculateTotalFromState(actual), sum(expected), `operación ${i}`);
    }
    const movements = await cashRepo.listCashMovements(200);
    assert.equal(movements.length, 120);
    const net = movements.reduce((total, m) => total + (m.type === 'IN' ? 1 : -1) * m.total_cents, 0);
    assert.equal(net, sum(expected));
  });
});

describe('Validaciones defensivas del contador', () => {
  for (const qty of [-1, 1.5, NaN, Infinity, '2', null]) {
    for (const type of ['IN', 'OUT']) {
      test(`${type}: rechaza cantidad ${String(qty)} (${typeof qty}) sin escribir`, async t => {
        const { cashRepo, snapshot } = await setup(t, { 100: 2, 2000: 5, 5000: 5 });
        const before = await snapshot();
        await assert.rejects(() => cashRepo.applyMovement(type, { 100: 1, 5000: qty }), /cantidad|entero/i);
        assert.deepEqual(await snapshot(), before);
      });
    }
  }

  for (const denom of ['3000', '5000x', '-2000', '0', '__proto__']) {
    test(`rechaza denominación desconocida ${denom} sin registrar dinero invisible`, async t => {
      const { cashRepo, snapshot } = await setup(t);
      const before = await snapshot();
      await assert.rejects(() => cashRepo.applyMovement('IN', { [denom]: 1 }), /denominaci/i);
      assert.deepEqual(await snapshot(), before);
    });
  }

  test('rechaza tipo de movimiento distinto de IN y OUT', async t => {
    const { cashRepo, snapshot } = await setup(t, { 5000: 2 });
    const before = await snapshot();
    await assert.rejects(() => cashRepo.applyMovement('INVALID', { 5000: 1 }), /tipo/i);
    assert.deepEqual(await snapshot(), before);
  });

  test('rechaza importes que superan la precisión entera en centavos', async t => {
    const { cashRepo, snapshot } = await setup(t);
    const before = await snapshot();
    await assert.rejects(() => cashRepo.applyMovement('IN', { 5000: Number.MAX_SAFE_INTEGER }), /límite|seguro|grande/i);
    assert.deepEqual(await snapshot(), before);
  });

  test('rechaza desbordamiento de saldo aunque el movimiento sea pequeño', async t => {
    const maxQty = Math.floor(Number.MAX_SAFE_INTEGER / 500000);
    const { cashRepo, snapshot } = await setup(t, { 5000: maxQty });
    const before = await snapshot();
    await assert.rejects(() => cashRepo.applyMovement('IN', { 5000: 1 }), /límite|seguro|grande/i);
    assert.deepEqual(await snapshot(), before);
  });

  test('rechaza una mezcla cuyo total desborda aunque cada subtotal sea seguro', async t => {
    const { cashRepo, snapshot } = await setup(t);
    const before = await snapshot();
    const qty = Math.floor(Number.MAX_SAFE_INTEGER / 500000);
    await assert.rejects(() => cashRepo.applyMovement('IN', { 5000: qty, 2000: qty }), /límite|seguro/i);
    assert.deepEqual(await snapshot(), before);
  });

  test('acepta el mayor conteo seguro de billetes de 5000 sin redondearlo', async t => {
    const { cashRepo } = await setup(t);
    const qty = Math.floor(Number.MAX_SAFE_INTEGER / 500000);
    await cashRepo.applyMovement('IN', { 5000: qty });
    assert.equal((await cashRepo.getCashState()).denoms[5000], qty);
    assert.equal((await cashRepo.listCashMovements())[0].total_cents, qty * 500000);
  });

  for (const invalid of [null, [], '5000', 5000]) {
    test(`rechaza desglose no-objeto ${JSON.stringify(invalid)} sin escribir`, async t => {
      const { cashRepo, snapshot } = await setup(t);
      const before = await snapshot();
      await assert.rejects(() => cashRepo.applyMovement('IN', invalid), /desglose|denominaci/i);
      assert.deepEqual(await snapshot(), before);
    });
  }

  test('una fila de saldo ausente no permite guardar movimientos huérfanos', async t => {
    const { cashRepo, db, snapshot } = await setup(t);
    await db.runAsync('DELETE FROM cash_state WHERE id = 1');
    const before = await snapshot();
    await assert.rejects(() => cashRepo.applyMovement('IN', { 5000: 1 }), /saldo guardado/i);
    assert.deepEqual(await snapshot(), before);
  });

  test('escritura directa no permite un total distinto del desglose', async t => {
    const { cashRepo, snapshot } = await setup(t);
    const before = await snapshot();
    await assert.rejects(() => cashRepo.addCashMovement('IN', 1, { 5000: 1 }), /total.*desglose/i);
    await assert.rejects(() => cashRepo.addCashMovement('INVALID', 500000, { 5000: 1 }), /tipo/i);
    await assert.rejects(() => cashRepo.setCashState({ 2000: -1 }), /cantidad/i);
    assert.deepEqual(await snapshot(), before);
  });

  for (const raw of ['{"5000":-1}', '{"5000":1.5}', '{"3000":1}', '{"5000":2}', 'null']) {
    test(`eliminar historial dañado ${raw} no modifica la caja`, async t => {
      const { cashRepo, db, snapshot } = await setup(t, { 5000: 10 });
      await db.runAsync('INSERT INTO cash_movements (type, total_cents, denominations_json, created_at) VALUES (?, ?, ?, ?)',
        ['OUT', 500000, raw, new Date().toISOString()]);
      const [movement] = await cashRepo.listCashMovements();
      const before = await snapshot();
      await assert.rejects(() => cashRepo.deleteCashMovement(movement.id), /cantidad|denominaci|desglose/i);
      assert.deepEqual(await snapshot(), before);
    });
  }

  for (const raw of ['null', '[]', '{"5000":"2"}', '{"5000":-1}', '{malformed']) {
    test(`saldo guardado inválido ${raw} bloquea nuevas escrituras sin reemplazarlo por cero`, async t => {
      const { cashRepo, db, snapshot } = await setup(t);
      await db.runAsync('UPDATE cash_state SET denominations_json = ? WHERE id = 1', [raw]);
      const before = await snapshot();
      await assert.rejects(() => cashRepo.applyMovement('IN', { 2000: 1 }), /saldo|caja|cantidad|denominaci/i);
      assert.deepEqual(await snapshot(), before);
    });
  }

  for (const raw of ['null', '[]', '"texto"', '{malformed']) {
    test(`borrador inválido ${raw} se lee sin romper la pantalla`, async t => {
      const { cashRepo, db } = await setup(t);
      await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['cash_counter_draft', raw]);
      assert.deepEqual(await cashRepo.getCashCounterDraft(), {});
    });
  }

  for (const value of ['-1', '1.5', '2abc', '1e3', '99999999999999999999999']) {
    test(`borrador ${value}: no aplica un importe diferente al confirmado`, () => {
      const draft = { 5000: value, 100: '2' };
      assert.throws(() => buildDenomsDelta(draft), /cantidad|entero|límite|grande/i);
    });
  }
});

describe('Regresión de ventas y resumen con la caja ampliada', () => {
  test('venta, retiro y conteo mixto concilian sin duplicar registros', async t => {
    const { cashRepo, salesRepo, withdrawalsRepo, db } = await setup(t);
    await salesRepo.createSale({ items: [{ productId: 1, productNameSnapshot: 'Producto', unitPriceSnapshotCents: 300000, qty: 3 }] });
    await cashRepo.applyMovement('IN', { 5000: 1, 2000: 2 });
    const sales = await salesRepo.sumSalesByRange(fixedNow - 1, fixedNow + 1);
    assert.equal(sales, 900000);
    assert.equal(calculateDiff(calculateTotalFromState((await cashRepo.getCashState()).denoms), sales), 0);
    await withdrawalsRepo.createWithdrawal(200000, 'Gasto');
    await cashRepo.applyMovement('OUT', { 2000: 1 });
    const withdrawals = await withdrawalsRepo.sumWithdrawalsByRange(fixedNow - 1, fixedNow + 1);
    assert.equal(calculateExpectedCash(sales, withdrawals), 700000);
    assert.equal(calculateTotalFromState((await cashRepo.getCashState()).denoms), 700000);
    assert.equal((await db.getAllAsync('SELECT * FROM sales')).length, 1);
    assert.equal((await db.getAllAsync('SELECT * FROM withdrawals')).length, 1);
    assert.equal((await cashRepo.listCashMovements()).length, 2);
  });

  test('caja y su reinicio no borran ventas, retiros ni sus detalles antiguos', async t => {
    const { cashRepo, salesRepo, withdrawalsRepo, db } = await setup(t);
    await salesRepo.createSale({ items: [{ productId: 1, productNameSnapshot: 'Café', unitPriceSnapshotCents: 12550, qty: 2 }] });
    await withdrawalsRepo.createWithdrawal(550, 'Transporte');
    const sales = await db.getAllAsync('SELECT * FROM sales');
    const items = await db.getAllAsync('SELECT * FROM sale_items');
    const withdrawals = await db.getAllAsync('SELECT * FROM withdrawals');
    await cashRepo.applyMovement('IN', { 2000: 1, 100: 4 });
    const [movement] = await cashRepo.listCashMovements();
    await cashRepo.deleteCashMovement(movement.id);
    t.mock.timers.setTime(new Date(2026, 8, 3, 12).getTime());
    await cashRepo.resetCashStateIfNewDay();
    assert.deepEqual(await db.getAllAsync('SELECT * FROM sales'), sales);
    assert.deepEqual(await db.getAllAsync('SELECT * FROM sale_items'), items);
    assert.deepEqual(await db.getAllAsync('SELECT * FROM withdrawals'), withdrawals);
  });

  test('fallo en el segundo producto revierte venta y todos sus detalles, sin tocar caja', async t => {
    const { cashRepo, salesRepo, db, snapshot } = await setup(t, { 5000: 2 });
    const before = await snapshot();
    await db.execAsync("CREATE TRIGGER fail_sale_item BEFORE INSERT ON sale_items WHEN NEW.product_id = 2 BEGIN SELECT RAISE(ABORT, 'simulated item failure'); END;");
    await assert.rejects(() => salesRepo.createSale({ items: [
      { productId: 1, productNameSnapshot: 'Uno', unitPriceSnapshotCents: 10000, qty: 2 },
      { productId: 2, productNameSnapshot: 'Dos', unitPriceSnapshotCents: 20000, qty: 3 },
    ] }), /simulated item failure/);
    assert.deepEqual(await db.getAllAsync('SELECT * FROM sales'), []);
    assert.deepEqual(await db.getAllAsync('SELECT * FROM sale_items'), []);
    assert.deepEqual(await snapshot(), before);
    assert.equal(calculateTotalFromState((await cashRepo.getCashState()).denoms), 1000000);
  });

  test('resumen sin ventas ni retiros devuelve cero, aunque haya un conteo físico', async t => {
    const { cashRepo, salesRepo, withdrawalsRepo } = await setup(t);
    await cashRepo.applyMovement('IN', { 5000: 1 });
    const sales = await salesRepo.sumSalesByRange(fixedNow - 1, fixedNow + 1);
    const withdrawals = await withdrawalsRepo.sumWithdrawalsByRange(fixedNow - 1, fixedNow + 1);
    assert.equal(calculateExpectedCash(sales, withdrawals), 0);
    assert.equal(calculateDiff(calculateTotalFromState((await cashRepo.getCashState()).denoms), 0), 500000);
  });
});

describe('Atomicidad y cambio de día con SQLite real', () => {
  for (const type of ['IN', 'OUT']) {
    test(`${type}: fallo al insertar historial revierte también el saldo`, async t => {
      const { cashRepo, db, snapshot } = await setup(t, { 2000: 3, 5000: 2 });
      await db.execAsync("CREATE TRIGGER fail_history BEFORE INSERT ON cash_movements BEGIN SELECT RAISE(ABORT, 'simulated history failure'); END;");
      const before = await snapshot();
      await assert.rejects(() => cashRepo.applyMovement(type, { 2000: 1, 5000: 1 }), /simulated history failure/);
      assert.deepEqual(await snapshot(), before);
    });
  }

  test('fallo al actualizar caja no genera un movimiento huérfano', async t => {
    const { cashRepo, db, snapshot } = await setup(t, { 100: 1 });
    await db.execAsync("CREATE TRIGGER fail_state BEFORE UPDATE ON cash_state BEGIN SELECT RAISE(ABORT, 'simulated state failure'); END;");
    const before = await snapshot();
    await assert.rejects(() => cashRepo.applyMovement('IN', { 5000: 1 }), /simulated state failure/);
    assert.deepEqual(await snapshot(), before);
  });

  test('fallo al eliminar historial revierte la reversión del saldo', async t => {
    const { cashRepo, db, snapshot } = await setup(t);
    await cashRepo.applyMovement('IN', { 5000: 1 });
    const [movement] = await cashRepo.listCashMovements();
    await db.execAsync("CREATE TRIGGER fail_delete BEFORE DELETE ON cash_movements BEGIN SELECT RAISE(ABORT, 'simulated delete failure'); END;");
    const before = await snapshot();
    await assert.rejects(() => cashRepo.deleteCashMovement(movement.id), /simulated delete failure/);
    assert.deepEqual(await snapshot(), before);
  });

  test('el mismo día no reinicia ni saldo, ni borrador, ni historial', async t => {
    const { cashRepo, snapshot } = await setup(t);
    await cashRepo.applyMovement('IN', { 5000: 2, 2000: 1, 100: 3 });
    await cashRepo.setCashCounterDraft({ 2000: '2' });
    const before = await snapshot();
    assert.equal(await cashRepo.resetCashStateIfNewDay(), false);
    assert.deepEqual(await snapshot(), before);
  });

  test('día nuevo reinicia las 10 denominaciones una vez y conserva borrador e historial', async t => {
    const { cashRepo } = await setup(t);
    await cashRepo.applyMovement('IN', { 5000: 2, 2000: 1, 100: 3 });
    await cashRepo.setCashCounterDraft({ 2000: '2' });
    t.mock.timers.setTime(new Date(2026, 8, 3, 0, 1).getTime());
    assert.equal(await cashRepo.resetCashStateIfNewDay(), true);
    assert.deepEqual((await cashRepo.getCashState()).denoms, EMPTY_CASH_STATE);
    assert.equal(await cashRepo.getCashStateLastResetDay(), '2026-09-03');
    assert.deepEqual(await cashRepo.getCashCounterDraft(), { 2000: '2' });
    assert.equal((await cashRepo.listCashMovements()).length, 1);
    assert.equal(await cashRepo.resetCashStateIfNewDay(), false);
  });

  test('entrada justo después de medianoche se guarda sobre el saldo del nuevo día', async t => {
    const { cashRepo } = await setup(t, { 1000: 9, 5000: 4 });
    t.mock.timers.setTime(new Date(2026, 8, 3, 0, 0, 1).getTime());
    await cashRepo.applyMovement('IN', { 2000: 2, 5000: 1 });
    assert.deepEqual((await cashRepo.getCashState()).denoms, { ...EMPTY_CASH_STATE, 2000: 2, 5000: 1 });
    assert.equal(await cashRepo.resetCashStateIfNewDay(), false);
    assert.equal(calculateTotalFromState((await cashRepo.getCashState()).denoms), 900000);
  });

  test('salida fallida al cambiar de día no deja un reinicio parcialmente guardado', async t => {
    const { cashRepo, snapshot } = await setup(t, { 5000: 3 });
    const before = await snapshot();
    t.mock.timers.setTime(new Date(2026, 8, 3, 0, 0, 1).getTime());
    await assert.rejects(() => cashRepo.applyMovement('OUT', { 5000: 1 }), /No hay suficientes/);
    assert.deepEqual(await snapshot(), before);
  });

  test('fallo guardando la fecha de reinicio conserva fecha y saldo anteriores', async t => {
    const { cashRepo, db, snapshot } = await setup(t, { 2000: 2 });
    await db.execAsync("CREATE TRIGGER fail_reset BEFORE INSERT ON app_settings WHEN NEW.key = 'cash_state_last_reset_day' BEGIN SELECT RAISE(ABORT, 'simulated reset failure'); END;");
    const before = await snapshot();
    t.mock.timers.setTime(new Date(2026, 8, 3, 0, 0, 1).getTime());
    await assert.rejects(() => cashRepo.resetCashStateIfNewDay(), /simulated reset failure/);
    assert.deepEqual(await snapshot(), before);
  });
});
