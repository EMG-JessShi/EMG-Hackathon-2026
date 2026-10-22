// GET /api/calendar?year=2027: the year calendar (days, month tags, rolling balance).
// All the date maths is in lib/calendar.js (rule 5); this route only loads the data.

const express = require('express');
const { db } = require('../db');
const { toPerthDateString, defaultPlanningYear } = require('../lib/dates');
const { buildCalendar } = require('../lib/calendar');

const router = express.Router();

router.get('/', (req, res) => {
  let year;
  if (req.query.year === undefined || req.query.year === '') {
    year = defaultPlanningYear(toPerthDateString(new Date()));
  } else {
    year = Number(req.query.year);
    if (!/^\d{4}$/.test(req.query.year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Year must be a whole number such as 2027.' });
    }
  }

  const settings = db
    .prepare(
      'SELECT balance_hours, balance_as_of, accrual_hours_per_workday, hours_per_day FROM settings WHERE id = 1'
    )
    .get();
  const holidays = db
    .prepare('SELECT date, name, country, type, is_estimate FROM holidays ORDER BY date')
    .all();
  // Every trip, not just this year's: leave in any year feeds the rolling balance
  const trips = db
    .prepare('SELECT id, range_start, range_end, leave_days, enabled FROM trips')
    .all()
    .map((t) => ({ ...t, enabled: Boolean(t.enabled) }));

  res.json(buildCalendar({ year, holidays, trips, settings }));
});

module.exports = router;
