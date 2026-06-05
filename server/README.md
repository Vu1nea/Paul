# Paul — Backend

Express 5 + TypeScript server for the Paul dashboard. Runs on port **3001**.

## Running

```bash
# from server/
npm run dev       # nodemon + ts-node
```

Or via the full stack:

```bash
# from repo root
docker compose up --build
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PAUL_SECRET_KEY` | No | Passphrase used to derive the AES-256-GCM encryption key for secrets. Defaults to an insecure dev value — **always set this in production**. |

## API Routes

### Layout

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/layout` | Returns `{ layout, configs }` — the grid layout and all widget configs. |
| `POST` | `/api/layout` | Saves layout + configs atomically. Widget table is fully replaced on each save. |

Request body for `POST /api/layout`:
```json
{
  "layout": { "lg": [ /* react-grid-layout items */ ] },
  "configs": {
    "<widget-id>": { "type": "WeatherWidget", "config": { /* ... */ } }
  }
}
```

### Data Sources

Data sources are user-defined scripts (or visual pipelines) that run on a cron schedule and store their output in the DB for widgets to consume.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sources` | List all sources (excludes raw script/pipeline). |
| `GET` | `/api/sources/:id` | Get a single source including script and pipeline_json. |
| `POST` | `/api/sources` | Create a source and register its cron job. |
| `PUT` | `/api/sources/:id` | Update a source and restart its cron job. |
| `DELETE` | `/api/sources/:id` | Delete a source and stop its cron job. |
| `POST` | `/api/sources/:id/run` | Run a source immediately and return its output. |

Request body for `POST` / `PUT`:
```json
{
  "name": "My Source",
  "schedule": "*/5 * * * *",
  "pipeline_json": "{ ... }",
  "script": "return await fetch(...).then(r => r.json())"
}
```

When `pipeline_json` is provided it is compiled to a JS string and stored in `script`. `pipeline_json` is the source of truth — `script` is always derived from it.

### Connectors

Connectors are reusable HTTP request templates (URL, method, headers, body) with `{variable}` placeholders. Built-in connectors (e.g. Open-Meteo) cannot be modified or deleted.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/connectors` | List all connectors. |
| `POST` | `/api/connectors` | Create a custom connector. |
| `PUT` | `/api/connectors/:id` | Update a connector (403 for built-ins). |
| `DELETE` | `/api/connectors/:id` | Delete a connector (403 for built-ins). |

### Secrets

Secrets are key/value pairs stored AES-256-GCM encrypted. Scripts access them via `getSecret('key')` inside the VM sandbox. Values are **never** returned over the API.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/secrets` | Returns `{ keys: string[] }` — names only. |
| `POST` | `/api/secrets` | Store a new secret. 409 if key already exists. |
| `DELETE` | `/api/secrets/:key` | Delete a secret. |

### Weather (widget proxy)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/weather` | Proxies Open-Meteo. No API key required. |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: 'ok' }`. |

## Architecture

### Database (`src/db.ts`)

SQLite via `better-sqlite3`. All DB calls are **synchronous** — never use `async/await` with the DB layer.

File: `server/paul.db`

**Tables:**

- `layouts` — single row (`id = 'main'`) storing the grid layout as JSON.
- `widgets` — one row per widget instance; fully replaced on every layout save.
- `data_sources` — stores both `pipeline_json` (raw definition) and `script` (compiled JS). When a pipeline is saved, the server compiles it to `script` immediately so the VM runner never needs to do codegen at runtime.
- `connectors` — HTTP request templates. `is_builtin = 1` rows are seeded on startup and are read-only via the API.
- `secrets` — encrypted key/value store. Format: `iv:authTag:ciphertext` (hex, colon-delimited).

### Pipeline (`src/pipeline/`)

The pipeline system lets users build data-fetching flows visually. A pipeline is a JSON array of steps; the server compiles it to a self-contained JS string that runs in the VM sandbox.

**Step types:**

| Type | Description | What it generates |
|---|---|---|
| `fetch` | Makes an HTTP request and parses the JSON response. Supports GET/POST, custom headers, bearer/API-key auth, and connector templates with `{variable}` substitution. | `const id = await fetch(url, options).then(r => r.json())` |
| `pick` | Selects a subset of fields from a previous step's output, discarding everything else. | `const id = { field: source?.field, ... }` |
| `rename` | Renames fields from a previous step's output using explicit `from → to` mappings, leaving unmentioned fields unchanged. | `const id = { newKey: source?.oldKey, ... }` |
| `merge` | Combines the outputs of multiple earlier steps into one object, assigning each under an alias key. | `const id = { alias: stepRef, ... }` |
| `math` | Applies a binary arithmetic operation (`+`, `-`, `*`, `/`, `%`) to two operands (field references or literals) and adds the result as a new field on the source object. | `const id = { ...source, outputKey: left op right }` |
| `output` | Shapes the final return value of the pipeline using `from → to` field mappings. If omitted, the last step's variable is returned as-is. | `return { mappedKey: source?.field, ... }` |

If no `output` step is present, the last step's variable is returned implicitly.

**Connector resolution:** When a fetch step references a `connector_id`, `resolveConnectorStep` merges the connector's URL template, method, and headers into the step (substituting `{variable}` placeholders), then sets `connector_id` to `null` on the resolved copy.

### Script Runner (`src/services/runner.ts`)

Each data source script runs inside a Node.js `vm` sandbox with a **10-second timeout**. The sandbox exposes: `fetch`, `console`, `Promise`, and `getSecret(key)`. No other globals are available. The return value (or an `{ error }` object on failure) is JSON-serialised and stored in `last_output`.

### Encryption (`src/services/encryption.ts`)

`PAUL_SECRET_KEY` is passed through `scryptSync` to derive a 32-byte AES-256-GCM key. The IV is randomly generated per encryption call. Stored format: `iv:authTag:ciphertext` (all hex).

### Cron Jobs (`src/services/runner.ts`)

All data sources are loaded on startup and scheduled with `node-cron`. Sources with invalid cron expressions are silently skipped. The `registerCronJob` function replaces an existing job for a source when it is updated, and `stopCronJob` cleans up on delete.
