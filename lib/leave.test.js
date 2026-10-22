const test = require('node:test');
const assert = require('node:assert/strict');
const { usableDays, countWeekdays, balanceOn } = require('./leave');

const settings = {
  balance_hours: 21,
  balance_as_of: '2027-03-05', // a Friday
  accrual_hours_per_workday: 0.5846,
  hours_per_day: 7.6,
};

test('usableDays floors hours to whole days (21 h = 2 days)', () => {
  assert.equal(usableDays(21, 7.6), 2);
  assert.equal(usableDays(7.5, 7.6), 0);
  assert.equal(usableDays(0, 7.6), 0);
  // Exact multiples must not lose a day to floating-point noise
  assert.equal(usableDays(15.2, 7.6), 2);
  assert.equal(usableDays(22.8, 7.6), 3);
  assert.equal(usableDays(152, 7.6), 20);
  assert.equal(usableDays(16, 8), 2);
});

test('usableDays rejects a zero hours-per-day', () => {
  assert.throws(() => usableDays(10, 0), /greater than 0/);
});

test('countWeekdays counts strictly after, up to and including', () => {
  // Fri 5 Mar -> Mon 8 Mar 2027: Sat and Sun skipped, Mon counted
  assert.equal(countWeekdays('2027-03-05', '2027-03-08'), 1);
  // Over a weekend only: nothing
  assert.equal(countWeekdays('2027-03-05', '2027-03-07'), 0);
  // Same day or earlier: nothing
  assert.equal(countWeekdays('2027-03-05', '2027-03-05'), 0);
  assert.equal(countWeekdays('2027-03-05', '2027-03-01'), 0);
  // Two full weeks
  assert.equal(countWeekdays('2027-03-05', '2027-03-19'), 10);
  // Public holidays still count (Good Friday 26 Mar, Easter Monday 29 Mar)
  assert.equal(countWeekdays('2027-03-25', '2027-03-29'), 2);
  // A whole year: 2027 has 261 weekdays
  assert.equal(countWeekdays('2026-12-31', '2027-12-31'), 261);
});

test('balanceOn on balance_as_of is the recorded balance', () => {
  assert.deepEqual(balanceOn('2027-03-05', settings, []), { hours: 21, days: 2 });
});

test('balanceOn accrues across a weekend (weekdays only)', () => {
  // Fri 5 Mar -> Mon 8 Mar: only Monday accrues
  assert.deepEqual(balanceOn('2027-03-08', settings, []), { hours: 21.5846, days: 2 });
  // Sunday: no accrual yet
  assert.deepEqual(balanceOn('2027-03-07', settings, []), { hours: 21, days: 2 });
  // Two weeks later: 10 weekdays accrue, 26.846 h = 3 days
  assert.deepEqual(balanceOn('2027-03-19', settings, []), { hours: 26.846, days: 3 });
});

test('balanceOn deducts only leave dates before the date', () => {
  const leave = ['2027-03-09', '2027-03-10', '2027-03-11'];
  // On 10 Mar only 9 Mar is in the past: 21 + 3 * 0.5846 - 7.6
  assert.deepEqual(balanceOn('2027-03-10', settings, leave), { hours: 15.1538, days: 1 });
  // On 15 Mar all three are taken: 21 + 6 * 0.5846 - 22.8
  assert.deepEqual(balanceOn('2027-03-15', settings, leave), { hours: 1.7076, days: 0 });
});

test('balanceOn ignores leave on or before balance_as_of, weekends and duplicates', () => {
  const leave = ['2027-03-04', '2027-03-05', '2027-03-06', '2027-03-08', '2027-03-08'];
  // Only Mon 8 Mar counts, once
  assert.deepEqual(balanceOn('2027-03-09', settings, leave), { hours: 14.5692, days: 1 });
});

test('balanceOn can go negative when leave is short', () => {
  const leave = ['2027-03-08', '2027-03-09', '2027-03-10', '2027-03-11'];
  const result = balanceOn('2027-03-12', settings, leave);
  // 21 + 5 weekdays * 0.5846 - 4 * 7.6
  assert.equal(result.hours, -6.477);
  assert.ok(result.hours < 0);
  assert.equal(result.days, -1);
});
