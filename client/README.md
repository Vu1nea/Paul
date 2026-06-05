# Paul — Frontend

React 19 + Vite frontend for the Paul dashboard. Runs on port **5173**.

## Running

```bash
# from client/
npm run dev       # Vite dev server
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Vitest (unit tests)
```

Or via the full stack:

```bash
# from repo root
docker compose up --build
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Base URL for the backend API. Defaults to `http://localhost:3001` in `.env`. |

All API calls in `src/api.ts` prepend this value — never hardcode the URL in components.

## Routing

There is no client-side router library. `App.tsx` reads `window.location.search` directly and renders one of four views based on query params:

| URL | View |
|---|---|
| `?` (default) | `DashboardView` — the widget grid |
| `?view=scripts` | `ScriptsView` — manage data sources and connectors |
| `?view=secrets` | `SecretsView` — manage encrypted secrets |
| `?view=pipeline&id=<sourceId>` | `PipelineBuilderView` — visual pipeline editor for a specific source |

Navigation between views is done with plain `<a href="?...">` links.

## Architecture

### File map

```
src/
  App.tsx                    # URL router — renders one view based on query params
  AppShell.tsx               # Persistent page chrome (header, nav). Wraps every view.
  WidgetConfigModal.tsx      # Generic modal dialog (portal-based) for widget config editing
  WeatherConfigForm.tsx      # Config form for WeatherWidget — city search via Open-Meteo geocoding
  ScriptWidgetConfigForm.tsx # Config form for ScriptWidget — source picker + display key selector

  api.ts                     # All server calls (fetch only, no Axios)

  hooks/
    useLayoutPersistence.ts  # Loads layout on mount; debounced + immediate save helpers
    useWidgetData.ts         # Fetches live data for all weather and script widgets

  views/
    DashboardView.tsx        # Widget grid — drag/resize/add/remove/configure
    ScriptsView.tsx          # Two-panel view: sources list + Monaco editor, connectors tab
    SecretsView.tsx          # CRUD for named secrets
    PipelineBuilderView.tsx  # Visual step editor for pipeline-mode sources

  views/pipeline/steps/
    types.ts                 # Step type definitions and newStep() factory
    FetchStepForm.tsx        # Form for fetch steps
    PickStepForm.tsx         # Form for pick steps
    RenameStepForm.tsx       # Form for rename steps
    MergeStepForm.tsx        # Form for merge steps
    MathStepForm.tsx         # Form for math steps
    OutputStepForm.tsx       # Form for output steps

  widgets/
    WidgetBase.tsx           # WidgetProps<C, D> interface — the contract all widgets implement
    index.ts                 # Re-exports all widgets and their config/data types
    PlaceholderWidget.tsx    # Debug widget — dumps config and data as formatted JSON
    WeatherWidget.tsx        # Displays current weather from the server proxy
    ScriptWidget.tsx         # Displays a single value from a source's last_output

  utils/
    resolvePath.ts           # Reads a value from a nested object by dot-notation path
```

### API layer (`src/api.ts`)

One function per server endpoint. All calls use `fetch` with `VITE_API_URL` as the base. Functions are grouped into five sections:

| Section | Functions |
|---|---|
| Layout | `getLayout`, `saveLayout` |
| Sources | `getSources`, `getSource`, `createSource`, `updateSource`, `deleteSource`, `runSource` |
| Connectors | `getConnectors`, `createConnector`, `updateConnector`, `deleteConnector` |
| Secrets | `getSecretKeys`, `createSecret`, `deleteSecret` |
| Weather | `getWeather` |

### Widget contract

Every widget accepts exactly two props, typed by `WidgetProps<C, D>` (`src/widgets/WidgetBase.tsx`):

```ts
interface WidgetProps<C, D> {
  config: C       // user settings stored in the DB
  data: D | null  // server-fetched data; null while loading
}
```

**Widgets never fetch their own data.** Data is fetched by `useWidgetData` in `DashboardView` and passed down via the `data` prop.

### Built-in widgets

| Widget | Config type | Data type | What it shows |
|---|---|---|---|
| `WeatherWidget` | `WeatherConfig` | `WeatherData \| { error: true }` | Temperature, wind speed, and condition for a city |
| `ScriptWidget` | `ScriptConfig` | `Record<string, unknown>` | A single value from a source's `last_output`, resolved by `displayKey` |
| `PlaceholderWidget` | `{ label: string }` | any | Raw JSON dump of config and data — used for unknown widget types |

### Dashboard data flow

`DashboardView` orchestrates everything on the grid:

1. **`useLayoutPersistence`** loads the saved layout and widget configs from `GET /api/layout` on mount. It exposes two save strategies:
   - `scheduleSave(allLayouts)` — debounced 1000 ms; called on every drag/resize event.
   - `persist(layout, configs)` — immediate save; called after config edits and widget add/remove.
   - `layoutLoaded` gates grid rendering to prevent a flash of default positions before the server layout arrives.

2. **`useWidgetData`** derives stable cache keys from each widget's config fields. Effects only re-fire when those keys actually change, avoiding redundant fetches. Each effect uses an `AbortController` so in-flight requests are cancelled when configs change.
   - Weather widgets → `getWeather` → stored in `weatherDataMap[id]`
   - Script widgets → `getSource` (reads `last_output`) → stored in `scriptDataMap[id]`
   - In both maps, `null` means the fetch is in flight.

3. **`renderWidget(id, entry)`** maps a widget's `type` string to the correct component and passes the matching data map entry as the `data` prop.

### Layout + config persistence

Layout and widget configs are saved together in one `POST /api/layout` call:

```json
{
  "layout": { "lg": [ /* react-grid-layout items */ ] },
  "configs": {
    "<widget-id>": { "type": "weather", "config": { ... } }
  }
}
```

The widget table on the server is fully replaced on each save.

### Sources and pipelines (`ScriptsView`)

Sources come in two modes:

- **Code mode** — editable JavaScript in a Monaco editor. Saved with a `script` field.
- **Pipeline mode** — `pipeline_json` is set on the source. The editor panel is replaced with a link to `PipelineBuilderView`. Saving happens there, not in `ScriptsView`.

Creating a new source shows a mode picker modal first. Choosing "pipeline" immediately creates the source and redirects to `?view=pipeline&id=<newId>`.

### Pipeline builder (`PipelineBuilderView`)

A pipeline is an ordered array of steps (`AnyStep[]`). The server compiles it to a JavaScript string on save; that generated script is what the scheduler actually runs.

Available step types (defined in `src/views/pipeline/steps/types.ts`):

| Type | What it does |
|---|---|
| `fetch` | HTTP request. Either a connector template or a custom URL/method/headers/body. |
| `pick` | Selects a subset of dot-notation fields from a prior step's output. |
| `rename` | Renames fields from a prior step's output via explicit `from → to` mappings. |
| `merge` | Combines outputs of multiple steps under alias keys into one object. |
| `math` | Binary arithmetic (`+`, `-`, `*`, `/`, `%`) on two operands; writes result to `outputKey`. |
| `output` | Shapes the final return value via `from → to` field mappings. If absent, the last step's value is returned. |

Run is disabled while there are unsaved changes. "Switch to Code Mode" replaces `pipeline_json` with the generated script and redirects back to `ScriptsView` — irreversible from the UI.

### Secrets (`SecretsView`)

The server never returns secret values — only key names. `getSecretKeys()` returns `string[]`. Creating a secret returns `409` if the key already exists; the form surfaces this as an inline error.

Secrets are referenced in pipeline `FetchStepData.auth` by their key name to inject bearer or API-key auth headers at runtime inside the VM sandbox.

### `WeatherConfigForm`

Provides a debounced city search (400 ms) backed directly by the Open-Meteo geocoding API (`geocoding-api.open-meteo.com`). Selecting a result populates `latitude` and `longitude` automatically — the user never enters coordinates manually.

### `ScriptWidgetConfigForm`

Lets the user pick a source and then choose a `displayKey` from a dropdown derived from that source's `last_output`. Keys are produced by `flattenKeys`, which recursively walks the JSON and returns all leaf-node paths in dot-notation (e.g. `"weather.temperature"`). If the source has no output yet, a refresh button re-calls `onRefreshSources`.

### `resolvePath` (`src/utils/resolvePath.ts`)

Reads a value from a nested object using a dot-separated path string. Returns `undefined` if any segment is missing or null.

```ts
resolvePath({ a: { b: 42 } }, 'a.b')  // → 42
resolvePath({ a: null },      'a.b')  // → undefined
```

`ScriptWidget` uses this to extract the value at `config.displayKey` from the source's `last_output`.

### `AppShell`

Every view is wrapped in `AppShell`, which renders the header (`<h1>Paul</h1>`), nav links (`Dashboard`, `Scripts`, `Secrets`), and an optional `headerActions` slot rendered to the right of the nav. `DashboardView` passes `className="app"` to get the full-height grid layout; all other views use the default `"view"` class.

### `WidgetConfigModal`

A portal rendered into `document.body` (via `createPortal`) so it sits above all other stacking contexts. Closes on `Escape` or backdrop click — neither calls `onSave`. The caller is responsible for closing the modal after a successful save.

## Constraints

- No UI library — plain HTML and CSS only.
- No state management library — `useState` and `useEffect` only.
- No Axios — `fetch` only.
- Widgets never fetch their own data — always passed via the `data` prop.
- Frontend components use `.tsx`, utilities use `.ts`.
