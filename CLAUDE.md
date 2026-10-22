# Holiday Optimiser

A personal web app that helps someone plan their annual leave for the longest possible breaks, weighing up public and school holidays, Perth weather, Australian and Chinese crowd levels, and the best season for an activity. Each person runs their own copy locally. No logins, no team features.

## Stack

- Back end: Node.js + Express
- Database: SQLite via Node's built-in `node:sqlite` (`DatabaseSync`), so nothing extra to install. Requires Node 24+. The database is a single file (`data/holiday.db`) created automatically on first start with `CREATE TABLE IF NOT EXISTS`, then seeded.
- Front end: plain HTML, CSS and JavaScript served from `public/` (no frameworks, no build step)
- Runs locally with `npm start`; no deployment

Suggested layout: `server.js`, `db.js`, `routes/`, `lib/` (pure logic: leave maths, holidays, calendar), `public/`, `data/` (seed JSON). Keep the `.db` file out of git.

## Core rules (do not break these)

1. All UI text is in English (Australian spelling, e.g. "optimiser").
2. Leave is tracked in hours but allocated in whole days. Default 1 day = 7.6 hours (editable). Usable days = floor(hours / hours_per_day), so 21 hours = 2 days. Each leave day deducts hours_per_day.
3. Leave accrues on every weekday (Mon to Fri), including public holidays and days on leave.
4. The balance is rolling: balance on date D = balance_hours (as of balance_as_of) + accrual for every weekday after balance_as_of up to D, minus hours for leave days of enabled trips before D. A trip whose leave can't be covered on its start date is flagged in red.
5. All date maths happens on the server in `lib/`, never in the browser and never by an AI. The front end only displays results.
6. Free days for break calculations = weekends + WA public holidays. China holidays and school holidays are shown as crowd information only; they never make a day free.
7. The app must work offline: pages read only from the local database. External APIs are used only by the sync endpoint.

## Data model

- `settings` (single row): id, balance_hours, balance_as_of, accrual_hours_per_workday (default 0.5846, i.e. 152 h / 260 weekdays), hours_per_day (default 7.6)
- `trips`: id, title, source (`preset` | `custom` | `activity` | `ai`), range_start, range_end, leave_days, enabled, activity_id (nullable), notes
- `holidays`: id, date, name, country (`AU` | `CN`), type (`public` | `school` | `cn_holiday` | `cn_workday`), is_estimate
- `activities`: id (text slug, e.g. `japan-cherry-blossom`), name, country, region, category (`nature` | `culture` | `city` | `beach` | `snow` | `wildlife` | `festival`), best_months (JSON array), peak_start (MM-DD), peak_end (MM-DD), typical_days, tips, crowd_note

## Holiday data

- WA public holidays: Nager.Date, `https://date.nager.at/api/v3/PublicHolidays/{year}/AU`. Keep entries where `global` is true or `counties` includes `AU-WA`. Use observed dates (e.g. 2027: Christmas and Boxing Day observed 27 and 28 Dec; New Year 2028 observed 3 Jan).
- China holidays and make-up workdays: holiday-cn, `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json`. `isOffDay: false` = make-up workday (`cn_workday`). It omits ordinary weekends next to holidays. A year's file can be empty until the State Council announces dates (usually late in the previous year), and December dates can appear in the next year's file, so fetch both years and fall back to seeded estimates.
- WA school holidays: no API. Seed from the WA Department of Education official term dates. 2027 terms: T1 1 Feb to 9 Apr, T2 26 Apr to 2 Jul, T3 19 Jul to 24 Sep, T4 11 Oct to 16 Dec. So school holidays are: to 31 Jan, 10 to 25 Apr, 3 to 18 Jul, 25 Sep to 10 Oct, from 17 Dec.
- China school holidays: no API, varies by province. Seed rough ranges (winter about mid Jan to late Feb, summer about 1 Jul to 31 Aug) with `is_estimate = 1`.
- Seed rough 2027 China holiday estimates (`is_estimate = 1`) so the app works before holiday-cn publishes: New Year 1 Jan, Spring Festival from 5 Feb, Qingming 5 Apr, May Day 1 to 5 May, Dragon Boat 9 Jun, Mid-Autumn 15 Sep, National Day 1 to 7 Oct. Synced data replaces estimates.
- `POST /api/holidays/sync` fetches both sources, upserts into `holidays`, and reports what changed. Failures must not break the app.

## Features

**Settings panel.** Edit balance (hours), balance as-of date, accrual per weekday and hours per day. Show balance in hours and whole days.

**Longest break.** For a trip range and N leave days, find the longest run of consecutive days off using a sliding window over the range (free days per rule 6). Return start, end, length and leave days actually used (may be fewer than N if the range tops out).

**Preset trips.** Exactly 2, picked automatically: build candidate ranges around WA public-holiday clusters, score by days off per leave day, take the top 2. For 2027 expect Easter (26 to 29 Mar) and Christmas to New Year. Never hard-code them.

**Trip cards.** Every trip (preset, custom, activity, AI) uses the same card: toggle on/off, edit range and leave days, show longest break, dates, leave used and the projected balance on its start date (red if short).

**Year calendar.** 12 month cards. Each month card has three tags: Perth weather, AU crowd, CN crowd. Below it, a day grid (Mon first) marking weekends, WA public holidays, the user's leave days, trip spans, a bar for WA school holidays and a dot for China holidays (lighter style when `is_estimate`). Trips may cross into the next year.
- Perth weather (static by month): Jan to Feb and Dec hot; Mar to May and Sep to Nov comfortable; Jun to Aug cold.
- AU crowd per month: count days covered by WA school holidays or WA public holidays: 0 to 3 low, 4 to 9 mid, 10+ high.
- CN crowd per month: peak if it contains Spring Festival, May Day or National Day; high if it overlaps estimated school holidays; mid if it has another China holiday; otherwise low.
- Crowd levels are rule-based estimates, not live data. Show a short note near the calendar legend: "Crowd levels are estimated from public and school holidays." Activity `crowd_note` text is a static guide.

**Activity library.** 100 activities are already written in `data/activities.json` (do not regenerate them). Load them into the `activities` table on first start. Searchable by name, country and region, filterable by category. "Plan this" creates an `activity` trip in the planning year using peak_start to peak_end as the range and typical_days to choose leave days. If peak_end is earlier than peak_start (e.g. 12-15 to 03-15), the range wraps into the next year. Show dates as a guide only, since seasons shift each year.

**Ask your AI (copy-prompt flow).** The app does not call any AI API. The user types a wish ("see autumn leaves in Beijing"); `POST /api/prompt` builds a prompt containing the wish, the user's leave situation and relevant holidays, and asks for a JSON reply using exactly the `activities` fields. The user copies it to their own AI chat and pastes the reply back. `POST /api/trips/from-json` strips code fences, validates every field (reject with a clear message if invalid), creates an `ai` trip, and optionally saves it to the library.

## API

- `GET /api/settings`, `PUT /api/settings`
- `GET /api/trips`, `POST /api/trips`, `PUT /api/trips/:id`, `DELETE /api/trips/:id`
- `GET /api/calendar?year=2027` (days, month tags, rolling balance)
- `POST /api/holidays/sync`
- `GET /api/activities?q=&category=`, `POST /api/trips/from-activity/:id`
- `POST /api/prompt`, `POST /api/trips/from-json`

## Out of scope

Logins, multiple users or team views, deployment, direct AI API calls, flight or hotel prices. Future option: `POST /api/suggest` calling the Claude API once credits exist; keep the copy-prompt code behind one module so this is a drop-in swap.

## Working agreement

- Read `PROGRESS.md` at the start of every session and work on the next unchecked item.
- After finishing an item: test it, tick it in `PROGRESS.md`, add any notes, then commit with a clear message.
- Keep `lib/` functions pure and add a quick `node --test` check for the leave maths and the longest-break algorithm.
- Keep this file short. Put task status in `PROGRESS.md`, not here.
