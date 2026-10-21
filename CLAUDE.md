# CLAUDE.md

Guidance for Claude Code when working in this repository.

## About this project

- This is the repo for the **EMG Hackathon 2026**: a workshop that teaches agentic development by speedrunning a simple web app in about 4 hours.
- Participants have mixed experience levels — many are not professional developers.
- Speed and a working demo matter more than perfect architecture.

## Tech stack

<!-- TODO: fill in once decided, e.g. plain HTML/CSS/JS, or Python + Flask -->
- Frontend: TBD
- Backend: TBD
- Data: TBD

## Running the app

<!-- TODO: add the exact commands, e.g. `python app.py` or `npx serve .` -->
- Install: TBD
- Run: TBD
- Test: TBD

## How Claude should work

- Keep solutions **simple and beginner-friendly**. Prefer fewer files, fewer dependencies, and plain code over clever abstractions.
- Before making a large change, briefly explain the plan in plain language.
- After making changes, summarise what changed and how to see it working.
- Make small, incremental changes and keep the app runnable after each step.
- Don't add new frameworks or libraries without asking first.
- If something is ambiguous, ask rather than guess.

## Coding conventions

- Use clear, descriptive names for files, functions and variables.
- Add short comments only where the logic isn't obvious.
- Keep secrets (API keys, passwords, connection strings) out of the code and out of git — use environment variables or a `.env` file listed in `.gitignore`.
- Use Australian English in user-facing text and AWST (Perth time) for dates/times where relevant.

## Git workflow

- Don't commit directly to `main`; work on a branch.
- Use short, descriptive branch names (e.g. `team-a/meter-dashboard`).
- Write clear commit messages describing what changed and why.
