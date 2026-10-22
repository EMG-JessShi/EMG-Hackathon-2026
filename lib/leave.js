// Leave maths (CLAUDE.md rules 2 to 4). Pure functions only.

const { addDays, eachDate, isWeekend, weekdayNumber } = require('./dates');

// Tiny tolerance so floating-point noise (e.g. 22.8 / 7.6 = 2.9999...) doesn't lose a day.
const EPSILON = 1e-9;

// Whole leave days the hours can cover (rule 2): 21 h at 7.6 h/day = 2 days.
function usableDays(hours, hoursPerDay) {
  if (!(hoursPerDay > 0)) throw new Error('hours_per_day must be greater than 0');
  return Math.floor(hours / hoursPerDay + EPSILON);
}

// Weekdays strictly after afterDate, up to and including uptoDate (rule 3).
// Returns 0 when uptoDate is not after afterDate.
function countWeekdays(afterDate, uptoDate) {
  const first = addDays(afterDate, 1);
  if (first > uptoDate) return 0;
  const total = eachDate(first, uptoDate).length;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  // Count the leftover days one by one, starting after the full weeks
  let day = weekdayNumber(first);
  for (let i = 0; i < total % 7; i++) {
    if (day <= 5) count++;
    day = day === 7 ? 1 : day + 1;
  }
  return count;
}

// Rolling balance on `date` (rule 4): the recorded balance, plus accrual for each
// weekday after balance_as_of up to `date`, minus hours_per_day for every leave
// date after balance_as_of and before `date`. Leave on or before balance_as_of is
// assumed to be already reflected in balance_hours. Weekend dates in leaveDates
// are ignored (leave is only taken on working days).
function balanceOn(date, settings, leaveDates = []) {
  const {
    balance_hours: balanceHours,
    balance_as_of: asOf,
    accrual_hours_per_workday: accrual,
    hours_per_day: hoursPerDay,
  } = settings;

  const accrued = countWeekdays(asOf, date) * accrual;
  const taken = new Set(
    [...leaveDates].filter((d) => d > asOf && d < date && !isWeekend(d))
  ).size;

  // Round to 4 decimals to drop floating-point noise from repeated accrual
  const hours = Math.round((balanceHours + accrued - taken * hoursPerDay) * 10000) / 10000;
  return { hours, days: usableDays(hours, hoursPerDay) };
}

module.exports = { usableDays, countWeekdays, balanceOn };
