# Progress

How to use this file: at the start of each session, read this and `CLAUDE.md`, then work on the first unchecked item. When it's done and tested, tick it, add notes if anything is worth remembering, and commit.

## Who does what

Tags show the owner: `[logic]` = `lib/`, `[api]` = server, database and routes, `[frontend]` = `public/`, `[lead]` = merging and checks. See `docs/api.md` for file ownership and the contract between parts. Workers don't edit this file (it would clash between branches): they say what they finished in their commit message and session reply, and the Lead ticks items after merging.

## Must-have

### 1. Project setup
- [x] `package.json`, Express server, `npm start` serves `public/` on localhost
- [x] SQLite connection and schema for `settings`, `trips`, `holidays`, `activities`
- [x] Seed script for default settings
- [x] `.gitignore` (node_modules, *.db), short README with run steps

### 2. Settings and rolling balance
- [ ] [api + frontend] `GET/PUT /api/settings` and settings panel
- [x] [logic] Leave maths in `lib/`: hours to whole days (floor), weekday accrual, balance on any date
- [x] [logic] Tests for the leave maths (e.g. 21 h = 2 days)

### 3. Holiday data
- [x] [api] Seed WA school holidays 2027 and estimated China school holidays
- [x] [api] Seed estimated 2027 China holidays (`is_estimate = 1`)
- [x] [api] `POST /api/holidays/sync` from Nager.Date (WA) and holiday-cn, with safe failure
- [x] [api, uses logic] `GET /api/calendar?year=` returns days, holiday flags and month tags

### 4. Trips and longest break
- [x] [logic] Longest-break sliding window in `lib/`, with tests
- [x] [api] Trips CRUD endpoints
- [ ] [frontend] Trip cards: toggle, edit range and leave days, longest break, projected balance, red warning
- [ ] [logic + api] Auto-pick the 2 preset trips from public-holiday clusters

### 5. Year calendar
- [x] [logic tags + frontend] 12 month cards with Perth weather, AU crowd and CN crowd tags
- [x] [frontend] Day grid with weekends, public holidays, leave days, trip spans, school holiday bar, China holiday dot
- [x] [frontend] Legend; estimates styled lighter

### 6. Activity library
- [x] [api] Load the 100 activities from `data/activities.json` (already written) into the database
- [x] [api + frontend] Search and category filter
- [x] [logic + api + frontend] "Plan this" creates a trip in one click

### 7. Ask your AI (copy-prompt flow)
- [x] [api + frontend] `POST /api/prompt` builds the prompt; copy button
- [x] [api + frontend] Paste box; `POST /api/trips/from-json` validates and creates a trip
- [x] [api + frontend] Option to save the result to the activity library

### 8. Polish and demo
- [ ] [frontend] Check layout on a narrow window
- [ ] [lead] Rehearse the demo: search "Japan cherry blossom", plan it, show the break and balance on the calendar
- [ ] [lead] Final commit and push

## Nice-to-have
- [ ] Click a calendar day to start a new trip
- [ ] Drag to adjust trip dates
- [ ] Export enabled trips as an `.ics` file
- [ ] `POST /api/suggest` calling the Claude API (only once credits are available)

## Notes
- Item 1: default settings are seeded by `db.js` on every start (`INSERT OR IGNORE`), so there is no separate seed script. The schema uses `CREATE TABLE IF NOT EXISTS` with no migrations: after changing a table, delete `data/holiday.db` and restart.
- Item 2: `lib/dates.js` and `lib/leave.js` merged with 13 tests. Settings API and panel merged and working end to end; left unticked until `routes/settings.js` swaps its temporary stubs for `usableDays` and `defaultPlanningYear` (the stub can show a day short, e.g. 22.2 h at 7.4 h/day shows 2 days, not 3).
- All `lib/` functions merged (48 tests): breaks, calendar tags, presets (2027 picks Easter and Christmas to New Year), activity ranges. Shared items that use them get ticked when the API and Frontend parts are merged.
- Integration review (all branches merged): left unticked until fixed: negative balance can't be saved from the settings form; moving to 2028 creates wrong presets from partial holiday data; no Sync holidays button in the UI; front end sample data still being removed.
- 2028 WA school holidays aren't seeded yet, so trips running into 2028 show no school holidays there.
- The server listens on 127.0.0.1 only, so other computers on the network can't reach it.
- holiday-cn may return an empty list for 2027 until China announces its holiday dates; the seeded estimates cover this.
