# Progress

How to use this file: at the start of each session, read this and `CLAUDE.md`, then work on the first unchecked item. When it's done and tested, tick it, add notes if anything is worth remembering, and commit.

## Must-have

### 1. Project setup
- [ ] `package.json`, Express server, `npm start` serves `public/` on localhost
- [ ] SQLite connection and schema for `settings`, `trips`, `holidays`, `activities`
- [ ] Seed script for default settings
- [ ] `.gitignore` (node_modules, *.db), short README with run steps

### 2. Settings and rolling balance
- [ ] `GET/PUT /api/settings` and settings panel
- [ ] Leave maths in `lib/`: hours to whole days (floor), weekday accrual, balance on any date
- [ ] Tests for the leave maths (e.g. 21 h = 2 days)

### 3. Holiday data
- [ ] Seed WA school holidays 2027 and estimated China school holidays
- [ ] Seed estimated 2027 China holidays (`is_estimate = 1`)
- [ ] `POST /api/holidays/sync` from Nager.Date (WA) and holiday-cn, with safe failure
- [ ] `GET /api/calendar?year=` returns days, holiday flags and month tags

### 4. Trips and longest break
- [ ] Longest-break sliding window in `lib/`, with tests
- [ ] Trips CRUD endpoints
- [ ] Trip cards: toggle, edit range and leave days, longest break, projected balance, red warning
- [ ] Auto-pick the 2 preset trips from public-holiday clusters

### 5. Year calendar
- [ ] 12 month cards with Perth weather, AU crowd and CN crowd tags
- [ ] Day grid with weekends, public holidays, leave days, trip spans, school holiday bar, China holiday dot
- [ ] Legend; estimates styled lighter

### 6. Activity library
- [ ] Load the 100 activities from `data/activities.json` (already written) into the database
- [ ] Search and category filter
- [ ] "Plan this" creates a trip in one click

### 7. Ask your AI (copy-prompt flow)
- [ ] `POST /api/prompt` builds the prompt; copy button
- [ ] Paste box; `POST /api/trips/from-json` validates and creates a trip
- [ ] Option to save the result to the activity library

### 8. Polish and demo
- [ ] Check layout on a narrow window
- [ ] Rehearse the demo: search "Japan cherry blossom", plan it, show the break and balance on the calendar
- [ ] Final commit and push

## Nice-to-have
- [ ] Click a calendar day to start a new trip
- [ ] Drag to adjust trip dates
- [ ] Export enabled trips as an `.ics` file
- [ ] `POST /api/suggest` calling the Claude API (only once credits are available)

## Notes
- holiday-cn may return an empty list for 2027 until China announces its holiday dates; the seeded estimates cover this.
