const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toPerthDateString, addDays, eachDate, isWeekend, weekdayNumber, isValidDate, defaultPlanningYear,
} = require('./dates');

test('toPerthDateString uses Perth time (UTC+8)', () => {
  // 20:00 UTC on 31 Dec is already 1 Jan in Perth
  assert.equal(toPerthDateString(new Date('2026-12-31T20:00:00Z')), '2027-01-01');
  assert.equal(toPerthDateString(new Date('2027-03-26T00:00:00Z')), '2027-03-26');
});

test('addDays crosses months, years and leap days', () => {
  assert.equal(addDays('2027-01-31', 1), '2027-02-01');
  assert.equal(addDays('2027-12-31', 1), '2028-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
  assert.equal(addDays('2027-03-26', 0), '2027-03-26');
});

test('addDays rejects malformed dates', () => {
  assert.throws(() => addDays('2027-02-30', 1), /Invalid date/);
  assert.throws(() => addDays('27-1-1', 1), /Invalid date/);
});

test('eachDate is inclusive and empty when end is before start', () => {
  assert.deepEqual(eachDate('2027-12-30', '2028-01-02'), [
    '2027-12-30', '2027-12-31', '2028-01-01', '2028-01-02',
  ]);
  assert.deepEqual(eachDate('2027-03-26', '2027-03-26'), ['2027-03-26']);
  assert.deepEqual(eachDate('2027-03-27', '2027-03-26'), []);
});

test('weekdayNumber is Mon = 1 to Sun = 7, and isWeekend matches', () => {
  // 2027-03-26 is Good Friday, a Friday
  assert.equal(weekdayNumber('2027-03-22'), 1);
  assert.equal(weekdayNumber('2027-03-26'), 5);
  assert.equal(weekdayNumber('2027-03-27'), 6);
  assert.equal(weekdayNumber('2027-03-28'), 7);
  assert.equal(isWeekend('2027-03-26'), false);
  assert.equal(isWeekend('2027-03-27'), true);
  assert.equal(isWeekend('2027-03-28'), true);
});

test('isValidDate accepts only real YYYY-MM-DD dates', () => {
  assert.equal(isValidDate('2027-03-26'), true);
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isValidDate('2027-02-29'), false);
  assert.equal(isValidDate('2027-02-30'), false);
  assert.equal(isValidDate('2027-13-01'), false);
  assert.equal(isValidDate('2027-3-26'), false);
  assert.equal(isValidDate('2027-03-26T00:00:00Z'), false);
  assert.equal(isValidDate(''), false);
  assert.equal(isValidDate(null), false);
  assert.equal(isValidDate(20270326), false);
});

test('defaultPlanningYear is the year after today', () => {
  assert.equal(defaultPlanningYear('2026-10-22'), 2027);
  assert.equal(defaultPlanningYear('2026-01-01'), 2027);
  assert.equal(defaultPlanningYear('2027-12-31'), 2028);
  assert.throws(() => defaultPlanningYear('2026-02-30'), /Invalid date/);
});
