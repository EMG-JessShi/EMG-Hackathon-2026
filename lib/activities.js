// Activity trip ranges ("Plan this"). Pure functions only.

const { isValidDate } = require('./dates');

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// 'MM-DD' in `year` as 'YYYY-MM-DD'. 02-29 becomes 02-28 outside leap years.
function monthDayIn(year, monthDay) {
  const md = monthDay === '02-29' && !isLeapYear(year) ? '02-28' : monthDay;
  const date = `${year}-${md}`;
  if (!isValidDate(date)) throw new Error(`Invalid month and day: ${monthDay}`);
  return date;
}

// Fewest weekdays in any run of `days` consecutive days (a run starting on a
// Saturday): the leave needed for that many days off, before public holidays.
function leaveDaysFor(days) {
  if (!Number.isInteger(days) || days < 1) throw new Error('typical_days must be a whole number of 1 or more');
  return 5 * Math.floor(days / 7) + Math.max(0, (days % 7) - 2);
}

// The peak season in the planning year as a trip range. When peak_end is
// earlier than peak_start (e.g. 12-15 to 03-15) the range ends in the next year.
// leave_days is enough for a typical_days break.
function activityTripRange(activity, year) {
  const rangeStart = monthDayIn(year, activity.peak_start);
  const wraps = activity.peak_end < activity.peak_start;
  const rangeEnd = monthDayIn(wraps ? year + 1 : year, activity.peak_end);
  return {
    range_start: rangeStart,
    range_end: rangeEnd,
    leave_days: leaveDaysFor(activity.typical_days),
  };
}

module.exports = { activityTripRange };
