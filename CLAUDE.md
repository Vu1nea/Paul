# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paul is a self-hosted personal dashboard with drag-and-drop widgets. It is a monorepo with a React frontend (`client/`) and an Express backend (`server/`). The canonical task list and implementation spec is in `TASKS.md` — always read the relevant task block before implementing anything.

## Commands

### Running the full stack
```
docker compose up --build
```

### Client (from `client/`)
```
npm run dev       # Vite dev server on port 5173
npm run build     # Production build
npm run lint      # ESLint
```

### Server (from `server/`)
```
npm run dev       # nodemon + ts-node, port 3001
npm run test      # Jest (run all tests)
npm run test:watch
```

To run a single server test file:
```
npx jest src/__tests__/runner.test.ts
```

## Architecture

### Navigation
`App.tsx` is a pure URL router — no router library. It reads `?view=` from the query string and renders the matching view component. Supported values:
- `?view=scripts` → `ScriptsView` (data sources + connector management)
- `?view=secrets` → `SecretsView` (encrypted key/value store)
- `?view=pipeline&id=<id>` → `PipelineBuilderView` (visual pipeline editor for a specific source)
- (default / no param) → `DashboardView` (the widget grid)

Navigation between views is done with `window.location.search = '?view=...'` — no programmatic router.

### Data flow: Dashboard
Data fetching for the dashboard lives in hooks, not in `App.tsx`. The flow is:

1. `useLayoutPersistence` (`client/src/hooks/useLayoutPersistence.ts`) — loads the saved grid layout and all widget configs from `GET /api/layout` on mount. Exposes `scheduleSave` (debounced 1000 ms, used on drag/resize) and `persist` (immediate, used on config edit / add / remove).
2. `useWidgetData` (`client/src/hooks/useWidgetData.ts`) — fetches live data for every weather and script widget currently in the grid. Re-fires only when relevant config keys change (not on every render). Uses `AbortController` to cancel in-flight requests when configs change.
3. Widgets are purely presentational and receive two props: `config` (user settings) and `data` (server data, or `null` while loading).

### Widget contract
Every widget implements `WidgetProps<C, D>` from `client/src/widgets/WidgetBase.tsx`:
```ts
interface WidgetProps<C, D> {
  config: C   // user-edited settings
  data: D | null  // server-fetched data; null means still loading
}
```
New widgets go in `client/src/widgets/` and must be exported from `client/src/widgets/index.ts`. Widgets never call `fetch` directly.

### Data Sources + Scripts
`ScriptsView` manages data sources. A source is a scheduled JavaScript snippet stored in the `data_sources` table and run by the server on a node-cron schedule.

Sources come in two modes (distinguished by whether `pipeline_json` is set):
- **Code mode**: raw JS written in the Monaco editor, saved directly as `script`.
- **Pipeline mode**: a visual step graph stored as `pipeline_json`. On every save, the server compiles it to a JS `script` using `server/src/pipeline/generate.ts`. The scheduler runs `script` in both cases — `pipeline_json` is the source of truth for the builder UI only.

"Switch to Code Mode" in the builder replaces `pipeline_json` with the generated `script` and navigates to `ScriptsView`. This is irreversible from the UI.

Scripts run inside a Node.js `vm.runInNewContext` sandbox with a 10-second timeout. The sandbox exposes: `fetch`, `console`, `Promise`, and a `getSecret(key)` helper that decrypts and returns a stored secret value. The return value of the script (or `{ error: string }` on failure) is persisted to `last_output`.

### Pipeline system
`server/src/pipeline/generate.ts` compiles a `Pipeline` object (typed in `server/src/pipeline/types.ts`) to a JavaScript string by walking steps in order:

| Step type | What it does |
|-----------|--------------|
| `fetch` | HTTP request via a connector or custom URL |
| `pick` | Selects a subset of fields from an object |
| `rename` | Renames fields using a mapping |
| `merge` | Combines outputs from multiple fetch steps |
| `math` | Arithmetic on a field |
| `output` | Renames fields for final output |

Each step references previous steps by `id` (the `sourceId` / `sources` fields). Step ordering determines execution order. If no `output` step is present, the script returns the last step's result.

Connectors (`/api/connectors`) are reusable HTTP templates with `{variable}` placeholders. `resolveConnectorStep` merges a connector's URL, method, headers, and body into a fetch step, substituting the step's `variables` map.

### Layout + config persistence
Layout and widget configs are saved in a single atomic `POST /api/layout` with body:
```json
{ "layout": { "lg": [...LayoutItem] }, "configs": { "<widgetId>": { "type": "weather", "config": {...} } } }
```
The server replaces all widget rows inside a transaction. The layout has a single row in the `layouts` table (`id = 'main'`).

### Database (`server/src/db.ts`)
SQLite via `better-sqlite3`. All DB calls are synchronous — never use `async/await` with better-sqlite3. The DB file is `server/paul.db`. All tables are created on startup via `db.exec(...)` in `db.ts`.

Full schema:
```sql
layouts(id TEXT PK, layout_json TEXT)
  -- Single row id='main'. layout_json = { lg: LayoutItem[] } as JSON.

widgets(id TEXT PK, type TEXT, config_json TEXT)
  -- One row per widget instance on the dashboard.

data_sources(id TEXT PK, name TEXT, script TEXT, pipeline_json TEXT,
             schedule TEXT, last_output TEXT, last_run_at TEXT)
  -- schedule is a node-cron expression (e.g. '*/5 * * * *').
  -- last_output is JSON-serialised result or { error } on failure.
  -- pipeline_json is null for code-mode sources; when set, script is derived from it.

connectors(id TEXT PK, name TEXT, description TEXT, url_template TEXT,
           method TEXT, headers_json TEXT, body_template TEXT,
           variables_json TEXT, is_builtin INTEGER)
  -- headers_json = [{ key, value }] as JSON.
  -- variables_json = variable definitions for the UI as JSON.
  -- is_builtin = 1 means read-only (shipped with Paul, re-seeded on startup).

secrets(key TEXT PK, encrypted_value TEXT)
  -- encrypted_value format: iv:authTag:ciphertext (all hex, colon-delimited).
  -- Encrypted with AES-256-GCM using the PAUL_SECRET_KEY env var.
  -- Secret values are never sent to the client — only key names are returned.
```

### Server (`server/src/index.ts`)
Express 5 + CORS. Startup order matters: `seedBuiltinConnectors()` must run before `startAllCronJobs()` so built-in connectors exist when pipelines reference them.

Routes:
- `GET /health` — liveness check
- `GET/POST /api/layout` — grid layout + widget config persistence
- `GET /api/weather` — proxies Open-Meteo (no API key required)
- `GET/POST/PUT/DELETE /api/sources` — data source CRUD; `POST /:id/run` triggers immediate execution
- `GET/POST/PUT/DELETE /api/connectors` — HTTP connector template CRUD
- `GET/POST/DELETE /api/secrets` — encrypted key/value store

### Shared types
`@paul/types` is a path alias (configured in both `client/tsconfig.json` and `client/vite.config.js`) that points to `server/src/types/api.ts`. Both the client and server import from this single file. It defines `Source`, `Connector`, `ConnectorBody`, and `WidgetConfigs`.

### Secrets encryption (`server/src/services/encryption.ts`)
AES-256-GCM. The encryption key is derived from `PAUL_SECRET_KEY` env var (falls back to an insecure default — set this in production). The stored format is `iv:authTag:ciphertext` (hex). `getSecret(key)` in the VM sandbox calls `decryptValue` directly.

### Environment
Client reads `VITE_API_URL` from `client/.env`. Never hardcode API URLs in components — always go through the functions in `client/src/api.ts`.

## Documentation Rules

1. **Everything documented here must be accurate and backed by the source code.** If code changes make this file wrong, update it. Do not document intended behavior that differs from what the code actually does.
2. **Documentation must be immediately clear to a new developer.** Avoid ambiguous wording, implicit behaviors, or cross-references that force someone to open 5 files to understand one concept. If a behavior requires explanation, explain it here.

## Non-Negotiable Rules

These apply to every task in this project:

- **No external UI library.** Plain HTML and CSS only — no component libraries.
- **No state management library.** `useState` and `useEffect` only — no Redux, Zustand, etc.
- **No Axios.** Use the native `fetch` API only.
- **All better-sqlite3 calls are synchronous.** No async/await with the DB.
- **Widgets never fetch their own data.** Data is always passed via the `data` prop.
- **Hard deletes only.** No soft delete or archive.
- **File extensions:** frontend components use `.tsx`, frontend utilities use `.ts`, all backend files use `.ts`.
