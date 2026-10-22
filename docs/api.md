# API contract

The agreement between the Logic, API & data and Frontend workers. Build against this so the parts fit together. **Only the Lead changes this file.** If you need a change, say so in your session and the Lead will update it and tell the others.

Dates are always `YYYY-MM-DD` strings in Perth time. Hours are numbers (e.g. `7.6`). Errors are always `{ "error": "Clear message" }` with a 4xx/5xx status.

## Team and file ownership

| Worker | Branch | Owns (only edits these) |
|---|---|---|
| Lead | `hackathon-setup` | `CLAUDE.md`, `PROGRESS.md`, `docs/`, `.claude/`, merging |
| Logic | `team/logic` | `lib/` (except `lib/overlaps.js`
- `findOverlaps(trips) -> { [tripId]: [{ id, title, start, end }] }` (`trips` have `id`, `title`, `enabled` and `break`. For each trip, list the other **enabled** trips whose break span shares at least one day with its own break span, in start order. Trips with no break have no overlaps.)

`lib/ai-prompt.js`) and its `*.test.js` |
| API & data | `team/api` | `server.js`, `db.js`, `routes/`, `data/` (except `activities.json` content), `lib/ai-prompt.js` |
| Frontend | `team/frontend` | `public/` |

## `lib/` functions (Logic writes, API & data calls)

All pure: no database, no network, no `new Date()` inside (pass `today` in). `freeDates` is a `Set` of date strings that are weekends or WA public holidays (CLAUDE.md rule 6).

`lib/dates.js`
- `toPerthDateString(moment) -> 'YYYY-MM-DD'` (exists)
- `addDays(date, n) -> date`
- `eachDate(start, end) -> date[]` (inclusive)
- `isWeekend(date) -> boolean`
- `weekdayNumber(date) -> 1..7` (Mon = 1)
- `isValidDate(date) -> boolean` (real `YYYY-MM-DD` date; `2027-02-30` is false). Routes use this instead of checking dates themselves.
- `defaultPlanningYear(today) -> integer` (the year after `today`'s Perth year; `today` is a `YYYY-MM-DD` string)

`lib/leave.js`
- `usableDays(hours, hoursPerDay) -> integer` (floor; 21, 7.6 -> 2)
- `countWeekdays(afterDate, uptoDate) -> integer` (weekdays strictly after `afterDate`, up to and including `uptoDate`)
- `balanceOn(date, settings, leaveDates) -> { hours, days }` (rule 4: `leaveDates` = leave dates of enabled trips; only those after `balance_as_of` and before `date` are deducted, since the recorded balance already includes earlier leave. Accrual includes `date` itself. Days can be negative when the balance is.)

`lib/breaks.js`
- `longestBreak({ rangeStart, rangeEnd, leaveDays, freeDates }) -> { start, end, length, leave_used, leave_dates } | null`
- `buildFreeDates(year, publicHolidayDates) -> Set` (weekends + WA public holidays for that year and the next, so trips can cross into the next year)

`lib/presets.js`
- `pickPresetTrips({ year, publicHolidays, freeDates }) -> [{ title, range_start, range_end, leave_days }, ...]` (exactly 2, never hard-coded)

`lib/calendar.js`
- `perthWeather(month) -> 'hot' | 'comfortable' | 'cold'`
- `auCrowd(month, year, holidays) -> 'low' | 'mid' | 'high'`
- `cnCrowd(month, year, holidays) -> 'low' | 'mid' | 'high' | 'peak'`
- `buildCalendar({ year, holidays, trips, settings }) -> calendar response below`

`lib/activities.js`
- `activityTripRange(activity, year) -> { range_start, range_end, leave_days }` (wraps into the next year when `peak_end < peak_start`)

`lib/ai-prompt.js` (owned by API & data; the one module to swap for the Claude API later)
- `buildPrompt({ wish, settings, balance, holidays }) -> string`
- `parseAiReply(text) -> { activity } | throws Error('clear message')` (strips code fences, validates every `activities` field)

## Decisions confirmed during the build

- `longestBreak`: ties go to fewer leave days, then the later start. `leave_dates` never includes weekends or public holidays. Days outside `freeDates` count as working days, so build `freeDates` from the trip's start year.
- `buildCalendar`: `trip_ids` marks a trip's break span (start to end), not its whole range. `balance_end` is the balance at the end of the month's last day. `cn_workday` is a boolean and doesn't affect crowd levels. CN "peak" months are matched by holiday name (Spring Festival, May Day or Labour Day, National Day).
- `pickPresetTrips`: returns fewer than 2 if a year has fewer public-holiday groups; it picks the fewest leave days for a break of 9+ days.
- `activityTripRange`: `leave_days` = the fewest weekdays in any run of `typical_days` days (ignores public holidays); `typical_days` of 1 or 2 gives 0.
- Disabled trips still return `break` and `balance_on_start`, but their leave isn't deducted from other trips.
- `POST /api/holidays/sync` also returns `removed`.

## Shapes

**Trip** (every trip endpoint returns this):

```json
{
  "id": 1, "title": "Easter", "source": "preset",
  "range_start": "2027-03-20", "range_end": "2027-04-05",
  "leave_days": 4, "enabled": true, "activity_id": null, "notes": "",
  "break": { "start": "2027-03-26", "end": "2027-04-04", "length": 10, "leave_used": 4, "leave_dates": ["2027-03-30", "..."] },
  "balance_on_start": { "hours": 61.2, "days": 8 },
  "short": false,
  "overlaps": [{ "id": 3, "title": "Japan cherry blossom", "start": "2027-03-26", "end": "2027-04-06" }]
}
```

`break` is `null` if no break fits. `overlaps` lists the other enabled trips whose break shares a day with this one (empty array if none); shared leave days are only deducted once. `short` is `true` when the balance on the start date can't cover `leave_used` (show red).

## Endpoints (API & data builds, Frontend calls)

| Method and path | Body | Returns |
|---|---|---|
| `GET /api/settings` | | `{ balance_hours, balance_as_of, accrual_hours_per_workday, hours_per_day, balance_days, default_year }` (`balance_days` = `usableDays(balance_hours, hours_per_day)` of the stored balance; `default_year` = `defaultPlanningYear(today)`) |
| `PUT /api/settings` | any of the 4 editable fields | same as GET |
| `GET /api/trips?year=` | | `Trip[]` (ensures the 2 presets exist for that year) |
| `POST /api/trips` | `{ title, range_start, range_end, leave_days, notes? }` | `201 Trip` (source `custom`) |
| `PUT /api/trips/:id` | any of `title, range_start, range_end, leave_days, enabled, notes` | `Trip` |
| `DELETE /api/trips/:id` | | `204` |
| `GET /api/calendar?year=` | | `{ year, months: [{ month, name, weather, au_crowd, cn_crowd, balance_end: { hours, days } }], days: [{ date, weekday, is_weekend, public_holiday, school_holiday, cn_school_holiday, cn_holiday, cn_workday, leave, trip_ids }] }` |
| `POST /api/holidays/sync` | `{ year? }` | `{ ok, added, updated, removed, errors: [{ source, message }] }` (never 500 because a source is down) |
| `GET /api/activities?q=&category=` | | `Activity[]` (`best_months` as an array) |
| `POST /api/trips/from-activity/:id` | `{ year }` | `201 Trip` (source `activity`) |
| `POST /api/prompt` | `{ wish, year }` | `{ prompt }` |
| `POST /api/trips/from-json` | `{ text, year, save_to_library }` | `201 { trip, activity }` or `400 { error }` |

In `days`: `public_holiday` is the holiday name or `null`; `cn_holiday` is `{ name, is_estimate }` or `null`; `leave` is `true` on the user's leave days; `trip_ids` lists enabled trips covering that date.
