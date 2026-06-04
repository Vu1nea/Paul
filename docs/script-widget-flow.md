# ScriptWidget: How It Works End-to-End

This document explains the full lifecycle of a ScriptWidget — from the moment the server boots, through data collection, all the way to what you see rendered on the dashboard.

---

## The Big Picture

```
User creates a Data Source (script + schedule)
          |
          v
Server runs the script on a cron schedule
          |
          v
Output is saved to the database (last_output column)
          |
          v
User adds a ScriptWidget to the dashboard, sets sourceId
          |
          v
App.tsx fetches the saved output from the server
          |
          v
ScriptWidget renders one field from that output
```

---

## Step 1 — The Data Source (the "script" side)

Before a ScriptWidget can show anything, a **Data Source** must exist.

A Data Source is a JavaScript script stored in the database. It lives in the `data_sources` table (`server/src/db.ts`):

| Column | What it stores |
|---|---|
| `id` | A UUID that uniquely identifies this source |
| `name` | Human-readable label (e.g. "Stock Price") |
| `script` | The actual JS code to run |
| `schedule` | A cron expression (e.g. `*/5 * * * *` = every 5 min) |
| `last_output` | JSON string of the most recent result |
| `last_run_at` | Timestamp of the last run |

Users create/edit these via the **Scripts** view (`?view=scripts`).

---

## Step 2 — The Runner executes the script on a schedule

`server/src/runner.ts` is responsible for actually running scripts.

### On server startup

`index.ts` calls `startAllCronJobs()`, which reads every row from `data_sources` and schedules each one:

```
Server starts → startAllCronJobs() → one cron job registered per data source
```

### How a script runs (`runScript`)

```ts
// runner.ts (simplified)
const wrappedScript = `(async () => { ${source.script} })()`
const result = await vm.runInNewContext(wrappedScript, sandbox, { timeout: 10000 })
db.prepare('UPDATE data_sources SET last_output = ? ...').run(JSON.stringify(result), ...)
```

Key points:
- The script runs in a **sandboxed VM** — it can only access `fetch`, `console`, `getSecret`, and `Promise`. It cannot access the filesystem or Node.js APIs.
- The script must **return a value** — that return value becomes `last_output`.
- `getSecret(key)` lets a script securely retrieve a stored secret by name (e.g. an API key).
- If the script throws, `last_output` is set to `{ error: "..." }` instead of crashing the server.
- The result is stored as a **JSON string** in `last_output`.

### Example script

```js
const res = await fetch('https://api.example.com/price?symbol=AAPL')
const json = await res.json()
return { price: json.data.price, currency: 'USD' }
```

After this runs, `last_output` in the DB would be:
```json
{ "price": 192.34, "currency": "USD" }
```

---

## Step 3 — The API exposes the saved output

`server/src/routes/sources.ts` defines `GET /api/sources/:id`.

When called, it:
1. Looks up the row in `data_sources` by `id`
2. Parses `last_output` from a JSON string back into an object
3. Returns the full row, including the parsed `last_output`

The widget only ever reads **the last saved output** — it does not trigger the script to run. The script is always run by the cron scheduler (or manually via `POST /api/sources/:id/run`).

---

## Step 4 — App.tsx fetches the data and passes it down

`App.tsx` manages all data fetching. It does NOT let widgets fetch their own data.

### Tracking which script widgets exist

`App.tsx` computes a `scriptKey` — a string that changes whenever the set of script widgets or their `sourceId` settings change:

```ts
const scriptKey = Object.entries(widgetConfigs)
  .filter(([, w]) => w.type === 'script')
  .map(([id, { config }]) => `${id}:${config.sourceId}`)
  .sort().join('|')
```

### Fetching the data

A `useEffect` watches `scriptKey` and re-runs whenever it changes:

```ts
useEffect(() => {
  for (const [id, { config }] of scriptWidgets) {
    const { sourceId } = config
    setScriptDataMap(prev => ({ ...prev, [id]: null }))  // show "Loading..."
    fetch(`${apiUrl}/api/sources/${sourceId}`)
      .then(res => res.json())
      .then(data => setScriptDataMap(prev => ({ ...prev, [id]: data.last_output })))
      .catch(() => setScriptDataMap(prev => ({ ...prev, [id]: { error: 'Failed to load' } })))
  }
}, [apiUrl, scriptKey])
```

The result is stored in `scriptDataMap`, a dictionary keyed by widget ID.

---

## Step 5 — ScriptWidget renders one value

`renderWidget()` in `App.tsx` passes the fetched data to the widget:

```ts
<ScriptWidget config={entry.config as ScriptConfig} data={scriptDataMap[id] ?? null} />
```

`ScriptWidget.tsx` receives:
- **`config`** — the widget's settings: `{ sourceId, displayKey, label }`
- **`data`** — the parsed `last_output` JSON object (or `null` while loading)

```ts
// ScriptWidget.tsx (simplified)
const value = resolvePath(data, config.displayKey)
return (
  <div>
    <div>{config.label}</div>   {/* e.g. "Stock Price" */}
    <div>{String(value)}</div>  {/* e.g. "192.34" */}
  </div>
)
```

`config.displayKey` is a dot-separated path into the data object — for example `price` would extract `192.34` from `{ price: 192.34, currency: "USD" }`. This is handled by `resolvePath()` in `client/src/utils/resolvePath.ts`.

---

## Step 6 — Configuring the widget

When you click the gear icon on a ScriptWidget, a modal opens with three fields:

| Field | What it does |
|---|---|
| **Source ID** | The UUID of the data source to read from. You copy this from the Scripts view. |
| **Display Key** | Dot-path into the output JSON. `price` → top-level field. `weather.temp` → nested field. |
| **Label** | The small grey label shown above the value. |

Saving the modal calls `POST /api/layout`, which persists the updated config to the `widgets` table.

---

## Full Data Flow Summary

```
[Scripts view]
  User writes JS script + cron schedule
  → POST /api/sources → saved to data_sources table

[Server background]
  node-cron fires on schedule
  → runScript() executes JS in sandboxed VM
  → result saved to data_sources.last_output

[Dashboard load]
  App.tsx → GET /api/layout → reads widget configs from widgets table
  App.tsx → GET /api/sources/:sourceId → reads last_output
  → scriptDataMap[widgetId] = parsed JSON output

[Render]
  ScriptWidget receives config + data
  → resolvePath(data, config.displayKey) extracts the value
  → displays label + value on the dashboard tile
```

---

## Key Files

| File | Role |
|---|---|
| `server/src/db.ts` | Defines all tables, including `data_sources` |
| `server/src/runner.ts` | Sandboxed script execution + cron scheduling |
| `server/src/routes/sources.ts` | REST API for creating/reading/running data sources |
| `client/src/App.tsx` | Fetches `last_output` and passes it to widgets |
| `client/src/widgets/ScriptWidget.tsx` | Renders the value from the data |
| `client/src/utils/resolvePath.ts` | Resolves dot-path keys into nested objects |
