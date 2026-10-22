# EMG-Hackathon-2026
Workshop that teaches everyone about agentic development, speedrun a simple web app within 4 hours


## Holiday Optimiser

A personal web app for planning annual leave around public and school holidays. It runs locally on your computer. See `CLAUDE.md` for the full spec and `PROGRESS.md` for build status.

### Requirements

- [Node.js](https://nodejs.org) **24 or newer** (check with `node -v`)
- Git

### Run it locally

```bash
git clone https://github.com/EMG-JessShi/Holiday-Optimiser.git
cd Holiday-Optimiser
npm install
npm start
```

Then open http://localhost:3000 in your browser. Press `Ctrl+C` in the terminal to stop the server.

The database (`data/holiday.db`) is created automatically on first start. To start fresh, stop the server and delete that file.

### Other commands

- `npm run dev`: start the server and restart it automatically when you save a file
- `npm test`: run the tests
- Use a different port: `PORT=4000 npm start` (macOS/Linux) or `$env:PORT=4000; npm start` (PowerShell)

### Troubleshooting

- **"npm.ps1 cannot be loaded because running scripts is disabled"** (Windows PowerShell): use `npm.cmd` instead of `npm`, e.g. `npm.cmd install` and `npm.cmd start`.
- **"bad option: --disable-warning"** or **"needs Node.js 24 or newer"**: your Node.js is too old. Install Node.js 24 LTS, then open a new terminal.
- **"Port 3000 is already in use"**: another copy is still running. Stop it with `Ctrl+C` in its window, or use a different port (see above).

### Project layout

- `server.js`: Express server; serves `public/` and the API under `/api`
- `db.js`: opens the SQLite database, creates tables and seeds default settings
- `routes/`: API routes
- `lib/`: pure logic (date and leave maths) with tests
- `public/`: front end (plain HTML, CSS and JavaScript)
- `data/`: seed data (`activities.json`) and the local database
- `docs/api.md`: the contract between the parts, and who owns which files
- `.claude/agents/`: role files for the Logic, API & data, Frontend and Reviewer agents
