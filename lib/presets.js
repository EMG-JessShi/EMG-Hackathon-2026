// Preset trips: the 2 best breaks around WA public-holiday clusters. Never
// hard-coded: the holidays decide. Pure functions only.

const { addDays } = require('./dates');
const { longestBreak } = require('./breaks');

// Holidays this close together (in days) form one cluster, e.g. Christmas,
// Boxing Day and New Year.
const CLUSTER_GAP_DAYS = 7;
// How far either side of a cluster a candidate range reaches.
const RANGE_PADDING_DAYS = 9;
// A preset aims for at least this many days off in a row (a week off with a
// weekend at each end), using as few leave days as that takes.
const TARGET_BREAK_DAYS = 9;
const MAX_LEAVE_DAYS = 10;

// Groups sorted holidays into clusters; each cluster must start in `year`
// but may run into January of the next year.
function clusterHolidays(year, holidays) {
  const clusters = [];
  for (const h of holidays) {
    const last = clusters[clusters.length - 1];
    if (last && h.date <= addDays(last[last.length - 1].date, CLUSTER_GAP_DAYS)) {
      last.push(h);
    } else if (h.date.startsWith(`${year}-`)) {
      clusters.push([h]);
    }
  }
  return clusters;
}

function clusterTitle(cluster) {
  const names = cluster.map((h) => h.name || '');
  const has = (pattern) => names.some((n) => pattern.test(n));
  if (has(/christmas/i) && has(/new year/i)) return 'Christmas to New Year';
  if (has(/good friday|easter/i)) return 'Easter';
  return [...new Set(names.filter(Boolean))].join(' and ') || 'Public holiday break';
}

// The fewest leave days giving a TARGET_BREAK_DAYS break, or the most days
// off if no amount of leave reaches it.
function bestCandidate(cluster, freeDates, firstDay, lastDay) {
  const minDate = (a, b) => (a < b ? a : b);
  const maxDate = (a, b) => (a > b ? a : b);
  const rangeStart = maxDate(addDays(cluster[0].date, -RANGE_PADDING_DAYS), firstDay);
  const rangeEnd = minDate(addDays(cluster[cluster.length - 1].date, RANGE_PADDING_DAYS), lastDay);

  let fallback = null;
  for (let leaveDays = 1; leaveDays <= MAX_LEAVE_DAYS; leaveDays++) {
    const brk = longestBreak({ rangeStart, rangeEnd, leaveDays, freeDates });
    if (!brk || brk.leave_used === 0) continue;
    const candidate = {
      title: clusterTitle(cluster),
      range_start: rangeStart,
      range_end: rangeEnd,
      leave_days: brk.leave_used,
      length: brk.length,
      score: brk.length / brk.leave_used,
    };
    if (brk.length >= TARGET_BREAK_DAYS) return candidate;
    if (!fallback || candidate.length > fallback.length) fallback = candidate;
  }
  return fallback;
}

// Exactly 2 presets when the year has at least 2 holiday clusters: the
// highest days off per leave day, then the longer break, then the earlier one.
// Returned in date order.
// publicHolidays: WA public holidays as { date, name } rows (or date strings)
// for `year` and the next; freeDates from buildFreeDates(year, ...).
function pickPresetTrips({ year, publicHolidays, freeDates }) {
  const holidays = publicHolidays
    .map((h) => (typeof h === 'string' ? { date: h, name: '' } : h))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const firstDay = `${year}-01-01`;
  const lastDay = `${year + 1}-12-31`;

  return clusterHolidays(year, holidays)
    .map((cluster) => bestCandidate(cluster, freeDates, firstDay, lastDay))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.length - a.length || (a.range_start < b.range_start ? -1 : 1))
    .slice(0, 2)
    .sort((a, b) => (a.range_start < b.range_start ? -1 : 1))
    .map(({ title, range_start, range_end, leave_days }) => ({ title, range_start, range_end, leave_days }));
}

module.exports = { pickPresetTrips };
