// Longest break maths (CLAUDE.md rule 6). Pure functions only.

const { eachDate, isWeekend } = require('./dates');

// Weekends plus WA public holidays for `year` and the next year, so trips
// that cross into January still see the right free days.
function buildFreeDates(year, publicHolidayDates = []) {
  const firstYear = String(year);
  const nextYear = String(year + 1);
  const free = new Set();
  for (const date of eachDate(`${firstYear}-01-01`, `${nextYear}-12-31`)) {
    if (isWeekend(date)) free.add(date);
  }
  for (const date of publicHolidayDates) {
    const y = date.slice(0, 4);
    if (y === firstYear || y === nextYear) free.add(date);
  }
  return free;
}

// Longest run of consecutive days off inside rangeStart..rangeEnd, using at
// most leaveDays leave days on the days that aren't free. A sliding window
// over the range: grow the right edge, and shrink the left edge whenever the
// window needs more leave than allowed.
// Ties on length go to the window using less leave, then to the later start
// (more leave has accrued by then). Returns null if no day in the range can
// be off.
function longestBreak({ rangeStart, rangeEnd, leaveDays, freeDates }) {
  if (!Number.isInteger(leaveDays) || leaveDays < 0) {
    throw new Error('leave_days must be a whole number of 0 or more');
  }
  const days = eachDate(rangeStart, rangeEnd);
  let best = null;
  let left = 0;
  let leaveInWindow = 0;

  for (let right = 0; right < days.length; right++) {
    if (!freeDates.has(days[right])) leaveInWindow++;
    while (leaveInWindow > leaveDays) {
      if (!freeDates.has(days[left])) leaveInWindow--;
      left++;
    }
    const length = right - left + 1;
    if (length === 0) continue;
    if (
      !best ||
      length > best.length ||
      (length === best.length && leaveInWindow <= best.leaveUsed)
    ) {
      best = { left, right, length, leaveUsed: leaveInWindow };
    }
  }

  if (!best) return null;
  const window = days.slice(best.left, best.right + 1);
  return {
    start: window[0],
    end: window[window.length - 1],
    length: best.length,
    leave_used: best.leaveUsed,
    leave_dates: window.filter((d) => !freeDates.has(d)),
  };
}

module.exports = { buildFreeDates, longestBreak };
