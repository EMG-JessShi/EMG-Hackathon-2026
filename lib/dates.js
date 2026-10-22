// Pure date helpers. All date maths lives in lib/ (see CLAUDE.md rule 5).

const PERTH_TIME_ZONE = 'Australia/Perth';

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

module.exports = { PERTH_TIME_ZONE, toPerthDateString };
