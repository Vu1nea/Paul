# Pipeline Builder Design

**Date:** 2026-05-27
**Feature:** Low-code pipeline builder for data sources
**Phase:** Extension of Phase 2 (Scripting Core)

---

## Overview

Paul's scripting layer (TASK-011 through TASK-015) lets technical users write TypeScript to fetch and display data. This feature extends it with a **linear step-based pipeline builder** — a low-code authoring mode targeting data analysts who understand data concepts but don't write code.

The pipeline builder is an alternative way to author a data source. It sits in front of the existing script runner and generates a JavaScript script from a visual pipeline definition. The script runner, cron scheduling, and Script Widget are completely unchanged.

**Future note:** A script/connector marketplace with author and download count is planned but out of scope for this spec.

---

## Target User

Data analysts familiar with tools like Excel, Power Query, or Airtable. They understand HTTP APIs conceptually, can read JSON, and are comfortable with structured forms — but do not write code.

---

## Architecture

A data source operates in one of two modes:

- **Pipeline mode** — authored in the pipeline builder UI. The pipeline definition is stored as JSON in `pipeline_json`. On every save, the server generates a JavaScript script from it and stores it in `script`. The script runner reads only `script`.
- **Code mode** — authored directly in Monaco. `pipeline_json` is `NULL`. `script` holds the user's code.

Switching from pipeline to code mode is one-way: the generated script is copied into the Monaco editor, `pipeline_json` is set to `NULL`, and the user takes full ownership of the code.

---

## Data Model

### `data_sources` table (modified from TASK-011)

```sql
CREATE TABLE IF NOT EXISTS data_sources (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  script        TEXT NOT NULL,      -- always populated; generated or hand-written
  pipeline_json TEXT,               -- NULL = code mode; JSON = pipeline mode
  schedule      TEXT NOT NULL,
  last_output   TEXT,
  last_run_at   TEXT
);
```

### `connectors` table (new)

```sql
CREATE TABLE IF NOT EXISTS connectors (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  url_template   TEXT NOT NULL,     -- URL with {variable} placeholders
  method         TEXT NOT NULL DEFAULT 'GET',
  headers_json   TEXT NOT NULL DEFAULT '[]',   -- [{key, value}] with {variable} support
  body_template  TEXT,              -- NULL for GET; JSON string with {variable} support for POST
  variables_json TEXT NOT NULL DEFAULT '[]',   -- [{name, label, placeholder}]
  is_builtin     INTEGER NOT NULL DEFAULT 0
);
```

`variables_json` defines each `{placeholder}` in the URL, headers, and body — its internal name, the label shown in the UI, and placeholder text. Built-in connectors are seeded into this table with `is_builtin = 1` on server startup. They appear in the connector picker alongside user-created connectors but cannot be edited or deleted.

---

## Pipeline Steps

A pipeline is an ordered list of steps. Each step has a `type`, a user-defined `label`, an `id`, and a reference to the step(s) it reads from. Steps are executed top to bottom.

| Step | Purpose |
|------|---------|
| **Fetch** | HTTP request (GET or POST). Supports custom URL, headers, body, and auth (Bearer token or API key from Secrets). Can be pre-filled from a connector template. |
| **Pick Fields** | Keeps only specified dot-notation paths from a source step's output. Produces a flat object using leaf key names. |
| **Rename** | Maps `old_key → new_name` pairs on a source step's output. |
| **Merge** | Combines two Fetch step outputs under user-defined namespace keys (e.g. `sales`, `inventory`). |
| **Math** | Computes a new field from two operands (field paths or constants) using +, −, ×, ÷, or %. Spreads the result onto the source output under a user-defined key. |
| **Output** | Required final step. Maps field paths from any previous step to the keys the Script Widget receives as `data`. |

### Pipeline JSON shape (stored in `pipeline_json`)

When `connector_id` is set, `url`, `method`, `headers`, and `body` are `null` — the connector template provides them. When `connector_id` is `null` (custom request), those fields are populated directly on the step.

The `auth` field is a convenience shorthand. `{ "type": "bearer", "secret": "MY_KEY" }` generates `Authorization: Bearer ${getSecret('MY_KEY')}` as a header at code-generation time. It is distinct from manually-specified entries in `headers` — both can coexist on the same step.

```json
{
  "steps": [
    {
      "type": "fetch",
      "id": "step_1",
      "label": "Weather Data",
      "connector_id": "open-meteo",
      "variables": { "lat": "45.5017", "lon": "-73.5673" },
      "method": null,
      "url": null,
      "headers": [],
      "body": null,
      "auth": { "type": "bearer", "secret": "MY_API_KEY" }
    },
    {
      "type": "pick",
      "id": "step_2",
      "label": "Trim Fields",
      "sourceId": "step_1",
      "fields": ["current_weather.temperature", "current_weather.windspeed"]
    },
    {
      "type": "output",
      "id": "step_3",
      "label": "Output",
      "sourceId": "step_2",
      "mappings": [
        { "from": "temperature", "to": "temp" },
        { "from": "windspeed", "to": "wind" }
      ]
    }
  ]
}
```

---

## Code Generation

The server generates a JavaScript string from the pipeline on every save. Each step becomes a `const` declaration in order, wrapped in the existing TASK-012 pattern:

```js
(async () => {
  // Fetch step
  const step_1 = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=45.5017&longitude=-73.5673`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${getSecret('MY_KEY')}` } }
  ).then(r => r.json());

  // Pick Fields step
  const step_2 = {
    temperature: step_1?.current_weather?.temperature,
    windspeed:   step_1?.current_weather?.windspeed,
  };

  // Rename step
  const step_3 = { temp_f: step_2.temperature, wind_mph: step_2.windspeed };

  // Merge step
  const step_4 = { sales: step_1, inventory: step_2 };

  // Math step
  const step_5 = { ...step_3, margin: step_3.revenue - step_3.cost };

  // Output step (always last)
  return { temperature: step_3.temp_f, wind: step_3.wind_mph };
})()
```

Variable placeholder substitution (`{lat}` → `45.5017`) happens at code-generation time. Auth values that reference Secrets produce a `getSecret()` call so decryption happens at runtime inside the vm sandbox.

The code generator lives in `server/src/pipeline.ts` and exports a single `generateScript(pipeline: Pipeline): string` function.

---

## UI Flow

### Creating a new data source
"New Script" shows a two-option picker: **"Build a pipeline"** or **"Write code"**. Code mode opens Monaco directly. Pipeline mode opens the builder.

### Pipeline builder layout (top to bottom)
1. Name and schedule inputs
2. Step list — each step is a card (label + type). Up/down arrows to reorder. Clicking a card expands the inline step form.
3. **"+ Add Step"** button — opens a step type picker
4. Run Now, output block, Save, Delete (same behaviour as TASK-014)
5. **"View Generated Code"** — opens a read-only Monaco panel showing the current generated script

### Adding a Fetch step
The step type picker shows: built-in connectors, user-saved connectors, then "Custom HTTP Request". Selecting a connector pre-fills the URL, method, headers, and body. The user fills in the `variables_json` form fields (e.g. Latitude, Longitude). Custom HTTP Request shows a blank form.

### Switching to code mode
"View Generated Code" has a **"Switch to Code Mode"** button. Confirmation dialog: *"This will replace the pipeline with the generated code. You won't be able to switch back."* On confirm, sets `pipeline_json = NULL` and loads the generated script into Monaco.

### Connectors tab
A **"Connectors"** tab in the Scripts view lets users create, edit, and delete their own connectors. The create/edit form has: name, description, method, URL template, headers, body template, and a variables section defining each `{placeholder}` (name, label, placeholder text). Built-in connectors are listed but greyed out — not editable or deletable.

---

## API Routes (new and modified)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/connectors` | Returns all connectors (built-in + user). |
| `POST` | `/api/connectors` | Creates a new user connector. |
| `PUT` | `/api/connectors/:id` | Updates a user connector. Returns 403 if `is_builtin = 1`. |
| `DELETE` | `/api/connectors/:id` | Deletes a user connector. Returns 403 if `is_builtin = 1`. |
Existing `/api/sources` routes are updated so that `POST` and `PUT` accept an optional `pipeline_json` field and call the code generator before saving to the database. "View Generated Code" reads the `script` column directly — no separate generate endpoint is needed.

---

## File Structure

New files:
- `server/src/pipeline.ts` — `generateScript(pipeline: Pipeline): string`
- `server/src/connectors.ts` — built-in connector seed data and connector routes
- `client/src/views/PipelineBuilderView.tsx` — the pipeline builder UI component
- `client/src/views/ConnectorsView.tsx` — the connectors management tab

Modified files:
- `server/src/db.ts` — add `pipeline_json` column to `data_sources`, create `connectors` table, seed built-in connectors
- `server/src/index.ts` — register new connector routes, update source routes to call code generator
- `client/src/views/ScriptsView.tsx` (TASK-014) — add pipeline/code picker on new source creation, add Connectors tab
