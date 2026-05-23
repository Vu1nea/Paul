# Paul — AI Task Reference

## How to Use This File

This file is intended to be shared with Claude (claude.ai) to provide context when asking for help with specific tasks. Before asking for help, paste the relevant task block and the current state of the file(s) you are working on. Each task is self-contained and includes the context Claude needs to assist effectively.

---

## Project Context (Always Include This When Asking for Help)

```
Project: Paul — a self-hosted personal dashboard
Stack: React (Vite, TypeScript) frontend, Node.js/Express (TypeScript) backend, SQLite (better-sqlite3), Docker + Docker Compose
Host environment: Windows with WSL
Styling: No UI library decided yet — keep styles minimal and plain for now
State management: React useState/useEffect only — no Redux or Zustand yet
Developer level: Junior full-stack engineer
```

---

## Phase 1 — Crawl: MVP

---

### TASK-001: Initialize monorepo structure

**Goal:** Create the base folder structure for the project.

**Expected output:**
```
paul/
├── client/       # React app (Vite)
├── server/       # Express app
├── docker-compose.yml
├── NOTES.md
└── README.md
```

**Instructions for Claude:**
- Scaffold a Vite React app inside `/client` using the `react-ts` template
- Scaffold a minimal Express app inside `/server` with a single `GET /health` route that returns `{ status: "ok" }`
- Both `client` and `server` should have their own `package.json`
- Do not set up a shared `package.json` at the root yet
- Create an empty `NOTES.md` at the root

---

### TASK-002: Write docker-compose.yml

**Goal:** Run both the React frontend and Express backend via Docker Compose with a single `docker-compose up` command.

**Requirements:**
- `client` service: runs Vite dev server, exposed on port `5173`
- `server` service: runs Express app, exposed on port `3001`
- Both services use volume mounts so code changes reflect without rebuilding
- Both services use `node:20-alpine` as the base image
- The frontend should be able to reach the backend at `http://server:3001` within the Docker network
- This must work on Windows with WSL

**Instructions for Claude:**
- Write a `docker-compose.yml` at the project root
- Write a `Dockerfile` for `/client`
- Write a `Dockerfile` for `/server`
- Include a note about any WSL-specific gotchas (e.g. file watching)

---

### TASK-003: Confirm client-server communication

**Goal:** Verify the frontend can successfully call the backend.

**Requirements:**
- Add a `useEffect` in the React `App.tsx` that calls `GET /health` on the Express server
- Log the response to the console
- Display "Server connected" or "Server unreachable" in the UI based on the result

**Instructions for Claude:**
- Use the native `fetch` API, no Axios yet
- The base URL for the backend should come from a Vite env variable (`VITE_API_URL`) so it is easy to change
- Keep the UI change minimal — a plain text string is fine

---

### TASK-004: Install and render react-grid-layout

**Goal:** Get a working drag-and-drop resizable grid on screen with 3 placeholder widgets.

**Requirements:**
- Install `react-grid-layout` in `/client`
- Render a grid with 3 placeholder boxes (grey bordered divs with a label like "Widget 1")
- Widgets must be draggable and resizable
- Grid should be 12 columns wide
- Save the current layout to `localStorage` on every layout change (persistence to the database comes in TASK-007)

**Instructions for Claude:**
- Import the required CSS from `react-grid-layout`
- Use the `Responsive` variant of the grid with a `lg` breakpoint only for now
- The layout array should live in React state
- Keep all logic in `App.tsx` for now — no need to split into components yet

---

### TASK-005: Define the widget component contract

**Goal:** Establish the standard shape that every widget component in Paul must follow.

**Requirements:**
Every widget is a React component that accepts exactly two props:
- `config` — an object containing widget-specific settings (e.g. `{ city: "Montreal", units: "metric" }`)
- `data` — an object containing the fetched data to display (e.g. `{ temperature: 22, condition: "Sunny" }`)

Widgets must not fetch their own data. Data is always fetched server-side and passed down.

**Instructions for Claude:**
- Create a file at `client/src/widgets/WidgetBase.tsx` that serves as a documented example/template
- The file should include JSDoc comments explaining the `config` and `data` prop shapes
- Create a `PlaceholderWidget.tsx` in the same folder that renders its `config` and `data` as formatted JSON (useful for development)
- Export both from a `client/src/widgets/index.ts` barrel file

---

### TASK-006: Build the Weather widget (first real widget)

**Goal:** Display current weather data using the Open-Meteo API.

**Data source:** Open-Meteo (`https://api.open-meteo.com/v1/forecast`) — free, no API key required.

**Config shape:**
```json
{ "city": "Montreal", "latitude": 45.5017, "longitude": -73.5673, "units": "metric" }
```

**Data shape (output from server):**
```json
{ "temperature": 22, "windspeed": 14, "weathercode": 1 }
```

**Requirements:**
- Add a `GET /api/weather` Express route that accepts `latitude`, `longitude`, and `units` as query params
- The route fetches from Open-Meteo and returns the shaped data object above
- Build `client/src/widgets/WeatherWidget.tsx` that displays temperature, wind speed, and a basic weather description derived from `weathercode`
- The widget follows the `{ config, data }` contract from TASK-005

**Instructions for Claude:**
- Use the `current_weather` field from the Open-Meteo response
- Map WMO weather codes to plain English descriptions (e.g. `0` = "Clear sky", `1` = "Mainly clear")
- Keep the widget UI simple — no icons yet, just text

---

### TASK-007: Add SQLite and persist layouts

**Goal:** Replace `localStorage` layout saving with SQLite persistence.

**Requirements:**
- Install `better-sqlite3` in `/server`
- Create a SQLite database file at `server/paul.db`
- Create a `layouts` table with columns: `id` (TEXT PRIMARY KEY), `layout_json` (TEXT)
- Use a single row with `id = 'main'` to store the dashboard layout as a JSON string
- Add two Express routes:
  - `GET /api/layout` — returns the saved layout
  - `POST /api/layout` — accepts and saves a layout JSON body
- Update the React frontend to load the layout from `GET /api/layout` on mount and save to `POST /api/layout` on every change (debounced by 1 second)

**Instructions for Claude:**
- Initialize the database and create tables in a `server/db.ts` file
- Use synchronous `better-sqlite3` methods (not async)
- Add a 1-second debounce on the frontend save to avoid saving on every pixel drag
- Remove the `localStorage` logic from TASK-004

---

### TASK-008: Build the WidgetConfigModal shell

**Goal:** Create a reusable modal component that all widgets use for their settings.

**Requirements:**
- A single `<WidgetConfigModal>` component that:
  - Accepts `isOpen`, `onClose`, `onSave`, and `title` props
  - Renders an overlay behind it
  - Has a "Save" button that calls `onSave` and a "Cancel" button that calls `onClose`
  - Renders `children` as the form content inside the modal
- A gear icon (⚙) that appears on each widget on hover, which opens the modal for that widget
- Clicking Save updates that widget's `config` in SQLite

**DB change required:**
Add a `widgets` table to SQLite:
```sql
CREATE TABLE widgets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL
);
```

**Instructions for Claude:**
- The modal should be rendered via a React Portal into `document.body`
- Pressing Escape should close the modal
- Do not use any external component library — plain HTML and CSS only
- Update `GET /api/layout` and `POST /api/layout` to also return/save widget configs alongside the grid layout

---

### TASK-009: Add widget add/remove UI

**Goal:** Let the user add new widgets to the dashboard and remove existing ones.

**Requirements:**
- An "Add Widget" button somewhere on the page (top bar or floating button)
- Clicking it opens a simple list of available widget types (just "Weather" and "Placeholder" for now)
- Selecting a type adds a new widget instance to the grid with a default config and a generated `id`
- Each widget has an "×" remove button (visible on hover, like the gear icon)
- Removing a widget deletes it from the grid and from SQLite

**Instructions for Claude:**
- Generate widget IDs using `crypto.randomUUID()`
- New widgets should be added at position `{ x: 0, y: Infinity }` so they appear at the bottom
- Default size for a new widget: `{ w: 4, h: 3 }`
- Removing a widget should prompt a simple `window.confirm()` before deleting — no custom confirm modal needed yet

---

### TASK-010: MVP stabilization and daily use

**Goal:** Fix rough edges so the dashboard is reliable enough for daily personal use.

**Checklist for Claude (address one at a time):**
- Layout does not jump or reset on page refresh
- Weather widget shows a loading state while data is fetching
- Weather widget shows an error state if the server route fails
- Gear icon and remove button do not trigger a drag when clicked
- Modal closes correctly when clicking the overlay background
- No console errors on a clean page load

**Instructions for Claude:**
- When presenting fixes, address one checklist item per response unless they are directly related
- For each fix, show only the changed code and explain what was wrong

---

## Phase 2 — Walk: Scripting Core

---

### TASK-011: Define the data source model

**Goal:** Introduce the concept of a "data source" — a named script whose output can be consumed by one or more widgets.

**DB additions:**
```sql
CREATE TABLE data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  script TEXT NOT NULL,
  schedule TEXT NOT NULL,   -- cron expression, e.g. "*/5 * * * *"
  last_output TEXT,         -- JSON string of last successful run output
  last_run_at TEXT          -- ISO timestamp
);
```

**Instructions for Claude:**
- Add CRUD Express routes for data sources: `GET /api/sources`, `POST /api/sources`, `PUT /api/sources/:id`, `DELETE /api/sources/:id`
- No script execution yet — just the model and routes
- A widget's `config` can optionally include a `sourceId` field that links it to a data source

---

### TASK-012: Implement the script runner

**Goal:** Execute user-written TypeScript server-side and store the output.

**Requirements:**
- Use Node's built-in `vm` module to run scripts in a sandboxed context
- Scripts must return a plain JSON-serializable object
- Scripts have access to `fetch` (pass it into the sandbox context)
- Script execution is triggered on a cron schedule using `node-cron`
- On successful execution, update `last_output` and `last_run_at` in the `data_sources` table
- On failure, store the error message in `last_output` as `{ "error": "..." }`
- Add a `POST /api/sources/:id/run` route to trigger a script manually

**Instructions for Claude:**
- Install `node-cron` in `/server`
- Scripts should time out after 10 seconds — use `vm.runInNewContext` with a `timeout` option
- Do not allow scripts to `require` or `import` modules — the sandbox should only have `fetch` and basic globals
- Start all cron jobs when the server starts by loading all data sources from SQLite on boot

---

### TASK-013: Build the Script Widget

**Goal:** A widget type that displays the output of a data source script.

**Config shape:**
```json
{ "sourceId": "abc123", "displayKey": "value", "label": "My Metric" }
```

**Data shape:**
The `data` prop is whatever JSON object the script returned.

**Requirements:**
- `displayKey` is a dot-notation path into the data object (e.g. `"price"` or `"stock.close"`)
- The widget displays `label: <value>` where value is extracted using `displayKey`
- If the source has `{ "error": "..." }`, display the error message in red

**Instructions for Claude:**
- Create `client/src/widgets/ScriptWidget.tsx`
- Use a simple utility function to resolve dot-notation paths (do not use lodash)
- Add "Script" to the available widget types in the Add Widget UI from TASK-009

---

### TASK-014: Build the script editor UI

**Goal:** Allow users to write and manage scripts directly in the dashboard UI.

**Requirements:**
- A "Scripts" page or panel accessible from a nav link
- Lists all existing data sources with their name, schedule, and last run time
- Clicking a data source opens an editor view with:
  - Monaco Editor for the script body
  - A field for the data source name
  - A field for the cron schedule
  - A "Run Now" button that calls `POST /api/sources/:id/run` and shows the output
  - Save and Delete buttons
- A "New Script" button creates a blank data source

**Instructions for Claude:**
- Install `@monaco-editor/react` in `/client`
- Use TypeScript as the Monaco language mode
- The "Run Now" output should appear below the editor in a `<pre>` block
- Keep routing simple — use a query param like `?view=scripts` to switch views rather than a full router

---

### TASK-015: Build the secrets store

**Goal:** Allow users to store API keys and sensitive values that scripts can access.

**DB addition:**
```sql
CREATE TABLE secrets (
  key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL
);
```

**Requirements:**
- Secrets are encrypted at rest using AES-256
- The encryption key is derived from a value in a `.env` file (`PAUL_SECRET_KEY`)
- Scripts can access secrets via a `getSecret(key)` function injected into the sandbox
- Add a Secrets management UI: list all secret keys (not values), add a new secret, delete a secret
- Secrets values are never sent to the frontend — only key names

**Instructions for Claude:**
- Use Node's built-in `crypto` module for AES-256-GCM encryption — no external crypto library
- Add `PAUL_SECRET_KEY` to a `.env.example` file at the project root with instructions
- The `getSecret` function in the sandbox should return the decrypted value synchronously
- Add CRUD routes: `GET /api/secrets` (keys only), `POST /api/secrets`, `DELETE /api/secrets/:key`

---

## Phase 3 — Run: Polish & Widget Library

> Tasks in this phase will be written out in detail once Phase 2 is complete. The following are placeholders.

- TASK-016: GitHub activity widget
- TASK-017: RSS feed widget
- TASK-018: Script import/export as JSON
- TASK-019: Server stats widget (CPU, RAM, disk via systeminformation package)
- TASK-020: UI polish pass (consistent spacing, hover states, loading skeletons)
- TASK-021: Optional basic auth for local network access
EOF