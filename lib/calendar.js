// Year calendar: month tags (Perth weather, AU and CN crowd) and the day grid.
// Pure functions only. `holidays` are rows from the holidays table:
// { date, name, country, type, is_estimate }, one row per date.

const { addDays, eachDate, isWeekend, weekdayNumber } = require('./dates');
const { usableDays, balanceOn } = require('./leave');
const { buildFreeDates, longestBreak } = require('./breaks');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// China holidays that make a month "peak". holiday-cn names them in Chinese.
const CN_PEAK_HOLIDAY = /spring festival|may day|labour day|national day|春节|劳动节|国庆/i;

function monthPrefix(month, year) {
  return `${year}-${String(month).padStart(2, '0')}-`;
}

function inMonth(holidays, month, year) {
  const prefix = monthPrefix(month, year);
  return holidays.filter((h) => h.date.startsWith(prefix));
}

// Static by month: Jan, Feb and Dec hot; Mar to May and Sep to Nov comfortable; Jun to Aug cold.
function perthWeather(month) {
  if (month === 12 || month <= 2) return 'hot';
  if (month >= 6 && month <= 8) return 'cold';
  return 'comfortable';
}

// Days in the month covered by WA school holidays or WA public holidays:
// 0 to 3 low, 4 to 9 mid, 10+ high.
function auCrowd(month, year, holidays) {
  const days = new Set(
    inMonth(holidays, month, year)
      .filter((h) => h.country === 'AU' && (h.type === 'school' || h.type === 'public'))
      .map((h) => h.date)
  );
  if (days.size >= 10) return 'high';
  if (days.size >= 4) return 'mid';
  return 'low';
}

// peak: Spring Festival, May Day or National Day; high: China school holidays;
// mid: any other China holiday; otherwise low.
function cnCrowd(month, year, holidays) {
  const cn = inMonth(holidays, month, year).filter((h) => h.country === 'CN');
  const cnHolidays = cn.filter((h) => h.type === 'cn_holiday');
  if (cnHolidays.some((h) => CN_PEAK_HOLIDAY.test(h.name))) return 'peak';
  if (cn.some((h) => h.type === 'school')) return 'high';
  if (cnHolidays.length > 0) return 'mid';
  return 'low';
}

// The break a trip actually takes: its own `break` if the caller already
// worked it out, otherwise the longest break over its range.
function tripBreak(trip, publicHolidayDates) {
  if (trip.break !== undefined) return trip.break;
  return longestBreak({
    rangeStart: trip.range_start,
    rangeEnd: trip.range_end,
    leaveDays: trip.leave_days,
    freeDates: buildFreeDates(Number(trip.range_start.slice(0, 4)), publicHolidayDates),
  });
}

// Balance at the end of `date`: like balanceOn, but leave taken on `date` itself
// is also deducted.
function endOfDay(date, settings, leaveDates) {
  const start = balanceOn(date, settings, leaveDates);
  const takenToday =
    leaveDates.includes(date) && date > settings.balance_as_of && !isWeekend(date);
  if (!takenToday) return start;
  const hours = Math.round((start.hours - settings.hours_per_day) * 10000) / 10000;
  return { hours, days: usableDays(hours, settings.hours_per_day) };
}

// The GET /api/calendar response for `year`. Only enabled trips count. Trips
// mark the days of their break (start to end); every enabled trip's leave,
// in any year, feeds the rolling balance.
function buildCalendar({ year, holidays, trips, settings }) {
  const publicHolidayDates = holidays
    .filter((h) => h.country === 'AU' && h.type === 'public')
    .map((h) => h.date);

  const byDate = new Map();
  for (const h of holidays) {
    if (!byDate.has(h.date)) byDate.set(h.date, []);
    byDate.get(h.date).push(h);
  }

  const spans = [];
  const leaveDates = new Set();
  for (const trip of trips.filter((t) => t.enabled)) {
    const brk = tripBreak(trip, publicHolidayDates);
    if (!brk) continue;
    spans.push({ id: trip.id, start: brk.start, end: brk.end });
    for (const d of brk.leave_dates) leaveDates.add(d);
  }
  const leaveList = [...leaveDates].sort();

  const days = eachDate(`${year}-01-01`, `${year}-12-31`).map((date) => {
    const rows = byDate.get(date) || [];
    const find = (country, type) => rows.find((h) => h.country === country && h.type === type);
    const publicHoliday = find('AU', 'public');
    const cnHoliday = find('CN', 'cn_holiday');
    return {
      date,
      weekday: weekdayNumber(date),
      is_weekend: isWeekend(date),
      public_holiday: publicHoliday ? publicHoliday.name : null,
      school_holiday: Boolean(find('AU', 'school')),
      cn_school_holiday: Boolean(find('CN', 'school')),
      cn_holiday: cnHoliday ? { name: cnHoliday.name, is_estimate: Boolean(cnHoliday.is_estimate) } : null,
      cn_workday: Boolean(find('CN', 'cn_workday')),
      leave: leaveDates.has(date),
      trip_ids: spans.filter((s) => s.start <= date && date <= s.end).map((s) => s.id),
    };
  });

  const months = MONTH_NAMES.map((name, i) => {
    const month = i + 1;
    const lastDay = addDays(month === 12 ? `${year + 1}-01-01` : `${monthPrefix(month + 1, year)}01`, -1);
    return {
      month,
      name,
      weather: perthWeather(month),
      au_crowd: auCrowd(month, year, holidays),
      cn_crowd: cnCrowd(month, year, holidays),
      balance_end: endOfDay(lastDay, settings, leaveList),
    };
  });

  return { year, months, days };
}

module.exports = { perthWeather, auCrowd, cnCrowd, buildCalendar };
