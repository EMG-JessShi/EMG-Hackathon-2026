const test = require('node:test');
const assert = require('node:assert/strict');
const { eachDate } = require('./dates');
const { perthWeather, auCrowd, cnCrowd, buildCalendar } = require('./calendar');

// Holiday rows like the holidays table, one row per date. The ranges are the
// 2027 seed data (data/holidays-seed.json on team/api) plus WA public holidays.
function rows(country, type, name, start, end = start, isEstimate = 0) {
  return eachDate(start, end).map((date) => ({ date, name, country, type, is_estimate: isEstimate }));
}
const holidays2027 = [
  ...rows('AU', 'public', "New Year's Day", '2027-01-01'),
  ...rows('AU', 'public', 'Australia Day', '2027-01-26'),
  ...rows('AU', 'public', 'Labour Day', '2027-03-01'),
  ...rows('AU', 'public', 'Good Friday', '2027-03-26'),
  ...rows('AU', 'public', 'Easter Monday', '2027-03-29'),
  ...rows('AU', 'public', 'Anzac Day', '2027-04-26'),
  ...rows('AU', 'public', 'Western Australia Day', '2027-06-07'),
  ...rows('AU', 'public', "King's Birthday", '2027-09-27'),
  ...rows('AU', 'public', 'Christmas Day', '2027-12-27'),
  ...rows('AU', 'public', 'Boxing Day', '2027-12-28'),
  ...rows('AU', 'school', 'WA school holidays', '2027-01-01', '2027-01-31'),
  ...rows('AU', 'school', 'WA school holidays', '2027-04-10', '2027-04-25'),
  ...rows('AU', 'school', 'WA school holidays', '2027-07-03', '2027-07-18'),
  ...rows('AU', 'school', 'WA school holidays', '2027-09-25', '2027-10-10'),
  ...rows('AU', 'school', 'WA school holidays', '2027-12-17', '2027-12-31'),
  ...rows('CN', 'school', 'China winter school holidays (estimate)', '2027-01-15', '2027-02-25', 1),
  ...rows('CN', 'school', 'China summer school holidays (estimate)', '2027-07-01', '2027-08-31', 1),
  ...rows('CN', 'cn_holiday', "New Year's Day", '2027-01-01', '2027-01-01', 1),
  ...rows('CN', 'cn_holiday', 'Spring Festival', '2027-02-05', '2027-02-11', 1),
  ...rows('CN', 'cn_holiday', 'Qingming Festival', '2027-04-05', '2027-04-05', 1),
  ...rows('CN', 'cn_holiday', 'May Day', '2027-05-01', '2027-05-05', 1),
  ...rows('CN', 'cn_holiday', 'Dragon Boat Festival', '2027-06-09', '2027-06-09', 1),
  ...rows('CN', 'cn_holiday', 'Mid-Autumn Festival', '2027-09-15', '2027-09-15', 1),
  ...rows('CN', 'cn_holiday', 'National Day', '2027-10-01', '2027-10-07', 1),
];

const settings = {
  balance_hours: 21,
  balance_as_of: '2026-12-31',
  accrual_hours_per_workday: 0.5846,
  hours_per_day: 7.6,
};

const easter = {
  id: 1, title: 'Easter', range_start: '2027-03-20', range_end: '2027-04-05', leave_days: 4, enabled: true,
};

test('perthWeather by month', () => {
  const weather = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(perthWeather);
  assert.deepEqual(weather, [
    'hot', 'hot', 'comfortable', 'comfortable', 'comfortable', 'cold',
    'cold', 'cold', 'comfortable', 'comfortable', 'comfortable', 'hot',
  ]);
});

test('auCrowd counts WA school and public holiday days in each month of 2027', () => {
  const crowd = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => auCrowd(m, 2027, holidays2027));
  assert.deepEqual(crowd, [
    'high', // 31 school days
    'low', 'low', // Mar: 3 public holidays
    'high', // Apr: 16 school days + Anzac Day
    'low', 'low', 'high', 'low',
    'mid', // Sep: 25 to 30 (King's Birthday falls inside), 6 days
    'high', // Oct: 1 to 10, exactly 10 days
    'low', 'high',
  ]);
});

test('auCrowd boundaries: 3 low, 4 mid, 9 mid, 10 high', () => {
  const school = (n) => rows('AU', 'school', 'WA school holidays', '2027-11-01', `2027-11-${String(n).padStart(2, '0')}`);
  assert.equal(auCrowd(11, 2027, school(3)), 'low');
  assert.equal(auCrowd(11, 2027, school(4)), 'mid');
  assert.equal(auCrowd(11, 2027, school(9)), 'mid');
  assert.equal(auCrowd(11, 2027, school(10)), 'high');
  // The same date as both school and public holiday counts once
  const both = [...school(3), ...rows('AU', 'public', 'Test', '2027-11-01')];
  assert.equal(auCrowd(11, 2027, both), 'low');
  // Another year's rows don't count
  assert.equal(auCrowd(1, 2028, holidays2027), 'low');
});

test('cnCrowd for each month of 2027 (Feb has Spring Festival, so peak)', () => {
  const crowd = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => cnCrowd(m, 2027, holidays2027));
  assert.deepEqual(crowd, [
    'high', // winter school holidays beat New Year's Day
    'peak', 'low', 'mid', 'peak', 'mid', 'high', 'high', 'mid', 'peak', 'low', 'low',
  ]);
});

test('cnCrowd recognises the Chinese names holiday-cn uses, and ignores make-up workdays', () => {
  assert.equal(cnCrowd(2, 2027, rows('CN', 'cn_holiday', '春节', '2027-02-06')), 'peak');
  assert.equal(cnCrowd(5, 2027, rows('CN', 'cn_holiday', '劳动节', '2027-05-01')), 'peak');
  assert.equal(cnCrowd(10, 2027, rows('CN', 'cn_holiday', '国庆节', '2027-10-01')), 'peak');
  assert.equal(cnCrowd(6, 2027, rows('CN', 'cn_holiday', '端午节', '2027-06-09')), 'mid');
  assert.equal(cnCrowd(9, 2027, rows('CN', 'cn_workday', '国庆节', '2027-09-26')), 'low');
});

test('buildCalendar: 365 days with holiday flags', () => {
  const cal = buildCalendar({ year: 2027, holidays: holidays2027, trips: [], settings });
  assert.equal(cal.year, 2027);
  assert.equal(cal.days.length, 365);
  assert.deepEqual(cal.days[0], {
    date: '2027-01-01',
    weekday: 5,
    is_weekend: false,
    public_holiday: "New Year's Day",
    school_holiday: true,
    cn_school_holiday: false,
    cn_holiday: { name: "New Year's Day", is_estimate: true },
    cn_workday: false,
    leave: false,
    trip_ids: [],
  });
  const feb5 = cal.days.find((d) => d.date === '2027-02-05');
  assert.equal(feb5.cn_school_holiday, true);
  assert.deepEqual(feb5.cn_holiday, { name: 'Spring Festival', is_estimate: true });
  assert.equal(feb5.public_holiday, null);
  const sat = cal.days.find((d) => d.date === '2027-03-27');
  assert.equal(sat.weekday, 6);
  assert.equal(sat.is_weekend, true);
});

test('buildCalendar: month tags and names', () => {
  const cal = buildCalendar({ year: 2027, holidays: holidays2027, trips: [], settings });
  assert.equal(cal.months.length, 12);
  const feb = cal.months[1];
  assert.equal(feb.month, 2);
  assert.equal(feb.name, 'February');
  assert.equal(feb.weather, 'hot');
  assert.equal(feb.au_crowd, 'low');
  assert.equal(feb.cn_crowd, 'peak');
});

test('buildCalendar: enabled trips mark their break and leave days', () => {
  const disabled = { ...easter, id: 2, enabled: false, range_start: '2027-06-01', range_end: '2027-06-14' };
  const cal = buildCalendar({ year: 2027, holidays: holidays2027, trips: [easter, disabled], settings });
  const day = (date) => cal.days.find((d) => d.date === date);
  // The break is 26 Mar to 4 Apr; leave 30 Mar to 2 Apr
  assert.deepEqual(day('2027-03-25').trip_ids, []);
  assert.deepEqual(day('2027-03-26').trip_ids, [1]);
  assert.equal(day('2027-03-26').leave, false);
  assert.equal(day('2027-03-30').leave, true);
  assert.equal(day('2027-04-02').leave, true);
  assert.deepEqual(day('2027-04-04').trip_ids, [1]);
  assert.deepEqual(day('2027-04-05').trip_ids, []);
  // The disabled trip shows nowhere
  assert.equal(cal.days.some((d) => d.trip_ids.includes(2)), false);
  assert.equal(day('2027-06-01').leave, false);
});

test('buildCalendar: balance at the end of each month', () => {
  const cal = buildCalendar({ year: 2027, holidays: holidays2027, trips: [easter], settings });
  // To 31 Mar: 64 weekdays accrue (21 + 20 + 23), minus leave on 30 and 31 Mar:
  // 21 + 64 * 0.5846 - 2 * 7.6
  assert.deepEqual(cal.months[2].balance_end, { hours: 43.2144, days: 5 });
  // To 30 Apr: 86 weekdays, minus all 4 leave days
  assert.deepEqual(cal.months[3].balance_end, { hours: 40.8756, days: 5 });
});

test('buildCalendar: leave on the last day of a month counts in that month', () => {
  const trip = {
    id: 3, enabled: true, range_start: '2027-03-31', range_end: '2027-03-31', leave_days: 1,
    break: { start: '2027-03-31', end: '2027-03-31', length: 1, leave_used: 1, leave_dates: ['2027-03-31'] },
  };
  const cal = buildCalendar({ year: 2027, holidays: holidays2027, trips: [trip], settings });
  assert.deepEqual(cal.months[2].balance_end, { hours: 50.8144, days: 6 });
  assert.equal(cal.days.find((d) => d.date === '2027-03-31').leave, true);
});

test('buildCalendar: a trip crossing into the next year marks only this year', () => {
  const xmas = {
    id: 4, enabled: true, range_start: '2027-12-18', range_end: '2028-01-09', leave_days: 3,
  };
  const withNewYear = [...holidays2027, ...rows('AU', 'public', "New Year's Day", '2028-01-03')];
  const cal = buildCalendar({ year: 2027, holidays: withNewYear, trips: [xmas], settings });
  assert.equal(cal.days.length, 365);
  assert.deepEqual(cal.days.find((d) => d.date === '2027-12-25').trip_ids, [4]);
  assert.deepEqual(cal.days.find((d) => d.date === '2027-12-31').trip_ids, [4]);
  assert.equal(cal.days.find((d) => d.date === '2027-12-29').leave, true);
  // The 2028 calendar shows the rest of the trip
  const next = buildCalendar({ year: 2028, holidays: withNewYear, trips: [xmas], settings });
  assert.deepEqual(next.days.find((d) => d.date === '2028-01-03').trip_ids, [4]);
  assert.equal(next.days.length, 366);
});
