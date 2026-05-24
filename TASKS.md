# Paul — AI Task Reference

## How to Use This File

This file is intended to be shared with Claude (claude.ai) to provide context when asking for help with specific tasks. Before asking for help, paste the relevant task block and the current state of the file(s) you are working on. Each task is self-contained and includes all context Claude needs. Do not ask Claude to infer anything not explicitly stated in the task.

---

## Project Context (Always Include This When Asking for Help)

```
Project: Paul — a self-hosted personal dashboard
Stack: React (Vite, TypeScript) frontend, Node.js/Express (TypeScript) backend, SQLite (better-sqlite3), Docker + Docker Compose
Host environment: Windows with WSL
Styling: No UI library — plain HTML and CSS only throughout the entire project
State management: React useState and useEffect only — do not introduce Redux, Zustand, or any other state library
Developer level: Junior full-stack engineer
```

---

## Global Rules (Apply to Every Task)

- Do not use any external UI component library. Use plain HTML and CSS only.
- Do not introduce any state management library. Use React `useState` and `useEffect` only.
- Do not use Axios. Use the native `fetch` API only.
- Do not use `require` or `import` inside user scripts. The vm sandbox exposes only `fetch` and basic JavaScript globals.
- All frontend files use `.tsx` extension. All frontend non-component utility files use `.ts`. All backend files use `.ts`.
- All `better-sqlite3` calls on the server are synchronous. Do not use async/await with better-sqlite3.
- All widget components accept exactly two props: `config` and `data`. Widgets never fetch their own data.
- All deletions are permanent (hard delete). There is no archive or soft delete feature.

---

## Phase 1 — Crawl: MVP

---

### TASK-001: Initialize monorepo structure

**Goal:** Create the base folder structure for the project.

**Expected output:**
```
paul/
├── client/       # React app (Vite, TypeScript)
├── server/       # Express app (TypeScript)
├── docker-compose.yml
├── NOTES.md
└── README.md
```

**Instructions for Claude:**
- Scaffold a Vite React app inside `/client` using the `react-ts` template
- Scaffold a minimal Express app inside `/server` with a single `GET /health` route that returns `{ status: "ok" }`
- `/client` must have its own `package.json`
- `/server` must have its own `package.json`
- Do not create a shared `package.json` at the root
- Create an empty `NOTES.md` at the root
- Do not install any packages beyond what the `react-ts` Vite template includes by default, and what is needed for a minimal Express + TypeScript server

---

### TASK-002: Write docker-compose.yml

**Goal:** Run both the React frontend and Express backend via a single `docker-compose up` command.

**Requirements:**
- `client` service runs the Vite dev server on port `5173` and maps that port to the host
- `server` service runs the Express app on port `3001` and maps that port to the host
- Both services use volume mounts so that code changes on the host are reflected inside the container without rebuilding the image
- Both services use `node:20-alpine` as the base image
- Within the Docker network, the frontend reaches the backend at `http://server:3001`
- The setup must work on Windows with WSL

**Instructions for Claude:**
- Write `docker-compose.yml` at the project root
- Write a `Dockerfile` inside `/client`
- Write a `Dockerfile` inside `/server`
- In a comment at the top of `docker-compose.yml`, list any WSL-specific requirements the developer must configure (e.g. enabling polling for file watching in Vite, since inotify does not work reliably on WSL)
- Do not use `depends_on` ordering — both services start independently

---

### TASK-003: Confirm client-server communication

**Goal:** Verify the frontend can successfully call the backend health route.

**Requirements:**
- In `client/src/App.tsx`, add a `useEffect` that runs once on mount and calls `GET /health` on the Express server using the native `fetch` API
- Log the full response JSON to the browser console
- If the request succeeds and returns `{ status: "ok" }`, render the text "Server connected" in the UI
- If the request fails for any reason (network error, non-ok status), render the text "Server unreachable" in the UI

**Instructions for Claude:**
- The backend base URL must come from a Vite environment variable named `VITE_API_URL`
- Add a `.env.example` file inside `/client` containing `VITE_API_URL=http://localhost:3001`
- Do not hardcode any URLs in the component
- The UI change is a plain text string — no styling required

---

### TASK-004: Install and render react-grid-layout

**Goal:** Render a drag-and-drop resizable grid with 3 placeholder widgets on screen.

**Requirements:**
- Install `react-grid-layout` and its TypeScript types inside `/client`
- Render a grid with exactly 3 placeholder boxes. Each box is a `div` with a grey border and a text label ("Widget 1", "Widget 2", "Widget 3")
- Each widget must be draggable and resizable
- The grid is 12 columns wide
- On every layout change, save the updated layout array to `localStorage` under the key `paul_layout`. Persistence to the database is added in TASK-007 and must not be implemented here.

**Instructions for Claude:**
- Import both CSS files required by `react-grid-layout`: the base stylesheet and the resizable stylesheet
- Use the `Responsive` component from `react-grid-layout` with a single breakpoint `lg` defined as `{ lg: 1200 }`
- The layout array must live in React state in `App.tsx`
- Do not create separate component files in this task — keep all logic in `App.tsx`
- The initial layout for the 3 placeholder widgets is:
  - Widget 1: `{ i: "widget-1", x: 0, y: 0, w: 4, h: 3 }`
  - Widget 2: `{ i: "widget-2", x: 4, y: 0, w: 4, h: 3 }`
  - Widget 3: `{ i: "widget-3", x: 8, y: 0, w: 4, h: 3 }`

---

### TASK-005: Define the widget component contract

**Goal:** Establish the TypeScript interface and file conventions that every widget in Paul must follow.

**The widget contract:**
Every widget is a React component that accepts exactly two props:
- `config` — a generic object containing widget-specific settings provided by the user (e.g. `{ latitude: 45.5017, longitude: -73.5673, units: "metric" }`)
- `data` — a generic object containing the data fetched server-side and passed to the widget. `data` is `null` when data has not yet loaded.

Widgets must never fetch their own data. Data is always fetched server-side by Express routes and passed down to the widget as a prop.

**Instructions for Claude:**
- Create `client/src/widgets/WidgetBase.tsx` containing the following exported TypeScript interface:
  ```ts
  export interface WidgetProps<
    C = Record<string, unknown>,
    D = Record<string, unknown>
  > {
    config: C
    data: D | null
  }
  ```
  Include a JSDoc comment above the interface explaining the two props and the rule that widgets must not fetch their own data.
- Create `client/src/widgets/PlaceholderWidget.tsx`. This component accepts `WidgetProps` with no type parameters (uses the defaults). It renders `config` and `data` as a formatted JSON string inside a `<pre>` tag. This widget is used during development to inspect prop values.
- Create `client/src/widgets/index.ts` that exports `WidgetProps` from `WidgetBase.tsx` and `PlaceholderWidget` from `PlaceholderWidget.tsx`

---

### TASK-006: Build the Weather widget

**Goal:** Fetch weather data server-side and display it in a Weather widget on the dashboard.

**Data source:** Open-Meteo forecast API — `https://api.open-meteo.com/v1/forecast`. This API is free and requires no API key.

**Config shape:**
```ts
{ latitude: number; longitude: number; units: "metric" | "imperial" }
```

**Data shape returned by the server route:**
```ts
{ temperature: number; windspeed: number; weathercode: number }
```

**Server requirements:**
- Add a `GET /api/weather` route to the Express server
- The route accepts three query parameters: `latitude` (number), `longitude` (number), `units` (string: `"metric"` or `"imperial"`)
- The route calls the Open-Meteo API using the `current_weather` parameter
- The route returns exactly the data shape above — do not return the raw Open-Meteo response
- If the Open-Meteo request fails, the route returns a `500` status with `{ error: "Failed to fetch weather" }`

**Client requirements:**
- Create `client/src/widgets/WeatherWidget.tsx`
- The component signature is: `function WeatherWidget({ config, data }: WidgetProps<WeatherConfig, WeatherData>)`
- When `data` is `null`, render the text "Loading..."
- When `data` is not `null`, render three lines of plain text:
  - Temperature: the value followed by `°C` if units is metric, `°F` if imperial
  - Wind speed: the value followed by `km/h` if metric, `mph` if imperial
  - Condition: a plain English description mapped from `weathercode` using the WMO weather code standard (e.g. `0` = "Clear sky", `1` = "Mainly clear", `2` = "Partly cloudy", `3` = "Overcast", `45` = "Fog", `61` = "Rain", `71` = "Snow", `95` = "Thunderstorm")
- The widget config in this task uses hardcoded `latitude` and `longitude` values — there is no city search UI yet. City search is added in TASK-008.
- Do not add any styling beyond plain text

**Instructions for Claude:**
- Export `WeatherConfig` and `WeatherData` as named TypeScript interfaces from `WeatherWidget.tsx`
- Add `WeatherWidget` to the exports in `client/src/widgets/index.ts`
- In `App.tsx`, replace one of the 3 placeholder widgets with a `WeatherWidget`. Hardcode its config to `{ latitude: 45.5017, longitude: -73.5673, units: "metric" }` for now.
- The frontend calls `GET /api/weather` with the widget's config values as query params and passes the response to the widget as the `data` prop. This fetch lives in `App.tsx` for now, not inside the widget.

---

### TASK-007: Add SQLite and persist layouts

**Goal:** Replace `localStorage` layout saving with SQLite persistence on the server.

**DB schema — create the following table:**
```sql
CREATE TABLE IF NOT EXISTS layouts (
  id TEXT PRIMARY KEY,
  layout_json TEXT NOT NULL
);
```
Use a single row with `id = 'main'` to store the entire dashboard layout as a JSON string.

**Server requirements:**
- Install `better-sqlite3` and `@types/better-sqlite3` in `/server`
- Create `server/src/db.ts`. This file initialises the SQLite database at `server/paul.db`, creates the `layouts` table if it does not exist, and exports the database instance as the default export.
- Add `GET /api/layout` — queries the `layouts` table for `id = 'main'` and returns `{ layout: <parsed JSON array> }`. If no row exists, returns `{ layout: [] }`.
- Add `POST /api/layout` — accepts a JSON body of shape `{ layout: LayoutItem[] }`, serialises it to a JSON string, and upserts the row with `id = 'main'` in the `layouts` table. Returns `{ ok: true }`.

**Client requirements:**
- On mount, call `GET /api/layout` and set the layout state to the returned array. If the returned array is empty, fall back to the 3 default placeholder widgets from TASK-004.
- On every layout change, call `POST /api/layout` with the updated layout. Debounce this call by exactly 1000ms so it does not fire on every pixel moved during a drag.
- Remove all `localStorage` read and write logic added in TASK-004.

**Instructions for Claude:**
- All `better-sqlite3` calls must be synchronous — do not use async/await with the database
- The database file path must be a constant defined at the top of `server/src/db.ts`
- Import and initialise the database in `server/src/index.ts` at startup so the table is created before any routes are registered
- Use an upsert (`INSERT OR REPLACE`) for the `POST /api/layout` handler

---

### TASK-008: Build the WidgetConfigModal shell

**Goal:** Create a reusable modal component for widget configuration, and add city search to the Weather widget config.

**WidgetConfigModal requirements:**
- Create `client/src/components/WidgetConfigModal.tsx`
- The component accepts the following props:
  - `isOpen: boolean` — controls whether the modal is visible
  - `onClose: () => void` — called when the user cancels or presses Escape
  - `onSave: () => void` — called when the user clicks Save
  - `title: string` — displayed as the modal heading
  - `children: React.ReactNode` — the form content rendered inside the modal
- The modal is rendered via `ReactDOM.createPortal` into `document.body`
- When `isOpen` is `false`, the component renders nothing
- When `isOpen` is `true`, render a full-screen semi-transparent overlay behind the modal box. Clicking the overlay calls `onClose`.
- Pressing the Escape key calls `onClose`
- Inside the modal box, render from top to bottom: the `title`, the `children`, then a row with a "Cancel" button and a "Save" button. "Cancel" calls `onClose`. "Save" calls `onSave`.
- Do not use any external component library — plain HTML and CSS only

**Gear icon requirements:**
- Each widget on the dashboard renders a gear icon (the ⚙ character) that is visible only when the user hovers over that widget
- Clicking the gear icon opens the `WidgetConfigModal` for that widget
- Clicking the gear icon must not initiate a drag. Apply `data-no-drag` or use `e.stopPropagation()` on the icon's click handler to prevent this.

**DB change — add the following table:**
```sql
CREATE TABLE IF NOT EXISTS widgets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  config_json TEXT NOT NULL
);
```

**Server requirements:**
- Add `PUT /api/widgets/:id` — accepts a JSON body of shape `{ config: Record<string, unknown> }`, serialises `config` to a JSON string, and updates `config_json` for the matching widget row. Returns `{ ok: true }`. If no row with that `id` exists, returns a `404` status with `{ error: "Widget not found" }`.
- Update `GET /api/layout` to also return all widget configs. The response shape becomes:
  ```ts
  { layout: LayoutItem[]; widgets: { id: string; type: string; config: Record<string, unknown> }[] }
  ```
- Update `POST /api/layout` to also accept and save widget configs. The request body shape becomes:
  ```ts
  { layout: LayoutItem[]; widgets: { id: string; type: string; config: Record<string, unknown> }[] }
  ```

**Weather widget city search requirements:**
- Inside the `WidgetConfigModal` for the Weather widget, render a text input labelled "City"
- As the user types into the city input (after 3 or more characters), call the Open-Meteo geocoding API: `https://geocoding-api.open-meteo.com/v1/search?name=<query>&count=5`
- Display the results as a dropdown list below the input. Each result shows: `<name>, <admin1>, <country>` (e.g. "London, England, United Kingdom"). This format disambiguates cities with the same name.
- When the user selects a result, populate `latitude` and `longitude` in the widget config from the result's coordinates. Do not show `latitude` and `longitude` as manual input fields.
- Clicking Save calls `PUT /api/widgets/:id` with the updated config, then closes the modal.

---

### TASK-009: Add widget add/remove UI

**Goal:** Allow the user to add new widgets to the dashboard and permanently delete existing ones.

**Add widget requirements:**
- Render an "Add Widget" button in a top bar above the grid
- Clicking the button opens a plain list of available widget types. The available types at this stage are: "Weather" and "Placeholder".
- Selecting a widget type does the following in order:
  1. Generates a new unique widget ID using `crypto.randomUUID()`
  2. Adds a new entry to the `widgets` table in SQLite via a new `POST /api/widgets` route (see server requirements below)
  3. Adds a new item to the layout state with position `{ x: 0, y: Infinity, w: 4, h: 3, i: <new id> }`
  4. Saves the updated layout to SQLite via `POST /api/layout`
  5. Closes the widget type picker

**Default configs by widget type:**
- Weather: `{ city: "Montreal", latitude: 45.5017, longitude: -73.5673, units: "imperial" }`
- Placeholder: `{}`

**Remove widget requirements:**
- Each widget renders an "×" character that is visible only when the user hovers over that widget, in the same style as the gear icon from TASK-008
- Clicking "×" does the following in order:
  1. Shows a `window.confirm()` dialog with the message: "Delete this widget? This cannot be undone."
  2. If the user confirms, deletes the widget row from the `widgets` table in SQLite via `DELETE /api/widgets/:id`
  3. Removes the widget from the layout state
  4. Saves the updated layout to SQLite via `POST /api/layout`
- Clicking "×" must not initiate a drag. Use `e.stopPropagation()` on the click handler.

**Server requirements:**
- Add `POST /api/widgets` — accepts `{ id: string; type: string; config: Record<string, unknown> }`, inserts a new row into the `widgets` table, returns `{ ok: true }`. If a row with that `id` already exists, return a `409` status with `{ error: "Widget already exists" }`.
- Add `DELETE /api/widgets/:id` — deletes the row with the matching `id` from the `widgets` table. Returns `{ ok: true }`. If no row with that `id` exists, returns a `404` status with `{ error: "Widget not found" }`.

---

### TASK-010: MVP stabilization

**Goal:** Fix specific known rough edges so the dashboard is stable enough for daily personal use.

**The following issues must be fixed, one at a time. Address exactly one issue per response.**

1. **Layout resets on page refresh.** The layout loaded from `GET /api/layout` on mount must exactly match what was last saved. Identify and fix any mismatch between the saved and loaded layout shape.

2. **Weather widget has no loading state.** When `data` is `null`, the Weather widget must render the text "Loading..." and nothing else.

3. **Weather widget has no error state.** If the `GET /api/weather` fetch returns a non-ok status or throws, the widget must render the text "Failed to load weather" in red text and nothing else. The error must not propagate to the rest of the dashboard.

4. **Gear icon and × button trigger drag.** Clicking either the gear icon or the × button must not start a drag operation on the widget. Fix using `e.stopPropagation()` on the `mousedown` event of both buttons.

5. **Modal does not close when clicking the overlay.** Clicking the semi-transparent overlay background must call `onClose`. Clicking inside the modal box itself must not call `onClose`. Fix using a check that the click target is the overlay element itself, not a child.

6. **Console errors on clean page load.** There must be zero errors in the browser console on a fresh page load with an empty database. Identify and fix all sources of console errors.

**Instructions for Claude:**
- State which issue number you are fixing at the start of your response
- Show only the lines of code that changed, with enough surrounding context to locate them
- Explain in one sentence what was wrong and why the fix resolves it

---

## Phase 2 — Walk: Scripting Core

---

### TASK-011: Define the data source model

**Goal:** Add the data source concept to the database and expose CRUD routes for it. A data source is a named JavaScript script stored in SQLite whose output can be consumed by one or more widgets.

**DB schema — add the following table:**
```sql
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  script TEXT NOT NULL,
  schedule TEXT NOT NULL,
  last_output TEXT,
  last_run_at TEXT
);
```
- `script` stores the full JavaScript source code as a plain string
- `schedule` stores a cron expression string (e.g. `"*/5 * * * *"`)
- `last_output` stores the JSON-serialised result of the last script execution, or `{ "error": "..." }` if the last run failed. Null if never run.
- `last_run_at` stores an ISO 8601 timestamp string of the last execution time. Null if never run.

**Server requirements:**
- Add the following Express routes:
  - `GET /api/sources` — returns all rows from `data_sources` as an array. Each row returns: `id`, `name`, `schedule`, `last_output` (parsed from JSON string, or `null`), `last_run_at`.  The `script` field is not returned in this route.
  - `GET /api/sources/:id` — returns a single data source row including the `script` field. Returns `404` with `{ error: "Not found" }` if the id does not exist.
  - `POST /api/sources` — accepts `{ name: string; script: string; schedule: string }`. Generates a new `id` using `crypto.randomUUID()`. Inserts the row. Returns `{ id: <new id>, ok: true }`.
  - `PUT /api/sources/:id` — accepts `{ name: string; script: string; schedule: string }`. Updates the matching row. Returns `{ ok: true }`. Returns `404` with `{ error: "Not found" }` if the id does not exist.
  - `DELETE /api/sources/:id` — deletes the matching row from `data_sources`. Also deletes all widgets whose `config_json` contains a `sourceId` field equal to this id. Returns `{ ok: true }`. Returns `404` with `{ error: "Not found" }` if the id does not exist.

**Instructions for Claude:**
- Do not implement script execution in this task — that is TASK-012
- The widget deletion cascade on data source delete must be done in a SQLite transaction so that both deletes succeed or both are rolled back
- Add the `data_sources` table creation to `server/src/db.ts` alongside the existing table creations

---

### TASK-012: Implement the script runner

**Goal:** Execute user-written JavaScript scripts server-side inside a sandboxed vm context and store the output.

**Requirements:**
- Use Node's built-in `vm` module to execute scripts
- Scripts run inside `vm.runInNewContext()` with the following sandbox context and nothing else:
  - `fetch` — the global Node.js fetch function
  - `console` — the global Node.js console object
- Scripts must not have access to `require`, `import`, `process`, or any Node.js module
- Scripts must return a plain JSON-serialisable object. The script body is wrapped in an async function before execution so that scripts can use `await` at the top level.
- Scripts time out after exactly 10 seconds. Use the `timeout` option of `vm.runInNewContext`.
- On successful execution: serialise the returned object to a JSON string and update `last_output` and `last_run_at` for the matching row in `data_sources`
- On failed execution (timeout, thrown error, or non-serialisable return): update `last_output` to `JSON.stringify({ error: <error message string> })` and update `last_run_at` to the current ISO timestamp

**Cron scheduling:**
- Install `node-cron` in `/server`
- When the Express server starts, load all rows from `data_sources` and register a `node-cron` job for each one using its `schedule` value
- Each cron job executes that data source's script when triggered
- Store all active cron jobs in a `Map<string, cron.ScheduledTask>` so they can be stopped and restarted when a data source is updated or deleted

**New route:**
- `POST /api/sources/:id/run` — immediately executes the script for the given data source id outside of the cron schedule, waits for it to complete, and returns the result as `{ output: <parsed result object> }`. If the script fails, returns `{ output: { error: <message> } }`. Returns `404` with `{ error: "Not found" }` if the id does not exist.

**Update existing routes:**
- `PUT /api/sources/:id` — after saving the updated script and schedule to the database, stop the existing cron job for this id (if one exists) and start a new one with the updated schedule
- `DELETE /api/sources/:id` — after deleting the row, stop and remove the cron job for this id (if one exists)

**Instructions for Claude:**
- Create `server/src/runner.ts` containing all script execution logic and cron job management. Export a `runScript(source: DataSource): Promise<void>` function and a `startAllCronJobs(): void` function.
- Call `startAllCronJobs()` in `server/src/index.ts` after the database is initialised and before the server starts listening
- The script body is wrapped exactly as follows before execution:
  ```ts
  const wrappedScript = `(async () => { ${script} })()`
  ```

---

### TASK-013: Build the Script Widget

**Goal:** Add a Script widget type that displays a single value from a data source's last output.

**Config shape:**
```ts
{ sourceId: string; displayKey: string; label: string }
```

**Data shape:**
The `data` prop is the parsed `last_output` object from the data source row. It is whatever JSON object the script returned, or `{ error: string }` if the last run failed.

**Requirements:**
- Create `client/src/widgets/ScriptWidget.tsx`
- The component signature is: `function ScriptWidget({ config, data }: WidgetProps<ScriptConfig, Record<string, unknown>>)`
- When `data` is `null`, render the text "Loading..."
- When `data` contains an `error` key (i.e. `data.error` is a string), render the error string in red text
- Otherwise, resolve `config.displayKey` as a dot-notation path into `data` and render two lines of plain text:
  - Line 1: `config.label`
  - Line 2: the resolved value as a string
- If `config.displayKey` does not resolve to a value in `data`, render the text "Key not found" in place of the value

**Dot-notation resolver:**
- Write a utility function `resolvePath(obj: Record<string, unknown>, path: string): unknown` in `client/src/utils/resolvePath.ts`
- The function splits `path` on `.` and traverses the object. For example, `resolvePath({ stock: { close: 142 } }, "stock.close")` returns `142`.
- Do not use lodash or any external library for this

**Instructions for Claude:**
- Export `ScriptConfig` as a named TypeScript interface from `ScriptWidget.tsx`
- Add `ScriptWidget` to the exports in `client/src/widgets/index.ts`
- Add "Script" as an available widget type in the Add Widget picker from TASK-009
- Default config for a new Script widget: `{ sourceId: "", displayKey: "", label: "My Metric" }`
- The frontend fetches the data source's `last_output` by calling `GET /api/sources/:id` using the `config.sourceId` value and passes the parsed `last_output` as the `data` prop. This fetch lives in `App.tsx`, not inside the widget.

---

### TASK-014: Build the script editor UI

**Goal:** Allow the user to create, edit, run, and delete data sources from within the dashboard UI.

**Navigation:**
- Add a nav link labelled "Scripts" to the top bar above the dashboard grid
- Clicking "Scripts" switches the view to the scripts panel by setting a query param `?view=scripts` in the URL
- Clicking a "Dashboard" nav link returns to the main dashboard view by removing the query param
- Do not install a router library. Read and write `window.location.search` directly.

**Scripts list view (shown when no data source is selected):**
- Fetch `GET /api/sources` on mount and display all data sources in a plain list
- Each list item shows: the data source `name`, the `schedule`, and `last_run_at` formatted as a human-readable local date/time string. If `last_run_at` is null, show "Never run".
- Clicking a list item opens the editor view for that data source
- A "New Script" button at the top of the list creates a blank data source by calling `POST /api/sources` with `{ name: "Untitled", script: "", schedule: "*/5 * * * *" }` and then opens the editor view for the newly created id

**Editor view (shown when a data source is selected):**
- Render the following from top to bottom:
  1. A text input for the data source `name`
  2. A text input for the cron `schedule`
  3. A Monaco Editor instance for the `script` body
  4. A "Run Now" button
  5. An output block (see below)
  6. A "Save" button and a "Delete" button side by side
- Install `@monaco-editor/react` in `/client`
- Set the Monaco Editor language to `javascript`
- Set the Monaco Editor theme to `vs-dark`
- The Monaco Editor height is fixed at `300px`

**Run Now behaviour:**
- Clicking "Run Now" calls `POST /api/sources/:id/run`
- While waiting for the response, the button is disabled and its label changes to "Running..."
- When the response is received, display the full output object as a formatted JSON string inside a `<pre>` block below the editor
- If the output contains an `error` key, render the `<pre>` text in red

**Save behaviour:**
- Clicking "Save" calls `PUT /api/sources/:id` with the current values of `name`, `script`, and `schedule`
- After a successful save, show the text "Saved" next to the Save button for 2 seconds, then hide it

**Delete behaviour:**
- Clicking "Delete" shows a `window.confirm()` dialog displaying the following message exactly:
  ```
  Delete "<name>"? This will also remove all widgets using this data source. This cannot be undone.
  ```
  Where `<name>` is the current data source name.
- If the user confirms, call `DELETE /api/sources/:id`
- After a successful delete, navigate back to the scripts list view

**Instructions for Claude:**
- Do not install a router library — use `window.location.search` only
- The scripts view is a separate component `client/src/views/ScriptsView.tsx`. The dashboard grid remains in `App.tsx`. `App.tsx` reads the query param and renders either the dashboard or `ScriptsView` accordingly.

---

### TASK-015: Build the secrets store

**Goal:** Allow users to store API keys and other sensitive values that scripts can access via a `getSecret` function in the sandbox.

**DB schema — add the following table:**
```sql
CREATE TABLE IF NOT EXISTS secrets (
  key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL
);
```

**Encryption requirements:**
- Use Node's built-in `crypto` module exclusively — do not install any external encryption library
- Use AES-256-GCM encryption
- The encryption key is a 32-byte value derived from the environment variable `PAUL_SECRET_KEY` using `crypto.scryptSync`
- Each secret is stored as a single string in the format `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
- Create `server/src/secrets.ts` containing `encryptValue(value: string): string` and `decryptValue(stored: string): string` functions. Export both.

**Server routes:**
- `GET /api/secrets` — returns an array of all secret keys only. Does not return encrypted values. Shape: `{ keys: string[] }`
- `POST /api/secrets` — accepts `{ key: string; value: string }`. Encrypts `value` using `encryptValue`. Inserts a new row. Returns `{ ok: true }`. If a row with that key already exists, return `409` with `{ error: "Key already exists" }`.
- `DELETE /api/secrets/:key` — deletes the row with the matching key. Returns `{ ok: true }`. Returns `404` with `{ error: "Not found" }` if the key does not exist.

**Sandbox integration:**
- In `server/src/runner.ts`, inject a `getSecret` function into the vm sandbox context
- `getSecret(key: string): string` — looks up the key in the `secrets` table, decrypts the value using `decryptValue`, and returns the plaintext string. If the key does not exist, throws an error with the message `"Secret not found: <key>"`.
- `getSecret` must be synchronous

**Secrets management UI:**
- Add a nav link labelled "Secrets" to the top bar, alongside the existing "Scripts" link
- Use the same query param pattern as TASK-014: `?view=secrets`
- Create `client/src/views/SecretsView.tsx`
- The view renders:
  1. A plain list of all secret keys fetched from `GET /api/secrets`
  2. A form with two text inputs: "Key" and "Value", and an "Add Secret" button
  3. Each item in the key list has a "Delete" button next to it
- Clicking "Add Secret" calls `POST /api/secrets` with the current key and value inputs, then clears both inputs and refreshes the list
- Clicking "Delete" next to a key shows a `window.confirm()` dialog with the message: `"Delete secret "<key>"? This cannot be undone."`. If confirmed, calls `DELETE /api/secrets/:key` and refreshes the list.
- Secret values are never fetched or displayed in the UI — only key names are shown

**Environment setup:**
- Add a `.env.example` file at the project root containing:
  ```
  PAUL_SECRET_KEY=replace_this_with_a_random_32_character_string
  ```
- Add a comment in `.env.example` explaining that this value must be exactly 32 characters and must not be changed after secrets have been stored, as doing so will make existing secrets unreadable

---

## Phase 3 — Run: Polish & Widget Library

> Tasks in this phase will be written out in detail once Phase 2 is complete. The following are placeholders.

- TASK-016: GitHub activity widget
- TASK-017: RSS feed widget
- TASK-018: Script import/export as JSON
- TASK-019: Server stats widget (CPU, RAM, disk via systeminformation package)
- TASK-020: UI polish pass (consistent spacing, hover states, loading skeletons)
- TASK-021: Optional basic auth for local network access