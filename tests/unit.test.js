const assert = require('node:assert/strict');

const {
  parseMoneyToCents,
  formatCents,
} = require('../.test-build/src/shared/utils/money');
const {
  getDayRangeMs,
  getWeekRangeMs,
  formatDateShort,
  formatTimeNoSeconds,
  formatDateTimeWithSeconds,
} = require('../.test-build/src/shared/utils/dates');
const {
  validateQuantity,
  validateMonetaryAmount,
  resolveDraftQty,
  resolveDraftPrice,
} = require('../.test-build/src/features/shared/utils/validation');
const {
  isSameDay,
} = require('../.test-build/src/features/shared/utils/dateComparisons');
const {
  calculateCartTotal,
  addToCart,
  updateCartQty,
  removeFromCart,
  combineDateWithCurrentTime,
} = require('../.test-build/src/features/sales/utils/cartCalculations');
const {
  calculateSalary,
  calculateDailySalary,
  calculateWeeklySalary,
} = require('../.test-build/src/features/summary/utils/salaryCalculations');
const {
  DEFAULT_DENOMS,
  EMPTY_CASH_STATE,
  calculateTotalFromDraft,
  calculateTotalFromState,
  buildDenomsDelta,
  calculateDiff,
  calculateExpectedCash,
  classifyDiff,
} = require('../.test-build/src/features/cash/utils/cashCalculations');

const tests = [];

const test = (name, fn) => {
  tests.push({ name, fn });
};

test('money utils parse and format currency values', () => {
  assert.equal(parseMoneyToCents('10'), 1000);
  assert.equal(parseMoneyToCents('$ 1,234.56'), 123456);
  assert.equal(parseMoneyToCents('12,50'), 1250);
  assert.equal(parseMoneyToCents('0.105'), 11);
  assert.equal(parseMoneyToCents('abc'), 0);

  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCents(123456), '$1,234.56');
  assert.equal(formatCents(-250), '$-2.50');
});

test('date utils calculate local day and week ranges', () => {
  const date = new Date(2026, 4, 6, 15, 30, 12, 345);
  const day = getDayRangeMs(date);

  assert.equal(formatDateTimeWithSeconds(day.startMs), '2026-05-06 00:00:00');
  assert.equal(formatDateTimeWithSeconds(day.endMs), '2026-05-06 23:59:59');
  assert.equal(formatDateShort(date.getTime()), '2026-05-06');
  assert.equal(formatTimeNoSeconds(date.getTime()), '15:30');

  const week = getWeekRangeMs(date);
  assert.equal(formatDateShort(week.startMs), '2026-05-04');
  assert.equal(formatDateShort(week.endMs), '2026-05-10');
});

test('date comparisons compare calendar days without depending on time of day', () => {
  const morning = new Date(2026, 4, 10, 8, 0).getTime();
  const night = new Date(2026, 4, 10, 22, 30).getTime();
  const nextDay = new Date(2026, 4, 11, 1, 0).getTime();

  assert.equal(isSameDay(morning, night), true);
  assert.equal(isSameDay(morning, nextDay), false);
});

test('validation utils handle quantities, money and edit drafts', () => {
  assert.deepEqual(validateQuantity(''), { valid: true, value: 1 });
  assert.deepEqual(validateQuantity('3'), { valid: true, value: 3 });
  assert.equal(validateQuantity('abc').valid, false);
  assert.equal(validateQuantity('0').valid, false);

  assert.deepEqual(validateMonetaryAmount('12.50', parseMoneyToCents), { valid: true, value: 1250 });
  assert.equal(validateMonetaryAmount('', parseMoneyToCents).valid, false);
  assert.equal(validateMonetaryAmount('0', parseMoneyToCents).valid, false);

  assert.equal(resolveDraftQty('', 5), 5);
  assert.equal(resolveDraftQty('7', 5), 7);
  assert.equal(resolveDraftQty('bad', 5), 5);
  assert.equal(resolveDraftPrice('', 1200, parseMoneyToCents), 1200);
  assert.equal(resolveDraftPrice('9.99', 1200, parseMoneyToCents), 999);
});

test('cart calculations add, merge, update and remove items', () => {
  const productA = {
    productId: 1,
    productNameSnapshot: 'Cafe',
    unitPriceSnapshotCents: 250,
    qty: 2,
  };
  const productB = {
    productId: 2,
    productNameSnapshot: 'Pan',
    unitPriceSnapshotCents: 125,
    qty: 4,
  };

  let cart = addToCart([], productA);
  cart = addToCart(cart, productB);
  cart = addToCart(cart, { ...productA, qty: 3 });

  assert.deepEqual(cart.find(item => item.productId === 1).qty, 5);
  assert.equal(calculateCartTotal(cart), 1750);

  cart = updateCartQty(cart, 1, -2);
  assert.equal(cart.find(item => item.productId === 1).qty, 3);

  cart = updateCartQty(cart, 1, -3);
  assert.equal(cart.some(item => item.productId === 1), false);

  cart = removeFromCart(cart, 2);
  assert.deepEqual(cart, []);
});

test('combineDateWithCurrentTime preserves selected date and current time', () => {
  const selectedDate = new Date(2026, 4, 10, 0, 0, 0, 0);
  const now = new Date(2026, 0, 1, 18, 45, 12, 123);
  const combined = combineDateWithCurrentTime(selectedDate, now);

  assert.equal(formatDateShort(combined.getTime()), '2026-05-10');
  assert.equal(formatTimeNoSeconds(combined.getTime()), '18:45');
  assert.equal(combined.getSeconds(), 12);
  assert.equal(combined.getMilliseconds(), 123);
});

test('salary calculations apply 0.5 percent rate with cent rounding', () => {
  assert.equal(calculateSalary(100000), 500);
  assert.equal(calculateDailySalary(199), 1);
  assert.equal(calculateWeeklySalary(0), 0);
});

test('cash calculations total drafts, states and movement deltas', () => {
  assert.deepEqual(DEFAULT_DENOMS, [1000, 500, 200, 100, 50, 20, 10, 5]);
  assert.equal(calculateTotalFromDraft({ '1000': '1', '50': '2', '10': 'bad' }), 110000);
  assert.equal(calculateTotalFromState({ ...EMPTY_CASH_STATE, '500': 2, '5': 3 }), 101500);
  assert.deepEqual(buildDenomsDelta({ '1000': '0', '500': '2', '20': '', '5': '3' }), {
    '500': 2,
    '5': 3,
  });
});

test('cash calculations compute expected balances and classify differences', () => {
  assert.equal(calculateExpectedCash(100000, 15000), 85000);
  assert.equal(calculateDiff(90000, 85000), 5000);
  assert.equal(calculateDiff(80000, 85000), -5000);

  assert.equal(classifyDiff(0), 'OK');
  assert.equal(classifyDiff(1), 'SOBRA');
  assert.equal(classifyDiff(-1), 'FALTA');
  assert.equal(classifyDiff(0, { ok: 'Cuadra' }), 'Cuadra');
  assert.equal(classifyDiff(1, { surplus: 'Sobrante' }), 'Sobrante');
  assert.equal(classifyDiff(-1, { deficit: 'Faltante' }), 'Faltante');
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

console.log(`${tests.length - failed}/${tests.length} tests passed`);

if (failed > 0) {
  process.exitCode = 1;
}
