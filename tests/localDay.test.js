const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

// Run in fresh processes: do not change the device's clock or timezone.
if (!process.env.CAJERO_DATE_TEST_ZONE) {
  for (const zone of ['America/Havana', 'America/New_York', 'Asia/Kolkata']) {
    const result = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, TZ: zone, CAJERO_DATE_TEST_ZONE: zone },
      encoding: 'utf8',
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.status !== 0) process.exit(1);
  }
  process.exit(0);
}

const {
  resolveLocalDate, selectLocalDate, getLocalDaySnapshot, getLocalDayCheckDelay,
} = require('../.test-build/src/shared/utils/localDateSelection');
const { formatDateShort, getDayRangeMs, getWeekRangeMs } = require('../.test-build/src/shared/utils/dates');
const { isYesterday } = require('../.test-build/src/features/shared/utils/dateComparisons');
const { combineDateWithCurrentTime } = require('../.test-build/src/features/sales/utils/cartCalculations');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const day = date => formatDateShort(date.getTime());

test('today and yesterday follow midnight, skipped days and backward clock changes', () => {
  for (const now of [new Date(2026, 8, 3), new Date(2026, 8, 20), new Date(2026, 7, 25)]) {
    assert.equal(day(resolveLocalDate('today', now)), day(now));
    const previous = new Date(now);
    previous.setDate(previous.getDate() - 1);
    assert.equal(day(resolveLocalDate('yesterday', now)), day(previous));
  }
});

test('manual calendar dates stay fixed and selecting today restores automatic tracking', () => {
  const before = new Date(2026, 8, 2, 23, 59);
  const fixed = selectLocalDate(new Date(2026, 7, 15), before);
  assert.deepEqual(fixed, { day: '2026-08-15' });
  assert.equal(day(resolveLocalDate(fixed, new Date(2026, 8, 20))), '2026-08-15');
  const today = selectLocalDate(before, before);
  assert.equal(today, 'today');
  assert.equal(day(resolveLocalDate(today, new Date(2026, 8, 3))), '2026-09-03');
});

test('a sale confirmed after midnight uses the new date before any timer runs', () => {
  const now = new Date(2027, 0, 1, 0, 0, 1, 123);
  const created = combineDateWithCurrentTime(resolveLocalDate('today', now), now);
  assert.equal(created.getTime(), now.getTime());
  const backdated = combineDateWithCurrentTime(resolveLocalDate({ day: '2026-12-15' }, now), now);
  assert.equal(day(backdated), '2026-12-15');
  assert.equal(backdated.getSeconds(), 1);
});

test('month, year, leap-day and Monday ranges roll over using the local calendar', () => {
  for (const [now, yesterday] of [
    [new Date(2027, 0, 1), '2026-12-31'],
    [new Date(2028, 2, 1), '2028-02-29'],
    [new Date(2026, 8, 1), '2026-08-31'],
  ]) assert.equal(day(resolveLocalDate('yesterday', now)), yesterday);
  const monday = resolveLocalDate('today', new Date(2026, 8, 7));
  assert.equal(day(new Date(getWeekRangeMs(monday).startMs)), '2026-09-07');
});

test('yesterday and daily ranges remain correct across daylight saving changes', () => {
  // At 00:30 after the spring transition, subtracting 24 hours would skip a date.
  const spring = new Date(2026, 2, 9, 0, 30);
  assert.equal(isYesterday(new Date(2026, 2, 8, 12).getTime(), spring), true);
  assert.equal(isYesterday(new Date(2026, 2, 7, 12).getTime(), spring), false);
  // Late on the fall transition day, subtracting 24 hours can remain on today.
  const autumn = new Date(2026, 10, 1, 23, 30);
  assert.equal(isYesterday(new Date(2026, 9, 31, 12).getTime(), autumn), true);
  assert.equal(isYesterday(autumn.getTime(), autumn), false);
  for (const date of [new Date(2026, 2, 8, 12), new Date(2026, 10, 1, 12)]) {
    const range = getDayRangeMs(date);
    assert.equal(day(new Date(range.startMs)), day(date));
    assert.equal(day(new Date(range.endMs)), day(date));
    if (process.env.TZ !== 'Asia/Kolkata') {
      assert.notEqual(range.endMs - range.startMs + 1, 86_400_000);
    }
  }
});

test('checks are bounded and scheduled exactly at the next local midnight', () => {
  assert.equal(getLocalDayCheckDelay(new Date(2026, 8, 2, 12)), 30_000);
  assert.equal(getLocalDayCheckDelay(new Date(2026, 8, 2, 23, 59, 59, 750)), 250);
});

test('day snapshot invalidates on a timezone-offset change even on the same date', () => {
  const now = new Date(2026, 8, 2, 12);
  const changed = new Date(now);
  changed.getTimezoneOffset = () => now.getTimezoneOffset() + 60;
  assert.notEqual(getLocalDaySnapshot(now), getLocalDaySnapshot(changed));
});

test('shared native clock handles midnight, suspension, manual jumps and cleanup', () => {
  const RealDate = global.Date;
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  const nativePath = require.resolve('react-native');
  const originalNative = require.cache[nativePath];
  const storePath = require.resolve('../.test-build/src/shared/time/localDayStore');
  let nowMs = new RealDate(2026, 8, 2, 23, 59, 59, 750).getTime();
  let nextId = 0;
  const timers = new Map();
  const nativeListeners = new Set();
  const appState = {
    currentState: 'active',
    addEventListener(event, listener) {
      assert.equal(event, 'change');
      nativeListeners.add(listener);
      return { remove: () => nativeListeners.delete(listener) };
    },
  };
  const changeState = state => {
    appState.currentState = state;
    nativeListeners.forEach(listener => listener(state));
  };
  const fireTimer = () => {
    assert.equal(timers.size, 1);
    const [id, { fn }] = [...timers][0];
    timers.delete(id);
    fn();
  };
  let unsubscribeA;
  let unsubscribeB;
  try {
    global.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [nowMs])); }
      static now() { return nowMs; }
    };
    global.setTimeout = (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; };
    global.clearTimeout = id => timers.delete(id);
    require.cache[nativePath] = { id: nativePath, filename: nativePath, loaded: true, exports: { AppState: appState } };
    delete require.cache[storePath];
    const store = require(storePath);
    let notificationsA = 0;
    let notificationsB = 0;
    unsubscribeA = store.subscribeLocalDay(() => notificationsA++);
    unsubscribeB = store.subscribeLocalDay(() => notificationsB++);
    assert.equal(nativeListeners.size, 1);
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].delay, 250);

    nowMs += 250;
    fireTimer();
    assert.equal(notificationsA, 1);
    assert.equal(notificationsB, 1);
    assert.match(store.getLocalDay(), /^2026-09-03\|/);
    nowMs += 30_000;
    fireTimer();
    assert.equal(notificationsA, 1, 'unchanged checks must not reload screens');

    changeState('background');
    assert.equal(timers.size, 0);
    nowMs = new RealDate(2026, 8, 8, 9).getTime();
    changeState('active');
    assert.equal(notificationsA, 2);
    assert.match(store.getLocalDay(), /^2026-09-08\|/);
    assert.equal(timers.size, 1);
    changeState('active');
    assert.equal(timers.size, 1, 'duplicate resume events must not duplicate timers');
    assert.equal(notificationsA, 2);

    nowMs = new RealDate(2026, 7, 1, 9).getTime();
    fireTimer();
    assert.match(store.getLocalDay(), /^2026-08-01\|/);
    assert.equal(notificationsA, 3);
    nowMs = new RealDate(2026, 8, 10, 9).getTime();
    store.syncLocalDay(); // screen focus / operation boundary
    assert.equal(notificationsA, 4);

    unsubscribeA();
    assert.equal(nativeListeners.size, 1);
    unsubscribeB();
    assert.equal(nativeListeners.size, 0);
    assert.equal(timers.size, 0);

    appState.currentState = null; // native launch before AppState resolves
    unsubscribeA = store.subscribeLocalDay(() => {});
    assert.equal(timers.size, 1);
  } finally {
    unsubscribeA?.();
    unsubscribeB?.();
    global.Date = RealDate;
    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
    if (originalNative) require.cache[nativePath] = originalNative;
    else delete require.cache[nativePath];
    delete require.cache[storePath];
  }
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { failed++; console.error(`not ok - ${name}`, error); }
}
console.log(`${tests.length - failed}/${tests.length} date tests passed (${process.env.TZ})`);
if (failed) process.exitCode = 1;
