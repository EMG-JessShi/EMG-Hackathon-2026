const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFreeDates, longestBreak } = require('./breaks');
const { pickPresetTrips } = require('./presets');

// WA public holidays, observed dates
const WA_2027 = [
  ['2027-01-01', "New Year's Day"], ['2027-01-26', 'Australia Day'], ['2027-03-01', 'Labour Day'],
  ['2027-03-26', 'Good Friday'], ['2027-03-29', 'Easter Monday'], ['2027-04-26', 'Anzac Day'],
  ['2027-06-07', 'Western Australia Day'], ['2027-09-27', "King's Birthday"],
  ['2027-12-27', 'Christmas Day'], ['2027-12-28', 'Boxing Day'], ['2028-01-03', "New Year's Day"],
].map(([date, name]) => ({ date, name }));

function presetsFor(year, holidays) {
  const freeDates = buildFreeDates(year, holidays.map((h) => (typeof h === 'string' ? h : h.date)));
  return { freeDates, presets: pickPresetTrips({ year, publicHolidays: holidays, freeDates }) };
}

test('2027 presets are Easter and Christmas to New Year', () => {
  const { presets } = presetsFor(2027, WA_2027);
  assert.deepEqual(presets, [
    { title: 'Easter', range_start: '2027-03-17', range_end: '2027-04-07', leave_days: 4 },
    { title: 'Christmas to New Year', range_start: '2027-12-18', range_end: '2028-01-12', leave_days: 3 },
  ]);
});

test('2027 presets give the expected breaks (26 to 29 Mar Easter; observed Christmas and New Year)', () => {
  const { presets, freeDates } = presetsFor(2027, WA_2027);
  const breaks = presets.map((p) => longestBreak({
    rangeStart: p.range_start, rangeEnd: p.range_end, leaveDays: p.leave_days, freeDates,
  }));
  assert.equal(breaks[0].start, '2027-03-26');
  assert.equal(breaks[0].end, '2027-04-04');
  assert.equal(breaks[0].length, 10);
  assert.equal(breaks[1].start, '2027-12-25');
  assert.equal(breaks[1].end, '2028-01-03');
  assert.equal(breaks[1].length, 10);
  assert.deepEqual(breaks[1].leave_dates, ['2027-12-29', '2027-12-30', '2027-12-31']);
});

test('the holidays decide: moving Easter changes the pick', () => {
  // Without Easter, the next best cluster takes its place
  const noEaster = WA_2027.filter((h) => !/good friday|easter/i.test(h.name));
  const { presets } = presetsFor(2027, noEaster);
  assert.equal(presets.length, 2);
  assert.equal(presets.some((p) => p.title === 'Easter'), false);
  assert.equal(presets[1].title, 'Christmas to New Year');
});

test('plain date strings work too, with a generic title', () => {
  const { presets } = presetsFor(2027, WA_2027.map((h) => h.date));
  assert.equal(presets.length, 2);
  assert.equal(presets[0].range_start, '2027-03-17');
  assert.equal(presets[0].title, 'Public holiday break');
});

test('clusters must start in the planning year', () => {
  // Only next year's New Year holiday: no cluster starts in 2027
  const { presets } = presetsFor(2027, [{ date: '2028-01-03', name: "New Year's Day" }]);
  assert.deepEqual(presets, []);
});

test('fewer than 2 clusters gives fewer presets', () => {
  const { presets } = presetsFor(2027, [{ date: '2027-06-07', name: 'Western Australia Day' }]);
  assert.equal(presets.length, 1);
  assert.equal(presets[0].title, 'Western Australia Day');
  assert.ok(presets[0].leave_days >= 1);
});

// WA public holidays 2028 (observed), plus New Year 2029
const WA_2028 = [
  ['2028-01-03', "New Year's Day"], ['2028-01-26', 'Australia Day'], ['2028-03-06', 'Labour Day'],
  ['2028-04-14', 'Good Friday'], ['2028-04-17', 'Easter Monday'], ['2028-04-25', 'Anzac Day'],
  ['2028-06-05', 'Western Australia Day'], ['2028-09-25', "King's Birthday"],
  ['2028-12-25', 'Christmas Day'], ['2028-12-26', 'Boxing Day'], ['2029-01-01', "New Year's Day"],
].map(([date, name]) => ({ date, name }));

test("2028: the observed New Year on 3 Jan belongs to 2027's Christmas, not a 2028 preset", () => {
  const lastDecember = [
    { date: '2027-12-27', name: 'Christmas Day' }, { date: '2027-12-28', name: 'Boxing Day' },
  ];
  for (const holidays of [[...lastDecember, ...WA_2028], WA_2028]) {
    const { presets } = presetsFor(2028, holidays);
    assert.equal(presets.length, 2);
    for (const p of presets) {
      assert.ok(p.range_start > '2028-01-12', `${p.title} overlaps the 2027 Christmas trip`);
    }
    assert.deepEqual(presets.map((p) => p.title), ['Easter', 'Christmas to New Year']);
  }
});

test('2028 with only the 2027 Christmas dates known gives no New Year preset', () => {
  // What the app has for 2028 before 2028 holidays are synced
  const holidays = [
    { date: '2027-12-27', name: 'Christmas Day' },
    { date: '2027-12-28', name: 'Boxing Day' },
    { date: '2028-01-03', name: "New Year's Day" },
  ];
  assert.deepEqual(presetsFor(2028, holidays).presets, []);
  assert.deepEqual(presetsFor(2028, holidays.slice(2)).presets, []);
});
