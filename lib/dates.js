// Pure date helpers. All date maths lives in lib/ (see CLAUDE.md rule 5).
// Dates are 'YYYY-MM-DD' strings. Arithmetic is done in UTC so it never
// depends on the machine's time zone or daylight saving.

const PERTH_TIME_ZONE = 'Australia/Perth';
const DAY_MS = 24 * 60 * 60 * 1000;

// Returns the calendar date (YYYY-MM-DD) of the given moment in Perth time.
function toPerthDateString(moment) {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PERTH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment);
}

// 'YYYY-MM-DD' -> milliseconds at UTC midnight. Throws on a malformed date.
function toUtcMs(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  const [, y, m, d] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  if (fromUtcMs(ms) !== date) throw new Error(`Invalid date: ${date}`);
  return ms;
}

function fromUtcMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(date, n) {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS);
}

// Every date from start to end, inclusive. Empty if end is before start.
function eachDate(start, end) {
  const dates = [];
  const endMs = toUtcMs(end);
  for (let ms = toUtcMs(start); ms <= endMs; ms += DAY_MS) dates.push(fromUtcMs(ms));
  return dates;
}

// Mon = 1 ... Sun = 7
function weekdayNumber(date) {
  return new Date(toUtcMs(date)).getUTCDay() || 7;
}

function isWeekend(date) {
  return weekdayNumber(date) >= 6;
}

// True for a real 'YYYY-MM-DD' date (so '2027-02-30' is false).
function isValidDate(date) {
  if (typeof date !== 'string') return false;
  try {
    toUtcMs(date);
    return true;
  } catch {
    return false;
  }
}

// The year after today's year; today is a Perth 'YYYY-MM-DD' string.
function defaultPlanningYear(today) {
  toUtcMs(today);
  return Number(today.slice(0, 4)) + 1;
}

module.exports = {
  PERTH_TIME_ZONE,
  toPerthDateString,
  addDays,
  eachDate,
  isWeekend,
  weekdayNumber,
  isValidDate,
  defaultPlanningYear,
};
