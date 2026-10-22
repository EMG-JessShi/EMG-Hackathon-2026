const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { activityTripRange } = require('./activities');
const { buildFreeDates, longestBreak } = require('./breaks');

const activity = (fields) => ({ id: 'test', peak_start: '03-25', peak_end: '04-10', typical_days: 10, ...fields });

test('a range inside the year stays in the planning year', () => {
  // Japan cherry blossom: 03-25 to 04-10, 10 days
  assert.deepEqual(activityTripRange(activity({}), 2027), {
    range_start: '2027-03-25', range_end: '2027-04-10', leave_days: 6,
  });
});

test('a range with peak_end before peak_start wraps into the next year', () => {
  assert.deepEqual(activityTripRange(activity({ peak_start: '12-15', peak_end: '03-15', typical_days: 8 }), 2027), {
    range_start: '2027-12-15', range_end: '2028-03-15', leave_days: 5,
  });
  // Sydney New Year's Eve: 12-29 to 01-02
  const nye = activityTripRange(activity({ peak_start: '12-29', peak_end: '01-02', typical_days: 4 }), 2027);
  assert.equal(nye.range_start, '2027-12-29');
  assert.equal(nye.range_end, '2028-01-02');
});

test('leave days are the fewest weekdays in a typical_days run', () => {
  const leave = (typical_days) => activityTripRange(activity({ typical_days }), 2027).leave_days;
  assert.equal(leave(1), 0); // a Saturday
  assert.equal(leave(2), 0); // a weekend
  assert.equal(leave(3), 1);
  assert.equal(leave(4), 2);
  assert.equal(leave(7), 5);
  assert.equal(leave(9), 5); // Sat to the next Sun
  assert.equal(leave(10), 6);
  assert.equal(leave(14), 10);
  assert.equal(leave(16), 10);
});

test('the leave days give at least typical_days off within the range', () => {
  const free = buildFreeDates(2027, []);
  const range = activityTripRange(activity({}), 2027);
  const brk = longestBreak({ rangeStart: range.range_start, rangeEnd: range.range_end, leaveDays: range.leave_days, freeDates: free });
  assert.ok(brk.length >= 10);
});

test('02-29 becomes 02-28 outside leap years', () => {
  const r = activityTripRange(activity({ peak_start: '02-01', peak_end: '02-29' }), 2027);
  assert.equal(r.range_end, '2027-02-28');
  assert.equal(activityTripRange(activity({ peak_start: '02-01', peak_end: '02-29' }), 2028).range_end, '2028-02-29');
});

test('rejects bad peak dates and typical_days', () => {
  assert.throws(() => activityTripRange(activity({ peak_start: '13-01' }), 2027), /Invalid month and day/);
  assert.throws(() => activityTripRange(activity({ peak_end: '4-10' }), 2027), /Invalid month and day/);
  assert.throws(() => activityTripRange(activity({ typical_days: 0 }), 2027), /typical_days/);
});

test('every activity in data/activities.json gives a valid range', () => {
  const all = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'activities.json'), 'utf8'));
  for (const a of all) {
    const r = activityTripRange(a, 2027);
    assert.ok(r.range_start < r.range_end, a.id);
    assert.ok(r.leave_days >= 0, a.id);
  }
});
