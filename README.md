# Paul

A self-hosted personal dashboard with customizable widgets and a user-facing scripting layer for fetching and aggregating personal data.

---

## What Is Paul?

Paul is a personal dashboard you run on your own machine. It gives you a single place to see the information that matters to you — weather, news, tasks, finances, dev stats, and more — laid out exactly the way you want it.

What sets Paul apart from similar tools is its scripting layer. Instead of being limited to a fixed set of integrations, you can write your own JavaScript scripts that fetch data from any API or source, and display the result as a widget on your dashboard. Scripts written by others can also be imported and reused.

Paul is built for personal use. It runs locally, stores everything on your own machine, and has no cloud dependency.

---

## Goals

- Provide a drag-and-drop dashboard grid where widgets can be freely arranged and resized
- Ship a small library of useful built-in widgets out of the box
- Give users a scripting layer to fetch and aggregate data from any source
- Keep setup simple — one `docker-compose up` command and you're running
- Target semi-technical users, while remaining accessible to beginners and extensible for advanced users

---

## Core Features

### Dashboard Grid
The dashboard uses a drag-and-drop grid. Widgets can be freely moved, resized, added, and removed. Layouts are saved to a local database and persist across restarts.

### Widget Configuration
Each widget is configured via an inline modal (a popup that appears over the widget). Every widget has its own settings — for example, a Weather widget lets you set your city and preferred units. Configuration is saved per widget instance, meaning you can have two Weather widgets showing different cities simultaneously.

### Built-in Widgets
Paul ships with a small set of built-in widgets covering four data categories:

- **Lifestyle:** Weather, RSS/news feed, sports scores
- **Productivity:** Calendar, task list, habit tracker
- **Finance:** Stock/crypto ticker, budget summary
- **Dev/tech:** GitHub activity, server stats (CPU, RAM, disk), uptime monitor

### Scripting Layer
The scripting layer is Paul's core differentiator. Users can write JavaScript that runs server-side on a schedule or on demand. Scripts output JSON, which is consumed by a "Script Widget" and displayed on the dashboard. A built-in code editor (Monaco Editor) is available directly in the UI. API keys and secrets are stored securely in an encrypted local store.

Scripts can be exported and imported as JSON, enabling sharing with others.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), react-grid-layout |
| Backend | Node.js, Express |
| Script Editor | Monaco Editor |
| Database | SQLite (via better-sqlite3) |
| Deployment | Docker + Docker Compose |
| Host Environment | Windows with WSL |

---

## Project Structure (Planned)

```
paul/
├── client/          # React frontend
├── server/          # Express backend
├── docker-compose.yml
├── NOTES.md         # Developer session notes
└── README.md
```

---

## Timeline

Paul is being built solo by a junior full-stack developer with approximately 6–7 hours of available development time per week (25–60 minutes on weekdays, ~2 hours per day on weekends).

### Phase 1 — Crawl: MVP (Weeks 1–12, ~3 months)

The goal of this phase is a running, usable dashboard that the developer uses daily.

**Week 1 — Project Skeleton**
- Initialize monorepo with `/client` (React + Vite) and `/server` (Express)
- Write `docker-compose.yml` to run both services
- Confirm "Hello World" renders in the browser through Docker on WSL

**Week 2 — Dashboard Grid**
- Install and configure `react-grid-layout`
- Render 3 placeholder widget boxes
- Implement drag and resize
- Save layout to `localStorage` temporarily

**Week 3 — First Real Widget**
- Build a Weather widget using Open-Meteo (free, no API key required)
- Establish the widget component contract: `<WeatherWidget config={} data={} />`
- Fetch weather data server-side via an Express route

**Week 4 — Persistence**
- Add SQLite via `better-sqlite3`
- Save and load dashboard layouts from the database
- Remove reliance on `localStorage` for layout

**Weeks 5–8 — Widget Shell & Config Modal**
- Build the `<WidgetConfigModal>` shell component (reusable across all widgets)
- Wire up gear icon (visible on widget hover) to open the modal
- Implement per-widget config saved to SQLite
- Add a second built-in widget (RSS feed or Clock)

**Weeks 9–12 — Polish MVP**
- Add widget add/remove UI
- Improve layout stability and edge cases
- General bug fixes and quality-of-life improvements
- Daily personal use begins

---

### Phase 2 — Walk: Scripting Core (Weeks 13–26, ~3 months)

The goal of this phase is the feature that makes Paul unique.

**Weeks 13–16 — Data Source Model**
- Define the data source abstraction (scripts are separate from widgets)
- Multiple widgets can consume the output of one script
- Scripts stored in SQLite

**Weeks 17–20 — Script Runner**
- Server-side JavaScript execution using Node's `vm` module (sandboxed)
- Cron-style scheduling for script execution
- Script output (JSON) stored and served to widgets

**Weeks 21–23 — Script Editor UI**
- Embed Monaco Editor in the frontend
- Script create/edit/delete UI
- Manual "run now" trigger from the UI

**Weeks 24–26 — Secrets Store**
- Encrypted key/value store for API keys and secrets (stored in SQLite)
- Scripts can access secrets via a provided helper
- Secrets management UI

---

### Phase 3 — Run: Polish & Widget Library (Week 27+, ongoing)

- Add remaining built-in widgets (GitHub, calendar, finance tickers, server stats)
- Script import/export as JSON
- UI polish and responsive layout improvements
- Optional: basic authentication for local network access

---

## Developer Notes Convention

At the end of every development session, update `NOTES.md` in the project root with a one-liner describing where you left off and what the next step is. This minimizes context-switching overhead during short weekday sessions.

Example:
> *Left off wiring widget config saves to SQLite. Next: test that config persists across a server restart.*
