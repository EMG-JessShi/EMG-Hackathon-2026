// POST /api/prompt: builds the "Ask your AI" prompt for the user to copy into their
// own AI chat. No AI is called here; see lib/ai-prompt.js.

const express = require('express');
const { db } = require('../db');
const { toPerthDateString } = require('../lib/dates');
const { balanceOn } = require('../lib/leave');
const { buildPrompt } = require('../lib/ai-prompt');
const { decorateTrips, allTripRows, parseYear } = require('./trips');

const router = express.Router();

router.post('/', (req, res) => {
  const body = req.body ?? {};
  const wish = typeof body.wish === 'string' ? body.wish.trim() : '';
  if (wish === '') return res.status(400).json({ error: 'Type a wish first, e.g. "see autumn leaves in Beijing".' });
  if (wish.length > 500) return res.status(400).json({ error: 'Keep the wish to 500 characters or fewer.' });
  const year = parseYear(body.year);
  if (year === null) return res.status(400).json({ error: 'Year must be a whole number such as 2027.' });

  const settings = db
    .prepare(
      'SELECT balance_hours, balance_as_of, accrual_hours_per_workday, hours_per_day FROM settings WHERE id = 1'
    )
    .get();
  const trips = decorateTrips(allTripRows()).filter((t) => t.enabled);
  const leaveDates = trips.flatMap((t) => (t.break ? t.break.leave_dates : []));
  const balance = balanceOn(toPerthDateString(new Date()), settings, leaveDates);
  const holidays = db
    .prepare('SELECT date, name, country, type, is_estimate FROM holidays WHERE substr(date, 1, 4) = ? ORDER BY date')
    .all(String(year));

  res.json({ prompt: buildPrompt({ wish, settings, balance, holidays, year, trips }) });
});

module.exports = router;
