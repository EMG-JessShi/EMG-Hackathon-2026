const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFreeDates, longestBreak } = require('./breaks');

// WA public holidays used in these tests (observed dates)
const WA_2027 = [
  '2027-01-01', '2027-01-26', '2027-03-01', '2027-03-26', '2027-03-29',
  '2027-04-26', '2027-06-07', '2027-09-27', '2027-12-27', '2027-12-28',
];
const WA_2028 = ['2028-01-03'];
const free2027 = buildFreeDates(2027, [...WA_2027, ...WA_2028]);

test('buildFreeDates has weekends and public holidays for the year and the next', () => {
  assert.equal(free2027.has('2027-03-27'), true); // Saturday
  assert.equal(free2027.has('2027-03-26'), true); // Good Friday
  assert.equal(free2027.has('2027-03-30'), false); // ordinary Tuesday
  assert.equal(free2027.has('2028-01-03'), true); // New Year observed
  assert.equal(free2027.has('2028-12-31'), true); // Sunday, next year
  assert.equal(free2027.has('2026-12-27'), false); // previous year left out
  // 2027 has 104 weekend days; 2028 starts on a Saturday and is a leap year, so 106
  assert.equal(buildFreeDates(2027, []).size, 210);
});

test('buildFreeDates ignores holidays outside the two years and duplicates', () => {
  const free = buildFreeDates(2027, ['2026-12-25', '2029-01-01', '2027-03-26', '2027-03-26']);
  assert.equal(free.has('2026-12-25'), false);
  assert.equal(free.has('2029-01-01'), false);
  assert.equal(free.size, 211);
});

test('Easter 2027: 4 leave days give 10 days off from Good Friday', () => {
  const result = longestBreak({
    rangeStart: '2027-03-20', rangeEnd: '2027-04-05', leaveDays: 4, freeDates: free2027,
  });
  assert.deepEqual(result, {
    start: '2027-03-26',
    end: '2027-04-04',
    length: 10,
    leave_used: 4,
    leave_dates: ['2027-03-30', '2027-03-31', '2027-04-01', '2027-04-02'],
  });
});

test('Easter 2027 with no leave is the 4-day long weekend', () => {
  const result = longestBreak({
    rangeStart: '2027-03-20', rangeEnd: '2027-04-05', leaveDays: 0, freeDates: free2027,
  });
  assert.equal(result.start, '2027-03-26');
  assert.equal(result.end, '2027-03-29');
  assert.equal(result.length, 4);
  assert.equal(result.leave_used, 0);
  assert.deepEqual(result.leave_dates, []);
});

test('Christmas 2027 crosses into 2028 with observed holidays', () => {
  // Sat 25 Dec to Mon 3 Jan: leave on 29, 30, 31 Dec only
  const result = longestBreak({
    rangeStart: '2027-12-18', rangeEnd: '2028-01-09', leaveDays: 3, freeDates: free2027,
  });
  assert.deepEqual(result, {
    start: '2027-12-25',
    end: '2028-01-03',
    length: 10,
    leave_used: 3,
    leave_dates: ['2027-12-29', '2027-12-30', '2027-12-31'],
  });
});

test('leave_used is lower than asked when the range tops out', () => {
  // Mon 5 to Sun 11 Apr 2027: only 5 weekdays to cover
  const result = longestBreak({
    rangeStart: '2027-04-05', rangeEnd: '2027-04-11', leaveDays: 8, freeDates: free2027,
  });
  assert.equal(result.start, '2027-04-05');
  assert.equal(result.end, '2027-04-11');
  assert.equal(result.length, 7);
  assert.equal(result.leave_used, 5);
});

test('a tie on length picks the window using less leave', () => {
  // Thu 1 to Sun 4 Apr 2027 with 1 leave day: Fri to Sun (3 days) is the longest
  const one = longestBreak({
    rangeStart: '2027-04-01', rangeEnd: '2027-04-04', leaveDays: 1, freeDates: free2027,
  });
  assert.equal(one.start, '2027-04-02');
  assert.equal(one.length, 3);
  // A 2-day range of Sat and Sun with leave to spare uses none
  const weekend = longestBreak({
    rangeStart: '2027-04-03', rangeEnd: '2027-04-04', leaveDays: 5, freeDates: free2027,
  });
  assert.equal(weekend.length, 2);
  assert.equal(weekend.leave_used, 0);
});

test('returns null when no day can be off', () => {
  // Tue 30 Mar to Fri 2 Apr 2027: all working days, no leave
  assert.equal(longestBreak({
    rangeStart: '2027-03-30', rangeEnd: '2027-04-02', leaveDays: 0, freeDates: free2027,
  }), null);
  // End before start
  assert.equal(longestBreak({
    rangeStart: '2027-04-02', rangeEnd: '2027-03-30', leaveDays: 3, freeDates: free2027,
  }), null);
});

test('rejects a leave_days that is not a whole number of 0 or more', () => {
  const args = { rangeStart: '2027-03-20', rangeEnd: '2027-04-05', freeDates: free2027 };
  assert.throws(() => longestBreak({ ...args, leaveDays: -1 }), /whole number/);
  assert.throws(() => longestBreak({ ...args, leaveDays: 1.5 }), /whole number/);
});
