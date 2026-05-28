# Pipeline Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 2 scripting layer (TASK-011 to TASK-015) extended with a low-code pipeline builder that lets non-technical users fetch and combine data from HTTP APIs without writing code.

**Architecture:** A data source has two authoring modes — pipeline mode stores a JSON step definition and generates a JavaScript script on save; code mode stores raw JavaScript. The script runner, cron scheduling, and Script Widget are unchanged — both modes produce the same `script` column. The pipeline builder adds a `connectors` table for reusable HTTP endpoint templates.

**Tech Stack:** Node.js `vm` module, `node-cron`, `better-sqlite3` (sync), Node.js `crypto` (AES-256-GCM), `@monaco-editor/react`, React `useState`/`useEffect` only, native `fetch`, plain HTML/CSS.

---

## File Map

### New server files
- `server/src/pipeline.ts` — TypeScript types for Pipeline/steps + `generateScript()` + `resolveConnectorStep()`
- `server/src/runner.ts` — `runScript()`, `startAllCronJobs()`, `registerCronJob()`, `stopCronJob()`
- `server/src/secrets.ts` — `encryptValue()`, `decryptValue()`
- `server/src/routes/sources.ts` — CRUD routes for `/api/sources`
- `server/src/routes/connectors.ts` — CRUD routes for `/api/connectors` + built-in seed data
- `server/src/routes/secrets.ts` — CRUD routes for `/api/secrets`

### New client files
- `client/src/utils/resolvePath.ts` — dot-notation path resolver
- `client/src/widgets/ScriptWidget.tsx` — displays a single value from a data source's last output
- `client/src/views/ScriptsView.tsx` — source list + code/pipeline mode picker + Monaco editor
- `client/src/views/PipelineBuilderView.tsx` — step-based pipeline authoring UI
- `client/src/views/ConnectorsView.tsx` — connector create/edit/delete UI
- `client/src/views/SecretsView.tsx` — secrets key management UI

### Modified files
- `server/src/db.ts` — add `data_sources`, `connectors`, `secrets` tables
- `server/src/index.ts` — mount new route files, call `startAllCronJobs()`
- `client/src/App.tsx` — navigation links, query-param view routing, Script widget data fetching
- `client/src/widgets/index.ts` — export `ScriptWidget`

---

### Task 1: Server test infrastructure

**Files:**
- Create: `server/jest.config.ts`
- Modify: `server/package.json`

- [ ] **Step 1: Install Jest and ts-jest**

Run from `server/`:
```
npm install --save-dev jest @types/jest ts-jest
```

- [ ] **Step 2: Create jest config**

Create `server/jest.config.ts`:
```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
}

export default config
```

- [ ] **Step 3: Add test script to package.json**

In `server/package.json`, replace `"test": "echo \"Error: no test specified\" && exit 1"` with:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Write smoke test**

Create `server/src/__tests__/smoke.test.ts`:
```typescript
describe('jest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run smoke test**

```
npm test
```
Expected: `1 test passed`

- [ ] **Step 6: Commit**

```
git add server/jest.config.ts server/package.json server/package-lock.json server/src/__tests__/smoke.test.ts
git commit -m "chore: add Jest test infrastructure to server"
```

---

### Task 2: Database schema

**Files:**
- Modify: `server/src/db.ts`

- [ ] **Step 1: Replace db.ts with the full schema**

```typescript
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '..', 'paul.db')
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS layouts (
    id          TEXT PRIMARY KEY,
    layout_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS widgets (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    config_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS data_sources (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    script        TEXT NOT NULL,
    pipeline_json TEXT,
    schedule      TEXT NOT NULL,
    last_output   TEXT,
    last_run_at   TEXT
  );
  CREATE TABLE IF NOT EXISTS connectors (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT,
    url_template   TEXT NOT NULL,
    method         TEXT NOT NULL DEFAULT 'GET',
    headers_json   TEXT NOT NULL DEFAULT '[]',
    body_template  TEXT,
    variables_json TEXT NOT NULL DEFAULT '[]',
    is_builtin     INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS secrets (
    key             TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL
  );
`)

export default db
```

- [ ] **Step 2: Write a schema test**

Create `server/src/__tests__/db.test.ts`:
```typescript
import Database from 'better-sqlite3'

describe('database schema', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(`
      CREATE TABLE IF NOT EXISTS data_sources (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, script TEXT NOT NULL,
        pipeline_json TEXT, schedule TEXT NOT NULL, last_output TEXT, last_run_at TEXT
      );
      CREATE TABLE IF NOT EXISTS connectors (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        url_template TEXT NOT NULL, method TEXT NOT NULL DEFAULT 'GET',
        headers_json TEXT NOT NULL DEFAULT '[]', body_template TEXT,
        variables_json TEXT NOT NULL DEFAULT '[]', is_builtin INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS secrets (
        key TEXT PRIMARY KEY, encrypted_value TEXT NOT NULL
      );
    `)
  })

  afterEach(() => db.close())

  it('inserts and reads a data_source row', () => {
    db.prepare('INSERT INTO data_sources (id, name, script, schedule) VALUES (?, ?, ?, ?)')
      .run('s1', 'Test', 'return {}', '*/5 * * * *')
    const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get('s1') as { name: string }
    expect(row.name).toBe('Test')
  })

  it('data_source pipeline_json defaults to null', () => {
    db.prepare('INSERT INTO data_sources (id, name, script, schedule) VALUES (?, ?, ?, ?)')
      .run('s2', 'Test', 'return {}', '*/5 * * * *')
    const row = db.prepare('SELECT pipeline_json FROM data_sources WHERE id = ?').get('s2') as { pipeline_json: null }
    expect(row.pipeline_json).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests**

```
npm test
```
Expected: `3 tests passed`

- [ ] **Step 4: Commit**

```
git add server/src/db.ts server/src/__tests__/db.test.ts
git commit -m "feat: add data_sources, connectors, secrets tables to schema"
```

---

### Task 3: Pipeline types and code generator

**Files:**
- Create: `server/src/pipeline.ts`
- Create: `server/src/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write failing tests for generateScript**

Create `server/src/__tests__/pipeline.test.ts`:
```typescript
import { generateScript } from '../pipeline'
import type { Pipeline } from '../pipeline'

describe('generateScript', () => {
  it('generates a fetch step with no auth', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com/data',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'output', id: 'step_2', label: 'Out',
          sourceId: 'step_1', mappings: [{ from: 'value', to: 'result' }],
        },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain("const step_1 = await fetch(")
    expect(script).toContain('https://api.example.com/data')
    expect(script).toContain("return {")
    expect(script).toContain("result: step_1?.value")
  })

  it('generates bearer auth header using getSecret', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null,
          auth: { type: 'bearer', secret: 'MY_KEY' }, variables: {},
        },
        { type: 'output', id: 'step_2', label: 'Out', sourceId: 'step_1', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain("Authorization")
    expect(script).toContain("getSecret('MY_KEY')")
  })

  it('generates a pick step with dot-notation paths', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'pick', id: 'step_2', label: 'Pick',
          sourceId: 'step_1', fields: ['weather.temp', 'weather.wind'],
        },
        { type: 'output', id: 'step_3', label: 'Out', sourceId: 'step_2', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('temp: step_1?.weather?.temp')
    expect(script).toContain('wind: step_1?.weather?.wind')
  })

  it('generates a rename step', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'rename', id: 'step_2', label: 'Rename',
          sourceId: 'step_1', mappings: [{ from: 'temp', to: 'temperature_f' }],
        },
        { type: 'output', id: 'step_3', label: 'Out', sourceId: 'step_2', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('temperature_f: step_1?.temp')
  })

  it('generates a merge step', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Sales',
          connector_id: null, url: 'https://api.example.com/sales',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'fetch', id: 'step_2', label: 'Inventory',
          connector_id: null, url: 'https://api.example.com/inventory',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'merge', id: 'step_3', label: 'Merge',
          sources: [{ stepId: 'step_1', as: 'sales' }, { stepId: 'step_2', as: 'inventory' }],
        },
        { type: 'output', id: 'step_4', label: 'Out', sourceId: 'step_3', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('sales: step_1')
    expect(script).toContain('inventory: step_2')
  })

  it('generates a math step', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'math', id: 'step_2', label: 'Calc',
          sourceId: 'step_1', left: 'revenue', operator: '-', right: 'cost', outputKey: 'profit',
        },
        { type: 'output', id: 'step_3', label: 'Out', sourceId: 'step_2', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('profit: step_1?.revenue - step_1?.cost')
  })

  it('wraps the whole script correctly', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        { type: 'output', id: 'step_2', label: 'Out', sourceId: 'step_1', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script.trimStart()).toMatch(/^const step_1/)
    expect(script.trimEnd()).toMatch(/return \{[\s\S]*\}$/)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --testPathPattern=pipeline
```
Expected: FAIL — `Cannot find module '../pipeline'`

- [ ] **Step 3: Implement pipeline.ts**

Create `server/src/pipeline.ts`:
```typescript
export interface FetchStep {
  type: 'fetch'
  id: string
  label: string
  connector_id: string | null
  url: string | null
  method: string | null
  headers: { key: string; value: string }[]
  body: string | null
  auth: { type: 'bearer' | 'apikey'; secret: string } | null
  variables: Record<string, string>
}

export interface PickStep {
  type: 'pick'
  id: string
  label: string
  sourceId: string
  fields: string[]
}

export interface RenameStep {
  type: 'rename'
  id: string
  label: string
  sourceId: string
  mappings: { from: string; to: string }[]
}

export interface MergeStep {
  type: 'merge'
  id: string
  label: string
  sources: { stepId: string; as: string }[]
}

export interface MathStep {
  type: 'math'
  id: string
  label: string
  sourceId: string
  left: string | number
  operator: '+' | '-' | '*' | '/' | '%'
  right: string | number
  outputKey: string
}

export interface OutputStep {
  type: 'output'
  id: string
  label: string
  sourceId: string
  mappings: { from: string; to: string }[]
}

export type PipelineStep = FetchStep | PickStep | RenameStep | MergeStep | MathStep | OutputStep

export interface Pipeline {
  steps: PipelineStep[]
}

export interface ConnectorRow {
  id: string
  url_template: string
  method: string
  headers_json: string
  body_template: string | null
}

export function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? `{${name}}`)
}

export function resolveConnectorStep(step: FetchStep, connector: ConnectorRow): FetchStep {
  const sub = (t: string) => substituteVariables(t, step.variables)
  const headers = JSON.parse(connector.headers_json) as { key: string; value: string }[]
  return {
    ...step,
    connector_id: null,
    url: sub(connector.url_template),
    method: connector.method,
    headers: headers.map(h => ({ key: h.key, value: sub(h.value) })),
    body: connector.body_template ? sub(connector.body_template) : null,
  }
}

function dotAccessor(stepId: string, path: string): string {
  return [stepId, ...path.split('.')].join('?.')
}

function leafKey(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1]
}

function operandExpr(sourceId: string, operand: string | number): string {
  if (typeof operand === 'number') return String(operand)
  return dotAccessor(sourceId, operand)
}

function generateFetchStep(step: FetchStep): string {
  const url = step.url ?? ''
  const method = step.method ?? 'GET'

  const headerLines: string[] = []
  for (const h of step.headers) {
    headerLines.push("      '" + h.key + "': '" + h.value + "'")
  }
  if (step.auth?.type === 'bearer') {
    headerLines.push("      'Authorization': `Bearer ${getSecret('" + step.auth.secret + "')}`")
  } else if (step.auth?.type === 'apikey') {
    headerLines.push("      'X-API-Key': `${getSecret('" + step.auth.secret + "')}`")
  }

  const optionParts: string[] = ["    method: '" + method + "'"]
  if (headerLines.length > 0) {
    optionParts.push('    headers: {\n' + headerLines.join(',\n') + '\n    }')
  }
  if (step.body) {
    optionParts.push('    body: ' + step.body)
  }

  return (
    'const ' + step.id + ' = await fetch(\n' +
    '  `' + url + '`,\n' +
    '  {\n' +
    optionParts.join(',\n') + '\n' +
    '  }\n' +
    ').then(r => r.json())'
  )
}

function generatePickStep(step: PickStep): string {
  const pairs = step.fields
    .map(f => '  ' + leafKey(f) + ': ' + dotAccessor(step.sourceId, f))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}

function generateRenameStep(step: RenameStep): string {
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}

function generateMergeStep(step: MergeStep): string {
  const pairs = step.sources
    .map(s => '  ' + s.as + ': ' + s.stepId)
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}

function generateMathStep(step: MathStep): string {
  const left = operandExpr(step.sourceId, step.left)
  const right = operandExpr(step.sourceId, step.right)
  return (
    'const ' + step.id + ' = {\n' +
    '  ...' + step.sourceId + ',\n' +
    '  ' + step.outputKey + ': ' + left + ' ' + step.operator + ' ' + right + '\n' +
    '}'
  )
}

function generateOutputStep(step: OutputStep): string {
  if (step.mappings.length === 0) {
    return 'return ' + step.sourceId
  }
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'return {\n' + pairs + '\n}'
}

export function generateScript(pipeline: Pipeline): string {
  const lines: string[] = []
  for (const step of pipeline.steps) {
    switch (step.type) {
      case 'fetch':  lines.push(generateFetchStep(step));  break
      case 'pick':   lines.push(generatePickStep(step));   break
      case 'rename': lines.push(generateRenameStep(step)); break
      case 'merge':  lines.push(generateMergeStep(step));  break
      case 'math':   lines.push(generateMathStep(step));   break
      case 'output': lines.push(generateOutputStep(step)); break
    }
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test -- --testPathPattern=pipeline
```
Expected: `7 tests passed`

- [ ] **Step 5: Commit**

```
git add server/src/pipeline.ts server/src/__tests__/pipeline.test.ts
git commit -m "feat: add pipeline types and code generator"
```

---

### Task 4: Connector routes and built-in seed

**Files:**
- Create: `server/src/routes/connectors.ts`

- [ ] **Step 1: Install node-cron (needed for Task 5, install now)**

Run from `server/`:
```
npm install node-cron
npm install --save-dev @types/node-cron
```

- [ ] **Step 2: Create connectors route file**

Create `server/src/routes/connectors.ts`:
```typescript
import { Router, Request, Response } from 'express'
import db from '../db'

export const BUILTIN_CONNECTORS = [
  {
    id: 'builtin-open-meteo',
    name: 'Open-Meteo Weather',
    description: 'Free current weather data. No API key required.',
    url_template: 'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true',
    method: 'GET',
    headers_json: '[]',
    body_template: null,
    variables_json: JSON.stringify([
      { name: 'lat', label: 'Latitude', placeholder: 'e.g. 45.5017' },
      { name: 'lon', label: 'Longitude', placeholder: 'e.g. -73.5673' },
    ]),
    is_builtin: 1,
  },
]

export function seedBuiltinConnectors(): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO connectors
      (id, name, description, url_template, method, headers_json, body_template, variables_json, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const c of BUILTIN_CONNECTORS) {
    insert.run(c.id, c.name, c.description, c.url_template, c.method, c.headers_json, c.body_template, c.variables_json, c.is_builtin)
  }
}

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM connectors').all()
  res.json(rows)
})

router.post('/', (req: Request, res: Response) => {
  const { name, description, url_template, method, headers_json, body_template, variables_json } = req.body as {
    name: string
    description?: string
    url_template: string
    method?: string
    headers_json?: string
    body_template?: string
    variables_json?: string
  }
  const id = crypto.randomUUID()
  db.prepare(`
    INSERT INTO connectors (id, name, description, url_template, method, headers_json, body_template, variables_json, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, name, description ?? null, url_template, method ?? 'GET', headers_json ?? '[]', body_template ?? null, variables_json ?? '[]')
  res.json({ id, ok: true })
})

router.put('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT is_builtin FROM connectors WHERE id = ?').get(req.params.id) as { is_builtin: number } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.is_builtin) return res.status(403).json({ error: 'Cannot modify built-in connectors' })

  const { name, description, url_template, method, headers_json, body_template, variables_json } = req.body as {
    name: string; description?: string; url_template: string
    method?: string; headers_json?: string; body_template?: string; variables_json?: string
  }
  db.prepare(`
    UPDATE connectors SET name=?, description=?, url_template=?, method=?, headers_json=?, body_template=?, variables_json=? WHERE id=?
  `).run(name, description ?? null, url_template, method ?? 'GET', headers_json ?? '[]', body_template ?? null, variables_json ?? '[]', req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT is_builtin FROM connectors WHERE id = ?').get(req.params.id) as { is_builtin: number } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.is_builtin) return res.status(403).json({ error: 'Cannot delete built-in connectors' })
  db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
```

- [ ] **Step 3: Commit**

```
git add server/src/routes/connectors.ts server/package.json server/package-lock.json
git commit -m "feat: add connector routes and built-in Open-Meteo connector"
```

---

### Task 5: Data source CRUD routes

**Files:**
- Create: `server/src/routes/sources.ts`

- [ ] **Step 1: Create sources route file**

Create `server/src/routes/sources.ts`:
```typescript
import { Router, Request, Response } from 'express'
import db from '../db'
import { generateScript, resolveConnectorStep } from '../pipeline'
import type { Pipeline, FetchStep, ConnectorRow } from '../pipeline'
import { registerCronJob, stopCronJob } from '../runner'

const router = Router()

function buildScript(pipelineJson: string): string {
  const pipeline = JSON.parse(pipelineJson) as Pipeline
  const resolvedSteps = pipeline.steps.map(step => {
    if (step.type !== 'fetch' || !step.connector_id) return step
    const connector = db.prepare('SELECT id, url_template, method, headers_json, body_template FROM connectors WHERE id = ?')
      .get(step.connector_id) as ConnectorRow | undefined
    if (!connector) return step
    return resolveConnectorStep(step as FetchStep, connector)
  })
  return generateScript({ steps: resolvedSteps })
}

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT id, name, schedule, last_output, last_run_at FROM data_sources').all() as {
    id: string; name: string; schedule: string; last_output: string | null; last_run_at: string | null
  }[]
  res.json(rows.map(r => ({
    ...r,
    last_output: r.last_output ? JSON.parse(r.last_output) : null,
  })))
})

router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(req.params.id) as {
    id: string; name: string; script: string; pipeline_json: string | null
    schedule: string; last_output: string | null; last_run_at: string | null
  } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({
    ...row,
    last_output: row.last_output ? JSON.parse(row.last_output) : null,
  })
})

router.post('/', (req: Request, res: Response) => {
  const { name, script, pipeline_json, schedule } = req.body as {
    name: string; script?: string; pipeline_json?: string; schedule: string
  }
  const id = crypto.randomUUID()
  const resolvedScript = pipeline_json ? buildScript(pipeline_json) : (script ?? '')
  db.prepare('INSERT INTO data_sources (id, name, script, pipeline_json, schedule) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, resolvedScript, pipeline_json ?? null, schedule)
  const source = db.prepare('SELECT id, name, script, schedule FROM data_sources WHERE id = ?').get(id) as {
    id: string; name: string; script: string; schedule: string
  }
  registerCronJob(source)
  res.json({ id, ok: true })
})

router.put('/:id', (req: Request, res: Response) => {
  const { name, script, pipeline_json, schedule } = req.body as {
    name: string; script?: string; pipeline_json?: string; schedule: string
  }
  const existing = db.prepare('SELECT id FROM data_sources WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const resolvedScript = pipeline_json ? buildScript(pipeline_json) : (script ?? '')
  db.prepare('UPDATE data_sources SET name=?, script=?, pipeline_json=?, schedule=? WHERE id=?')
    .run(name, resolvedScript, pipeline_json ?? null, schedule, req.params.id)
  const source = db.prepare('SELECT id, name, script, schedule FROM data_sources WHERE id = ?').get(req.params.id) as {
    id: string; name: string; script: string; schedule: string
  }
  registerCronJob(source)
  res.json({ ok: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT id FROM data_sources WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM data_sources WHERE id = ?').run(req.params.id)
  stopCronJob(req.params.id)
  res.json({ ok: true })
})

router.post('/:id/run', async (req: Request, res: Response) => {
  const row = db.prepare('SELECT id, name, script, schedule FROM data_sources WHERE id = ?').get(req.params.id) as {
    id: string; name: string; script: string; schedule: string
  } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  const { runScript } = await import('../runner')
  await runScript(row)
  const updated = db.prepare('SELECT last_output FROM data_sources WHERE id = ?').get(row.id) as { last_output: string | null }
  res.json({ output: updated.last_output ? JSON.parse(updated.last_output) : null })
})

export default router
```

- [ ] **Step 2: Commit**

```
git add server/src/routes/sources.ts
git commit -m "feat: add data source CRUD routes with pipeline code generation"
```

---

### Task 6: Script runner

**Files:**
- Create: `server/src/runner.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/__tests__/runner.test.ts`:
```typescript
import { runScript } from '../runner'
import Database from 'better-sqlite3'

// Use an in-memory DB for runner tests
jest.mock('../db', () => {
  const db = new (require('better-sqlite3'))(':memory:')
  db.exec(`CREATE TABLE data_sources (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, script TEXT NOT NULL,
    pipeline_json TEXT, schedule TEXT NOT NULL, last_output TEXT, last_run_at TEXT
  )`)
  return { default: db, __esModule: true }
})

describe('runScript', () => {
  beforeEach(() => {
    const db = require('../db').default
    db.prepare('DELETE FROM data_sources').run()
    db.prepare('INSERT INTO data_sources (id, name, script, schedule) VALUES (?, ?, ?, ?)')
      .run('s1', 'Test', '', '*/5 * * * *')
  })

  it('stores output JSON on success', async () => {
    const db = require('../db').default
    const source = { id: 's1', name: 'Test', script: 'return { value: 42 }', schedule: '*/5 * * * *' }
    await runScript(source)
    const row = db.prepare('SELECT last_output FROM data_sources WHERE id = ?').get('s1') as { last_output: string }
    expect(JSON.parse(row.last_output)).toEqual({ value: 42 })
  })

  it('stores error JSON on script failure', async () => {
    const db = require('../db').default
    const source = { id: 's1', name: 'Test', script: 'throw new Error("oops")', schedule: '*/5 * * * *' }
    await runScript(source)
    const row = db.prepare('SELECT last_output FROM data_sources WHERE id = ?').get('s1') as { last_output: string }
    expect(JSON.parse(row.last_output)).toHaveProperty('error')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --testPathPattern=runner
```
Expected: FAIL — `Cannot find module '../runner'`

- [ ] **Step 3: Implement runner.ts**

Create `server/src/runner.ts`:
```typescript
import vm from 'vm'
import cron from 'node-cron'
import db from './db'

export interface DataSource {
  id: string
  name: string
  script: string
  schedule: string
}

const activeJobs = new Map<string, cron.ScheduledTask>()

export async function runScript(source: DataSource): Promise<void> {
  const wrappedScript = `(async () => { ${source.script} })()`
  const sandbox = { fetch, console }

  try {
    const result = await vm.runInNewContext(wrappedScript, sandbox, { timeout: 10000 })
    db.prepare('UPDATE data_sources SET last_output = ?, last_run_at = ? WHERE id = ?')
      .run(JSON.stringify(result), new Date().toISOString(), source.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    db.prepare('UPDATE data_sources SET last_output = ?, last_run_at = ? WHERE id = ?')
      .run(JSON.stringify({ error: message }), new Date().toISOString(), source.id)
  }
}

export function startAllCronJobs(): void {
  const sources = db.prepare('SELECT id, name, script, schedule FROM data_sources').all() as DataSource[]
  for (const source of sources) {
    registerCronJob(source)
  }
}

export function registerCronJob(source: DataSource): void {
  stopCronJob(source.id)
  if (cron.validate(source.schedule)) {
    const task = cron.schedule(source.schedule, () => { runScript(source) })
    activeJobs.set(source.id, task)
  }
}

export function stopCronJob(id: string): void {
  const task = activeJobs.get(id)
  if (task) {
    task.stop()
    activeJobs.delete(id)
  }
}
```

- [ ] **Step 4: Run tests**

```
npm test -- --testPathPattern=runner
```
Expected: `2 tests passed`

- [ ] **Step 5: Commit**

```
git add server/src/runner.ts server/src/__tests__/runner.test.ts
git commit -m "feat: add script runner with vm sandbox and cron scheduling"
```

---

### Task 7: Secrets store

**Files:**
- Create: `server/src/secrets.ts`
- Create: `server/src/routes/secrets.ts`
- Create: `server/src/__tests__/secrets.test.ts`

- [ ] **Step 1: Write failing tests for encrypt/decrypt**

Create `server/src/__tests__/secrets.test.ts`:
```typescript
describe('secrets encryption', () => {
  beforeAll(() => {
    process.env.PAUL_SECRET_KEY = 'test_key_exactly_32_characters!!'
  })

  it('encrypt and decrypt round-trips correctly', () => {
    // Re-require after env var is set
    jest.resetModules()
    const { encryptValue, decryptValue } = require('../secrets')
    const original = 'my-api-key-value'
    const encrypted = encryptValue(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/)
    expect(decryptValue(encrypted)).toBe(original)
  })

  it('produces different ciphertext each time (random IV)', () => {
    jest.resetModules()
    const { encryptValue } = require('../secrets')
    const a = encryptValue('same value')
    const b = encryptValue('same value')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --testPathPattern=secrets
```
Expected: FAIL — `Cannot find module '../secrets'`

- [ ] **Step 3: Implement secrets.ts**

Create `server/src/secrets.ts`:
```typescript
import crypto from 'crypto'

function deriveKey(): Buffer {
  const raw = process.env.PAUL_SECRET_KEY ?? 'insecure_default_do_not_use_in_production'
  return crypto.scryptSync(raw, 'paul_salt', 32) as Buffer
}

export function encryptValue(value: string): string {
  const key = deriveKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptValue(stored: string): string {
  const key = deriveKey()
  const parts = stored.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const ciphertext = Buffer.from(parts[2], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 4: Run tests**

```
npm test -- --testPathPattern=secrets
```
Expected: `2 tests passed`

- [ ] **Step 5: Create secrets routes**

Create `server/src/routes/secrets.ts`:
```typescript
import { Router, Request, Response } from 'express'
import db from '../db'
import { encryptValue, decryptValue } from '../secrets'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key FROM secrets').all() as { key: string }[]
  res.json({ keys: rows.map(r => r.key) })
})

router.post('/', (req: Request, res: Response) => {
  const { key, value } = req.body as { key: string; value: string }
  const existing = db.prepare('SELECT key FROM secrets WHERE key = ?').get(key)
  if (existing) return res.status(409).json({ error: 'Key already exists' })
  db.prepare('INSERT INTO secrets (key, encrypted_value) VALUES (?, ?)').run(key, encryptValue(value))
  res.json({ ok: true })
})

router.delete('/:key', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT key FROM secrets WHERE key = ?').get(req.params.key)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM secrets WHERE key = ?').run(req.params.key)
  res.json({ ok: true })
})

export default router
```

- [ ] **Step 6: Commit**

```
git add server/src/secrets.ts server/src/routes/secrets.ts server/src/__tests__/secrets.test.ts
git commit -m "feat: add AES-256-GCM secrets store with CRUD routes"
```

---

### Task 8: Wire up index.ts

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Replace index.ts**

```typescript
import express, { Request, Response } from 'express'
import cors from 'cors'
import db from './db'
import { startAllCronJobs } from './runner'
import { seedBuiltinConnectors } from './routes/connectors'
import sourcesRouter from './routes/sources'
import connectorsRouter from './routes/connectors'
import secretsRouter from './routes/secrets'
import { decryptValue } from './secrets'

const app = express()

app.use(cors())
app.use(express.json())

// Existing routes
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

app.get('/api/layout', (req: Request, res: Response) => {
  const layoutRow = db.prepare('SELECT layout_json FROM layouts WHERE id = ?').get('main') as { layout_json: string } | undefined
  const widgetRows = db.prepare('SELECT id, type, config_json FROM widgets').all() as { id: string; type: string; config_json: string }[]
  const configs: Record<string, { type: string; config: unknown }> = {}
  for (const row of widgetRows) {
    configs[row.id] = { type: row.type, config: JSON.parse(row.config_json) }
  }
  res.json({ layout: layoutRow ? JSON.parse(layoutRow.layout_json) : null, configs })
})

app.post('/api/layout', (req: Request, res: Response) => {
  const { layout, configs } = req.body as {
    layout: unknown
    configs?: Record<string, { type: string; config: unknown }>
  }
  db.prepare('INSERT OR REPLACE INTO layouts (id, layout_json) VALUES (?, ?)').run('main', JSON.stringify(layout))
  if (configs) {
    const deleteAll = db.prepare('DELETE FROM widgets')
    const insert = db.prepare('INSERT INTO widgets (id, type, config_json) VALUES (?, ?, ?)')
    const saveWidgets = db.transaction((entries: [string, { type: string; config: unknown }][]) => {
      deleteAll.run()
      for (const [id, { type, config }] of entries) {
        insert.run(id, type, JSON.stringify(config))
      }
    })
    saveWidgets(Object.entries(configs))
  }
  res.json({ ok: true })
})

app.get('/api/weather', async (req: Request, res: Response) => {
  const { latitude, longitude, units = 'imperial' } = req.query
  const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius'
  const windUnit = units === 'imperial' ? 'mph' : 'kmh'
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}`
  try {
    const response = await fetch(url)
    const data = await response.json() as { current_weather: { temperature: number; windspeed: number; weathercode: number } }
    res.json({ temperature: data.current_weather.temperature, windspeed: data.current_weather.windspeed, weathercode: data.current_weather.weathercode })
  } catch {
    res.status(500).json({ error: 'Failed to fetch weather data' })
  }
})

// New routes
app.use('/api/sources', sourcesRouter)
app.use('/api/connectors', connectorsRouter)
app.use('/api/secrets', secretsRouter)

// Seed built-ins and start cron jobs
seedBuiltinConnectors()
startAllCronJobs()

app.listen(3001, () => console.log('Server running on port 3001: http://localhost:3001'))
```

- [ ] **Step 2: Update runner.ts to import decryptValue and expose getSecret in sandbox**

In `server/src/runner.ts`, add a top-level import and update `runScript`. Replace the entire file with:
```typescript
import vm from 'vm'
import cron from 'node-cron'
import db from './db'
import { decryptValue } from './secrets'

export interface DataSource {
  id: string
  name: string
  script: string
  schedule: string
}

const activeJobs = new Map<string, cron.ScheduledTask>()

export async function runScript(source: DataSource): Promise<void> {
  const wrappedScript = `(async () => { ${source.script} })()`
  const getSecret = (key: string): string => {
    const row = db.prepare('SELECT encrypted_value FROM secrets WHERE key = ?').get(key) as { encrypted_value: string } | undefined
    if (!row) throw new Error('Secret not found: ' + key)
    return decryptValue(row.encrypted_value)
  }
  const sandbox = { fetch, console, getSecret, Promise }

  try {
    const result = await vm.runInNewContext(wrappedScript, sandbox, { timeout: 10000 })
    db.prepare('UPDATE data_sources SET last_output = ?, last_run_at = ? WHERE id = ?')
      .run(JSON.stringify(result), new Date().toISOString(), source.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    db.prepare('UPDATE data_sources SET last_output = ?, last_run_at = ? WHERE id = ?')
      .run(JSON.stringify({ error: message }), new Date().toISOString(), source.id)
  }
}

export function startAllCronJobs(): void {
  const sources = db.prepare('SELECT id, name, script, schedule FROM data_sources').all() as DataSource[]
  for (const source of sources) {
    registerCronJob(source)
  }
}

export function registerCronJob(source: DataSource): void {
  stopCronJob(source.id)
  if (cron.validate(source.schedule)) {
    const task = cron.schedule(source.schedule, () => { runScript(source) })
    activeJobs.set(source.id, task)
  }
}

export function stopCronJob(id: string): void {
  const task = activeJobs.get(id)
  if (task) {
    task.stop()
    activeJobs.delete(id)
  }
}
```

Also remove the `import { decryptValue } from './secrets'` line from `index.ts` (no longer needed there since it was only used for the removed globalThis hack).

- [ ] **Step 3: Run all tests**

```
npm test
```
Expected: all tests pass

- [ ] **Step 4: Start the server and verify routes respond**

```
npm run dev
```
Then in another terminal:
```
curl http://localhost:3001/health
curl http://localhost:3001/api/sources
curl http://localhost:3001/api/connectors
```
Expected: `{"status":"ok"}`, `[]`, and a JSON array containing the Open-Meteo connector.

- [ ] **Step 5: Commit**

```
git add server/src/index.ts server/src/runner.ts
git commit -m "feat: wire up all routes, seed connectors, start cron jobs"
```

---

### Task 9: Client test infrastructure and resolvePath utility

**Files:**
- Modify: `client/package.json`
- Create: `client/src/utils/resolvePath.ts`
- Create: `client/src/utils/resolvePath.test.ts`

- [ ] **Step 1: Install Vitest**

Run from `client/`:
```
npm install --save-dev vitest
```

In `client/package.json` scripts, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write failing tests for resolvePath**

Create `client/src/utils/resolvePath.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { resolvePath } from './resolvePath'

describe('resolvePath', () => {
  it('resolves a top-level key', () => {
    expect(resolvePath({ a: 1 }, 'a')).toBe(1)
  })

  it('resolves a nested path', () => {
    expect(resolvePath({ weather: { temp: 72 } }, 'weather.temp')).toBe(72)
  })

  it('returns undefined for missing path', () => {
    expect(resolvePath({ a: 1 }, 'b.c')).toBeUndefined()
  })

  it('handles deeply nested paths', () => {
    expect(resolvePath({ a: { b: { c: 'deep' } } }, 'a.b.c')).toBe('deep')
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```
npm test
```
Expected: FAIL — `Cannot find module './resolvePath'`

- [ ] **Step 4: Implement resolvePath**

Create `client/src/utils/resolvePath.ts`:
```typescript
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}
```

- [ ] **Step 5: Run tests**

```
npm test
```
Expected: `4 tests passed`

- [ ] **Step 6: Commit**

```
git add client/package.json client/package-lock.json client/src/utils/resolvePath.ts client/src/utils/resolvePath.test.ts
git commit -m "feat: add resolvePath utility with Vitest setup"
```

---

### Task 10: Script Widget

**Files:**
- Create: `client/src/widgets/ScriptWidget.tsx`
- Modify: `client/src/widgets/index.ts`

- [ ] **Step 1: Create ScriptWidget**

Create `client/src/widgets/ScriptWidget.tsx`:
```tsx
import type { WidgetProps } from './WidgetBase'
import { resolvePath } from '../utils/resolvePath'

export interface ScriptConfig {
  sourceId: string
  displayKey: string
  label: string
}

export function ScriptWidget({ config, data }: WidgetProps<ScriptConfig, Record<string, unknown>>) {
  if (!data) return <div style={{ padding: '8px' }}>Loading...</div>
  if ('error' in data && typeof data.error === 'string') {
    return <div style={{ padding: '8px', color: 'red' }}>{data.error}</div>
  }
  const value = resolvePath(data, config.displayKey)
  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontSize: '12px', color: '#666' }}>{config.label}</div>
      <div style={{ fontSize: '20px', marginTop: '4px' }}>
        {value !== undefined ? String(value) : 'Key not found'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Export from widgets/index.ts**

Replace `client/src/widgets/index.ts` with:
```typescript
export { WidgetProps } from './WidgetBase'
export { PlaceholderWidget } from './PlaceholderWidget'
export { WeatherWidget } from './WeatherWidget'
export type { WeatherConfig, WeatherData } from './WeatherWidget'
export { ScriptWidget } from './ScriptWidget'
export type { ScriptConfig } from './ScriptWidget'
```

- [ ] **Step 3: Commit**

```
git add client/src/widgets/ScriptWidget.tsx client/src/widgets/index.ts
git commit -m "feat: add Script Widget"
```

---

### Task 11: App.tsx — navigation, view routing, Script widget data

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

Replace `client/src/App.tsx` with the following. Key additions: navigation links that write `?view=scripts` and `?view=secrets` to the URL, a view-routing check at the top of the render, and Script widget data fetching alongside weather data.

```tsx
import { useState, useEffect, useRef } from 'react'
import ReactGridLayout, { useContainerWidth, useResponsiveLayout } from 'react-grid-layout'
import type { LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './App.css'
import { PlaceholderWidget, WeatherWidget, ScriptWidget } from './widgets'
import type { WeatherConfig, WeatherData, ScriptConfig } from './widgets'
import WidgetConfigModal from './WidgetConfigModal'
import WeatherConfigForm from './WeatherConfigForm'
import ScriptsView from './views/ScriptsView'
import SecretsView from './views/SecretsView'

type WidgetConfigs = Record<string, { type: string; config: Record<string, unknown> }>

const defaultLayouts = {
  lg: [
    { i: 'placeholder-1', x: 0, y: 0, w: 4, h: 3 },
    { i: 'placeholder-2', x: 4, y: 0, w: 4, h: 3 },
    { i: 'weather-1', x: 8, y: 0, w: 4, h: 3 },
  ],
}

const defaultWidgetConfigs: WidgetConfigs = {
  'placeholder-1': { type: 'placeholder', config: { label: 'Widget 1' } },
  'placeholder-2': { type: 'placeholder', config: { label: 'Widget 2' } },
  'weather-1': { type: 'weather', config: { city: 'Montreal', latitude: 45.5017, longitude: -73.5673, units: 'imperial' } },
}

function App() {
  const apiUrl = import.meta.env.VITE_API_URL as string
  const view = new URLSearchParams(window.location.search).get('view')

  const [weatherDataMap, setWeatherDataMap] = useState<Record<string, WeatherData | { error: true } | null>>({})
  const [scriptDataMap, setScriptDataMap] = useState<Record<string, Record<string, unknown> | null>>({})
  const [initialLayouts, setInitialLayouts] = useState<typeof defaultLayouts | null>(null)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfigs>(defaultWidgetConfigs)
  const [openModalId, setOpenModalId] = useState<string | null>(null)
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({})
  const [showAddPanel, setShowAddPanel] = useState(false)

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widgetConfigsRef = useRef(widgetConfigs)
  widgetConfigsRef.current = widgetConfigs
  const layoutLoadedRef = useRef(false)
  layoutLoadedRef.current = layoutLoaded

  const { width, containerRef, mounted } = useContainerWidth()
  const { layout, layouts, cols, setLayouts, setLayoutForBreakpoint, breakpoint } = useResponsiveLayout({
    width,
    breakpoints: { lg: 1200 },
    cols: { lg: 12 },
    layouts: initialLayouts ?? defaultLayouts,
    onLayoutChange: (_layout, allLayouts) => {
      if (!layoutLoadedRef.current) return
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        fetch(`${apiUrl}/api/layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: allLayouts, configs: widgetConfigsRef.current }),
        })
      }, 1000)
    },
  })

  const weatherKey = Object.entries(widgetConfigs)
    .filter(([, w]) => w.type === 'weather')
    .map(([id, { config }]) => { const c = config as WeatherConfig; return `${id}:${c.latitude}:${c.longitude}:${c.units}` })
    .sort().join('|')

  const scriptKey = Object.entries(widgetConfigs)
    .filter(([, w]) => w.type === 'script')
    .map(([id, { config }]) => `${id}:${(config as ScriptConfig).sourceId}`)
    .sort().join('|')

  useEffect(() => {
    fetch(`${apiUrl}/api/layout`)
      .then(res => res.json())
      .then(data => {
        if (data?.layout?.lg && Array.isArray(data.layout.lg)) {
          setInitialLayouts(data.layout)
          setLayouts(data.layout)
        }
        if (data?.configs && Object.keys(data.configs).length > 0) {
          setWidgetConfigs(data.configs)
        }
      })
      .catch(() => {})
      .finally(() => setLayoutLoaded(true))
  }, [apiUrl])

  useEffect(() => {
    for (const [id, { config }] of Object.entries(widgetConfigsRef.current).filter(([, w]) => w.type === 'weather')) {
      const { latitude, longitude, units } = config as WeatherConfig
      setWeatherDataMap(prev => ({ ...prev, [id]: null }))
      fetch(`${apiUrl}/api/weather?latitude=${latitude}&longitude=${longitude}&units=${units ?? 'metric'}`)
        .then(res => res.json())
        .then(data => setWeatherDataMap(prev => ({ ...prev, [id]: data as WeatherData })))
        .catch(() => setWeatherDataMap(prev => ({ ...prev, [id]: { error: true } })))
    }
  }, [apiUrl, weatherKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    for (const [id, { config }] of Object.entries(widgetConfigsRef.current).filter(([, w]) => w.type === 'script')) {
      const { sourceId } = config as ScriptConfig
      if (!sourceId) continue
      setScriptDataMap(prev => ({ ...prev, [id]: null }))
      fetch(`${apiUrl}/api/sources/${sourceId}`)
        .then(res => res.json())
        .then(data => setScriptDataMap(prev => ({ ...prev, [id]: data.last_output ?? null })))
        .catch(() => setScriptDataMap(prev => ({ ...prev, [id]: { error: 'Failed to load' } })))
    }
  }, [apiUrl, scriptKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGearClick(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenModalId(id)
    setDraftConfig({ ...widgetConfigs[id]?.config })
  }

  function handleConfigSave() {
    if (openModalId === null) return
    const updatedConfigs: WidgetConfigs = { ...widgetConfigs, [openModalId]: { ...widgetConfigs[openModalId]!, config: draftConfig } }
    setWidgetConfigs(updatedConfigs)
    fetch(`${apiUrl}/api/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: layouts, configs: updatedConfigs }) })
    setOpenModalId(null)
  }

  function handleAddWidget(type: 'placeholder' | 'weather' | 'script') {
    const id = crypto.randomUUID()
    const bottomY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    const newItem: LayoutItem = { i: id, x: 0, y: bottomY, w: 4, h: 3 }
    const defaultConfig =
      type === 'weather' ? { city: 'Montreal', latitude: 45.5017, longitude: -73.5673, units: 'metric' } :
      type === 'script'  ? { sourceId: '', displayKey: '', label: 'My Metric' } :
                           { label: 'New Widget' }
    const newLayout = [...layout, newItem]
    setLayoutForBreakpoint(breakpoint, newLayout)
    const updatedConfigs: WidgetConfigs = { ...widgetConfigs, [id]: { type, config: defaultConfig } }
    setWidgetConfigs(updatedConfigs)
    setShowAddPanel(false)
    fetch(`${apiUrl}/api/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: { lg: newLayout }, configs: updatedConfigs }) })
  }

  function handleRemoveWidget(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Remove this widget?')) return
    const newLayout = layout.filter(item => item.i !== id)
    setLayoutForBreakpoint(breakpoint, newLayout)
    const updatedConfigs = { ...widgetConfigs }
    delete updatedConfigs[id]
    setWidgetConfigs(updatedConfigs)
    fetch(`${apiUrl}/api/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: { lg: newLayout }, configs: updatedConfigs }) })
  }

  function renderWidget(id: string, entry: { type: string; config: Record<string, unknown> }) {
    if (entry.type === 'weather') {
      return <WeatherWidget config={entry.config as WeatherConfig} data={weatherDataMap[id] ?? null} />
    }
    if (entry.type === 'script') {
      return <ScriptWidget config={entry.config as ScriptConfig} data={scriptDataMap[id] ?? null} />
    }
    return <PlaceholderWidget config={entry.config as { label: string }} data={{}} />
  }

  if (view === 'scripts') return <ScriptsView apiUrl={apiUrl} />
  if (view === 'secrets') return <SecretsView apiUrl={apiUrl} />

  return (
    <div className="app">
      <header className="app-header">
        <h1>Paul</h1>
        <nav className="app-nav">
          <a href="?">Dashboard</a>
          <a href="?view=scripts">Scripts</a>
          <a href="?view=secrets">Secrets</a>
        </nav>
        <div className="add-widget-wrap">
          <button className="add-widget-btn" onClick={() => setShowAddPanel(p => !p)}>+ Add Widget</button>
          {showAddPanel && (
            <div className="add-widget-panel">
              <button onClick={() => handleAddWidget('placeholder')}>Placeholder</button>
              <button onClick={() => handleAddWidget('weather')}>Weather</button>
              <button onClick={() => handleAddWidget('script')}>Script</button>
            </div>
          )}
        </div>
      </header>
      <main ref={containerRef}>
        {mounted && layoutLoaded && (
          <ReactGridLayout
            width={width} layout={layout}
            gridConfig={{ cols, rowHeight: 100 }}
            onLayoutChange={(newLayout) => setLayoutForBreakpoint(breakpoint, newLayout)}
            dragConfig={{ cancel: '.widget-gear, .widget-remove' }}
          >
            {layout.filter(item => item.i in widgetConfigs).map(item => {
              const entry = widgetConfigs[item.i]!
              return (
                <div key={item.i} className="widget" data-widget-id={item.i}>
                  {renderWidget(item.i, entry)}
                  <button className="widget-gear" onClick={e => handleGearClick(item.i, e)} onMouseDown={e => e.stopPropagation()}>⚙</button>
                  <button className="widget-remove" onClick={e => handleRemoveWidget(item.i, e)} onMouseDown={e => e.stopPropagation()}>×</button>
                </div>
              )
            })}
          </ReactGridLayout>
        )}
      </main>
      {openModalId !== null && (
        <WidgetConfigModal isOpen={true} onClose={() => setOpenModalId(null)} onSave={handleConfigSave} title={`Configure ${widgetConfigs[openModalId]?.type ?? 'widget'}`}>
          {widgetConfigs[openModalId]?.type === 'weather' ? (
            <WeatherConfigForm config={draftConfig} onChange={setDraftConfig} />
          ) : widgetConfigs[openModalId]?.type === 'script' ? (
            <div className="config-form">
              <label>Source ID<input value={String(draftConfig.sourceId ?? '')} onChange={e => setDraftConfig(c => ({ ...c, sourceId: e.target.value }))} /></label>
              <label>Display Key<input value={String(draftConfig.displayKey ?? '')} onChange={e => setDraftConfig(c => ({ ...c, displayKey: e.target.value }))} placeholder="e.g. weather.temp" /></label>
              <label>Label<input value={String(draftConfig.label ?? '')} onChange={e => setDraftConfig(c => ({ ...c, label: e.target.value }))} /></label>
            </div>
          ) : (
            <div className="config-form">
              <label>Label<input value={String(draftConfig.label ?? '')} onChange={e => setDraftConfig(c => ({ ...c, label: e.target.value }))} /></label>
            </div>
          )}
        </WidgetConfigModal>
      )}
    </div>
  )
}

export default App
```

- [ ] **Step 2: Add nav styles to App.css**

In `client/src/App.css`, add:
```css
.app-nav {
  display: flex;
  gap: 16px;
}

.app-nav a {
  color: inherit;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 4px;
}

.app-nav a:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 3: Commit**

```
git add client/src/App.tsx client/src/App.css
git commit -m "feat: add navigation, view routing, Script widget data fetching"
```

---

### Task 12: SecretsView

**Files:**
- Create: `client/src/views/SecretsView.tsx`

- [ ] **Step 1: Create SecretsView**

Create `client/src/views/SecretsView.tsx`:
```tsx
import { useState, useEffect } from 'react'

interface Props {
  apiUrl: string
}

export default function SecretsView({ apiUrl }: Props) {
  const [keys, setKeys] = useState<string[]>([])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function loadKeys() {
    fetch(`${apiUrl}/api/secrets`)
      .then(r => r.json())
      .then(data => setKeys((data as { keys: string[] }).keys))
      .catch(() => {})
  }

  useEffect(() => { loadKeys() }, [apiUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!newKey.trim() || !newValue.trim()) return
    const res = await fetch(`${apiUrl}/api/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey.trim(), value: newValue.trim() }),
    })
    if (res.status === 409) { setError('Key already exists'); return }
    setError(null)
    setNewKey('')
    setNewValue('')
    loadKeys()
  }

  async function handleDelete(key: string) {
    if (!window.confirm(`Delete secret "${key}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/secrets/${encodeURIComponent(key)}`, { method: 'DELETE' })
    loadKeys()
  }

  return (
    <div className="view">
      <header className="app-header">
        <h1>Paul</h1>
        <nav className="app-nav">
          <a href="?">Dashboard</a>
          <a href="?view=scripts">Scripts</a>
          <a href="?view=secrets">Secrets</a>
        </nav>
      </header>
      <main style={{ padding: '24px' }}>
        <h2>Secrets</h2>
        <div className="config-form" style={{ maxWidth: '400px', marginBottom: '24px' }}>
          <label>Key<input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="MY_API_KEY" /></label>
          <label>Value<input type="password" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="secret value" /></label>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button onClick={handleAdd}>Add Secret</button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {keys.map(k => (
            <li key={k} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <code>{k}</code>
              <button onClick={() => handleDelete(k)}>Delete</button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add client/src/views/SecretsView.tsx
git commit -m "feat: add SecretsView"
```

---

### Task 13: ScriptsView (code mode)

**Files:**
- Create: `client/src/views/ScriptsView.tsx`

- [ ] **Step 1: Install Monaco Editor**

Run from `client/`:
```
npm install @monaco-editor/react
```

- [ ] **Step 2: Create ScriptsView**

Create `client/src/views/ScriptsView.tsx`:
```tsx
import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'

interface Source {
  id: string
  name: string
  schedule: string
  last_run_at: string | null
  last_output: unknown
  script?: string
  pipeline_json?: string | null
}

interface Props {
  apiUrl: string
}

type ActiveTab = 'sources' | 'connectors'

export default function ScriptsView({ apiUrl }: Props) {
  const [tab, setTab] = useState<ActiveTab>('sources')
  const [sources, setSources] = useState<Source[]>([])
  const [selected, setSelected] = useState<Source | null>(null)
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('*/5 * * * *')
  const [code, setCode] = useState('')
  const [output, setOutput] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)

  function loadSources() {
    fetch(`${apiUrl}/api/sources`).then(r => r.json()).then(setSources).catch(() => {})
  }

  useEffect(() => { loadSources() }, [apiUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectSource(s: Source) {
    fetch(`${apiUrl}/api/sources/${s.id}`)
      .then(r => r.json())
      .then((full: Source) => {
        setSelected(full)
        setName(full.name)
        setSchedule(full.schedule)
        setCode(full.script ?? '')
        setOutput(full.last_output ?? null)
      })
  }

  async function handleNew() {
    setShowModeModal(true)
  }

  async function createSource(mode: 'code' | 'pipeline') {
    setShowModeModal(false)
    if (mode === 'pipeline') {
      // Pipeline mode: redirect to pipeline builder with a new blank source
      const res = await fetch(`${apiUrl}/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled', script: '', schedule: '*/5 * * * *', pipeline_json: JSON.stringify({ steps: [] }) }),
      })
      const data = await res.json() as { id: string }
      window.location.search = `?view=pipeline&id=${data.id}`
      return
    }
    const res = await fetch(`${apiUrl}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled', script: 'return { value: 42 }', schedule: '*/5 * * * *' }),
    })
    const data = await res.json() as { id: string }
    loadSources()
    fetch(`${apiUrl}/api/sources/${data.id}`).then(r => r.json()).then(selectSource)
  }

  async function handleSave() {
    if (!selected) return
    await fetch(`${apiUrl}/api/sources/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, script: code, schedule }),
    })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
    loadSources()
  }

  async function handleRun() {
    if (!selected) return
    setRunning(true)
    const res = await fetch(`${apiUrl}/api/sources/${selected.id}/run`, { method: 'POST' })
    const data = await res.json() as { output: unknown }
    setOutput(data.output)
    setRunning(false)
  }

  async function handleDelete() {
    if (!selected) return
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/sources/${selected.id}`, { method: 'DELETE' })
    setSelected(null)
    loadSources()
  }

  return (
    <div className="view">
      <header className="app-header">
        <h1>Paul</h1>
        <nav className="app-nav">
          <a href="?">Dashboard</a>
          <a href="?view=scripts">Scripts</a>
          <a href="?view=secrets">Secrets</a>
        </nav>
      </header>
      <main style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        <aside style={{ width: '240px', borderRight: '1px solid #333', padding: '12px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={() => setTab('sources')} style={{ fontWeight: tab === 'sources' ? 'bold' : 'normal' }}>Sources</button>
            <button onClick={() => setTab('connectors')} style={{ fontWeight: tab === 'connectors' ? 'bold' : 'normal' }}>Connectors</button>
          </div>
          {tab === 'sources' && (
            <>
              <button onClick={handleNew} style={{ width: '100%', marginBottom: '8px' }}>+ New Script</button>
              {sources.map(s => (
                <div key={s.id} onClick={() => selectSource(s)} style={{ padding: '8px', cursor: 'pointer', background: selected?.id === s.id ? '#333' : 'transparent', borderRadius: '4px', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{s.schedule}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never run'}
                  </div>
                </div>
              ))}
            </>
          )}
          {tab === 'connectors' && (
            <div style={{ color: '#888', fontSize: '13px' }}>Connectors view — see Task 14</div>
          )}
        </aside>

        {selected ? (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            {selected.pipeline_json ? (
              <div style={{ color: '#888', padding: '24px', textAlign: 'center' }}>
                This source uses the pipeline builder.{' '}
                <a href={`?view=pipeline&id=${selected.id}`} style={{ color: '#4af' }}>Open Pipeline Builder</a>
              </div>
            ) : (
              <>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  Name<input value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
                </label>
                <label style={{ display: 'block', marginBottom: '12px' }}>
                  Schedule (cron)<input value={schedule} onChange={e => setSchedule(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
                </label>
                <Editor height="300px" language="javascript" theme="vs-dark" value={code} onChange={v => setCode(v ?? '')} />
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={handleRun} disabled={running}>{running ? 'Running...' : 'Run Now'}</button>
                  <button onClick={handleSave}>Save</button>
                  {savedMsg && <span style={{ color: '#4a4' }}>Saved</span>}
                  <button onClick={handleDelete} style={{ marginLeft: 'auto', color: '#f44' }}>Delete</button>
                </div>
                {output !== null && (
                  <pre style={{ marginTop: '12px', background: '#1a1a1a', padding: '12px', borderRadius: '4px', color: 'error' in (output as object) ? '#f44' : 'inherit' }}>
                    {JSON.stringify(output, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            Select a source or create a new one
          </div>
        )}
      </main>

      {showModeModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModeModal(false) }}>
          <div className="modal">
            <h2 className="modal-title">Create new data source</h2>
            <div className="modal-body" style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => createSource('pipeline')} style={{ flex: 1, padding: '16px' }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>Build a pipeline</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Visual step-by-step builder. No code required.</div>
              </button>
              <button onClick={() => createSource('code')} style={{ flex: 1, padding: '16px' }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>Write code</div>
                <div style={{ fontSize: '12px', color: '#888' }}>JavaScript editor with full control.</div>
              </button>
            </div>
            <div className="modal-footer">
              <button className="modal-btn" onClick={() => setShowModeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```
git add client/src/views/ScriptsView.tsx client/package.json client/package-lock.json
git commit -m "feat: add ScriptsView with code mode editor and mode picker modal"
```

---

### Task 14: PipelineBuilderView

**Files:**
- Create: `client/src/views/PipelineBuilderView.tsx`

This view is accessed via `?view=pipeline&id=<sourceId>`. It renders the step list and inline step forms for each step type.

- [ ] **Step 1: Update App.tsx to handle pipeline view**

In `client/src/App.tsx`, add `?view=pipeline` routing. Near the top of the render, add:

```tsx
const sourceId = new URLSearchParams(window.location.search).get('id')
// existing: if (view === 'scripts') return <ScriptsView apiUrl={apiUrl} />
// existing: if (view === 'secrets') return <SecretsView apiUrl={apiUrl} />
if (view === 'pipeline' && sourceId) return <PipelineBuilderView apiUrl={apiUrl} sourceId={sourceId} />
```

And add the import:
```tsx
import PipelineBuilderView from './views/PipelineBuilderView'
```

- [ ] **Step 2: Create PipelineBuilderView**

Create `client/src/views/PipelineBuilderView.tsx`:
```tsx
import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'

interface Variable { name: string; label: string; placeholder: string }
interface Connector {
  id: string; name: string; description: string | null
  url_template: string; method: string; headers_json: string
  body_template: string | null; variables_json: string; is_builtin: number
}

interface StepBase { id: string; label: string }
interface FetchStepData extends StepBase {
  type: 'fetch'
  connector_id: string | null
  url: string | null; method: string | null
  headers: { key: string; value: string }[]
  body: string | null
  auth: { type: 'bearer' | 'apikey'; secret: string } | null
  variables: Record<string, string>
}
interface PickStepData extends StepBase { type: 'pick'; sourceId: string; fields: string[] }
interface RenameStepData extends StepBase { type: 'rename'; sourceId: string; mappings: { from: string; to: string }[] }
interface MergeStepData extends StepBase { type: 'merge'; sources: { stepId: string; as: string }[] }
interface MathStepData extends StepBase { type: 'math'; sourceId: string; left: string; operator: string; right: string; outputKey: string }
interface OutputStepData extends StepBase { type: 'output'; sourceId: string; mappings: { from: string; to: string }[] }
type AnyStep = FetchStepData | PickStepData | RenameStepData | MergeStepData | MathStepData | OutputStepData

interface Props { apiUrl: string; sourceId: string }

function newStep(type: AnyStep['type'], id: string, fetchSteps: string[]): AnyStep {
  const src = fetchSteps[0] ?? ''
  switch (type) {
    case 'fetch':  return { type, id, label: 'Fetch', connector_id: null, url: '', method: 'GET', headers: [], body: null, auth: null, variables: {} }
    case 'pick':   return { type, id, label: 'Pick Fields', sourceId: src, fields: [] }
    case 'rename': return { type, id, label: 'Rename', sourceId: src, mappings: [] }
    case 'merge':  return { type, id, label: 'Merge', sources: [{ stepId: src, as: 'a' }, { stepId: src, as: 'b' }] }
    case 'math':   return { type, id, label: 'Math', sourceId: src, left: '', operator: '+', right: '', outputKey: 'result' }
    case 'output': return { type, id, label: 'Output', sourceId: src, mappings: [] }
  }
}

export default function PipelineBuilderView({ apiUrl, sourceId }: Props) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('*/5 * * * *')
  const [steps, setSteps] = useState<AnyStep[]>([])
  const [generatedScript, setGeneratedScript] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [showConnectorPicker, setShowConnectorPicker] = useState(false)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [output, setOutput] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    fetch(`${apiUrl}/api/sources/${sourceId}`).then(r => r.json()).then((data: { name: string; schedule: string; script: string; pipeline_json: string | null }) => {
      setName(data.name)
      setSchedule(data.schedule)
      setGeneratedScript(data.script)
      if (data.pipeline_json) setSteps((JSON.parse(data.pipeline_json) as { steps: AnyStep[] }).steps)
    })
    fetch(`${apiUrl}/api/connectors`).then(r => r.json()).then(setConnectors)
  }, [apiUrl, sourceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateStep(id: string, patch: Partial<AnyStep>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } as AnyStep : s))
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setSteps(prev => {
      const arr = [...prev]
      const tmp = arr[idx]
      arr[idx] = arr[idx + dir]
      arr[idx + dir] = tmp
      return arr
    })
  }

  async function handleSave() {
    const pipeline_json = JSON.stringify({ steps })
    const res = await fetch(`${apiUrl}/api/sources/${sourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, schedule, pipeline_json }),
    })
    if (res.ok) {
      const updated = await fetch(`${apiUrl}/api/sources/${sourceId}`).then(r => r.json()) as { script: string }
      setGeneratedScript(updated.script)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    }
  }

  async function handleRun() {
    setRunning(true)
    const res = await fetch(`${apiUrl}/api/sources/${sourceId}/run`, { method: 'POST' })
    const data = await res.json() as { output: unknown }
    setOutput(data.output)
    setRunning(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/sources/${sourceId}`, { method: 'DELETE' })
    window.location.search = '?view=scripts'
  }

  async function handleSwitchToCode() {
    if (!window.confirm('This will replace the pipeline with the generated code. You won\'t be able to switch back.')) return
    await fetch(`${apiUrl}/api/sources/${sourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, schedule, script: generatedScript }),
    })
    window.location.search = '?view=scripts'
  }

  function addStep(type: AnyStep['type'], connectorId?: string) {
    const id = 'step_' + crypto.randomUUID().slice(0, 8)
    const fetchStepIds = steps.filter(s => s.type === 'fetch').map(s => s.id)
    const step = newStep(type, id, fetchStepIds)
    if (type === 'fetch' && connectorId) {
      const connector = connectors.find(c => c.id === connectorId)
      if (connector) {
        const variables: Record<string, string> = {}
        const vars = JSON.parse(connector.variables_json) as Variable[]
        vars.forEach(v => { variables[v.name] = '' })
        ;(step as FetchStepData).connector_id = connectorId
        ;(step as FetchStepData).variables = variables
        ;(step as FetchStepData).label = connector.name
      }
    }
    setSteps(prev => [...prev, step])
    setExpandedId(id)
    setShowAddPicker(false)
    setShowConnectorPicker(false)
  }

  function renderStepForm(step: AnyStep) {
    const fetchStepIds = steps.filter(s => s.type === 'fetch').map(s => s.id)
    switch (step.type) {
      case 'fetch': {
        const connector = step.connector_id ? connectors.find(c => c.id === step.connector_id) : null
        const vars: Variable[] = connector ? JSON.parse(connector.variables_json) : []
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {connector ? (
              <>
                <div style={{ color: '#888', fontSize: '12px' }}>Using connector: <strong>{connector.name}</strong></div>
                {vars.map(v => (
                  <label key={v.name}>{v.label}
                    <input value={step.variables[v.name] ?? ''} placeholder={v.placeholder}
                      onChange={e => updateStep(step.id, { variables: { ...step.variables, [v.name]: e.target.value } } as Partial<FetchStepData>)} />
                  </label>
                ))}
              </>
            ) : (
              <>
                <label>URL<input value={step.url ?? ''} onChange={e => updateStep(step.id, { url: e.target.value } as Partial<FetchStepData>)} placeholder="https://api.example.com/data" /></label>
                <label>Method
                  <select value={step.method ?? 'GET'} onChange={e => updateStep(step.id, { method: e.target.value } as Partial<FetchStepData>)}>
                    <option>GET</option><option>POST</option>
                  </select>
                </label>
                {step.method === 'POST' && (
                  <label>Body (JSON)<textarea value={step.body ?? ''} onChange={e => updateStep(step.id, { body: e.target.value } as Partial<FetchStepData>)} rows={3} /></label>
                )}
              </>
            )}
            <label>Auth
              <select value={step.auth?.type ?? ''} onChange={e => {
                const t = e.target.value as '' | 'bearer' | 'apikey'
                updateStep(step.id, { auth: t ? { type: t, secret: step.auth?.secret ?? '' } : null } as Partial<FetchStepData>)
              }}>
                <option value="">None</option>
                <option value="bearer">Bearer Token (from Secret)</option>
                <option value="apikey">API Key Header (from Secret)</option>
              </select>
            </label>
            {step.auth && (
              <label>Secret Key
                <input value={step.auth.secret} placeholder="e.g. MY_API_KEY"
                  onChange={e => updateStep(step.id, { auth: { ...step.auth!, secret: e.target.value } } as Partial<FetchStepData>)} />
              </label>
            )}
          </div>
        )
      }
      case 'pick':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<PickStepData>)}>
              {fetchStepIds.map(id => <option key={id} value={id}>{steps.find(s => s.id === id)?.label ?? id}</option>)}
            </select></label>
            <label>Fields (dot-notation, one per line)
              <textarea value={step.fields.join('\n')} rows={4}
                onChange={e => updateStep(step.id, { fields: e.target.value.split('\n').filter(Boolean) } as Partial<PickStepData>)} />
            </label>
          </div>
        )
      case 'rename':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<RenameStepData>)}>
              {steps.filter(s => s.id !== step.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
            {step.mappings.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                <input value={m.from} placeholder="old key" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, from: e.target.value }
                  updateStep(step.id, { mappings } as Partial<RenameStepData>)
                }} />
                <span>→</span>
                <input value={m.to} placeholder="new name" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, to: e.target.value }
                  updateStep(step.id, { mappings } as Partial<RenameStepData>)
                }} />
              </div>
            ))}
            <button onClick={() => updateStep(step.id, { mappings: [...step.mappings, { from: '', to: '' }] } as Partial<RenameStepData>)}>+ Add mapping</button>
          </div>
        )
      case 'merge':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {step.sources.map((src, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={src.stepId} onChange={e => {
                  const sources = [...step.sources]; sources[i] = { ...src, stepId: e.target.value }
                  updateStep(step.id, { sources } as Partial<MergeStepData>)
                }}>
                  {fetchStepIds.map(id => <option key={id} value={id}>{steps.find(s => s.id === id)?.label ?? id}</option>)}
                </select>
                <span>as</span>
                <input value={src.as} placeholder="namespace" onChange={e => {
                  const sources = [...step.sources]; sources[i] = { ...src, as: e.target.value }
                  updateStep(step.id, { sources } as Partial<MergeStepData>)
                }} />
              </div>
            ))}
          </div>
        )
      case 'math':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<MathStepData>)}>
              {steps.filter(s => s.id !== step.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={step.left} placeholder="field or number" onChange={e => updateStep(step.id, { left: e.target.value } as Partial<MathStepData>)} />
              <select value={step.operator} onChange={e => updateStep(step.id, { operator: e.target.value } as Partial<MathStepData>)}>
                {['+', '-', '*', '/', '%'].map(op => <option key={op}>{op}</option>)}
              </select>
              <input value={step.right} placeholder="field or number" onChange={e => updateStep(step.id, { right: e.target.value } as Partial<MathStepData>)} />
            </div>
            <label>Output key<input value={step.outputKey} onChange={e => updateStep(step.id, { outputKey: e.target.value } as Partial<MathStepData>)} /></label>
          </div>
        )
      case 'output':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<OutputStepData>)}>
              {steps.filter(s => s.id !== step.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
            {step.mappings.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                <input value={m.from} placeholder="field path (e.g. weather.temp)" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, from: e.target.value }
                  updateStep(step.id, { mappings } as Partial<OutputStepData>)
                }} />
                <span>→</span>
                <input value={m.to} placeholder="output key" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, to: e.target.value }
                  updateStep(step.id, { mappings } as Partial<OutputStepData>)
                }} />
              </div>
            ))}
            <button onClick={() => updateStep(step.id, { mappings: [...step.mappings, { from: '', to: '' }] } as Partial<OutputStepData>)}>+ Add output field</button>
          </div>
        )
    }
  }

  return (
    <div className="view">
      <header className="app-header">
        <h1>Paul</h1>
        <nav className="app-nav">
          <a href="?">Dashboard</a>
          <a href="?view=scripts">Scripts</a>
          <a href="?view=secrets">Secrets</a>
        </nav>
      </header>
      <main style={{ padding: '24px', maxWidth: '720px' }}>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          Name<input value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
        </label>
        <label style={{ display: 'block', marginBottom: '16px' }}>
          Schedule (cron)<input value={schedule} onChange={e => setSchedule(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
        </label>

        <div style={{ marginBottom: '16px' }}>
          {steps.map((step, idx) => (
            <div key={step.id} style={{ border: '1px solid #333', borderRadius: '4px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', gap: '8px' }}
                onClick={() => setExpandedId(expandedId === step.id ? null : step.id)}>
                <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>{step.type}</span>
                <input value={step.label} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '14px' }}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateStep(step.id, { label: e.target.value })} />
                <button onClick={e => { e.stopPropagation(); moveStep(idx, -1) }} disabled={idx === 0}>↑</button>
                <button onClick={e => { e.stopPropagation(); moveStep(idx, 1) }} disabled={idx === steps.length - 1}>↓</button>
                <button onClick={e => { e.stopPropagation(); setSteps(prev => prev.filter(s => s.id !== step.id)) }}>×</button>
              </div>
              {expandedId === step.id && renderStepForm(step)}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <button onClick={() => setShowAddPicker(p => !p)}>+ Add Step</button>
          {showAddPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: '#222', border: '1px solid #444', borderRadius: '4px', padding: '8px', zIndex: 10, minWidth: '200px' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px', padding: '4px 8px' }}>Step type</div>
              {(['pick', 'rename', 'merge', 'math', 'output'] as const).map(type => (
                <button key={type} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                  onClick={() => addStep(type)}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>
              ))}
              <div style={{ borderTop: '1px solid #444', marginTop: '8px', paddingTop: '8px', fontWeight: 500, padding: '4px 8px' }}>Fetch</div>
              {connectors.map(c => (
                <button key={c.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                  onClick={() => addStep('fetch', c.id)}>{c.name}</button>
              ))}
              <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                onClick={() => addStep('fetch')}>Custom HTTP Request</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <button onClick={handleRun} disabled={running}>{running ? 'Running...' : 'Run Now'}</button>
          <button onClick={handleSave}>Save</button>
          {savedMsg && <span style={{ color: '#4a4' }}>Saved</span>}
          <button onClick={() => setShowCode(p => !p)}>View Generated Code</button>
          <button onClick={handleDelete} style={{ marginLeft: 'auto', color: '#f44' }}>Delete</button>
        </div>

        {output !== null && (
          <pre style={{ background: '#1a1a1a', padding: '12px', borderRadius: '4px', color: typeof output === 'object' && output !== null && 'error' in output ? '#f44' : 'inherit', marginBottom: '12px' }}>
            {JSON.stringify(output, null, 2)}
          </pre>
        )}

        {showCode && (
          <div style={{ border: '1px solid #333', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
              <button onClick={handleSwitchToCode} style={{ color: '#fa0' }}>Switch to Code Mode</button>
            </div>
            <Editor height="300px" language="javascript" theme="vs-dark" value={generatedScript} options={{ readOnly: true }} />
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```
git add client/src/views/PipelineBuilderView.tsx client/src/App.tsx
git commit -m "feat: add PipelineBuilderView with step-based pipeline authoring"
```

---

### Task 15: ConnectorsView

**Files:**
- Modify: `client/src/views/ScriptsView.tsx` (replace the connectors tab placeholder)
- Create: `client/src/views/ConnectorsView.tsx`

- [ ] **Step 1: Create ConnectorsView**

Create `client/src/views/ConnectorsView.tsx`:
```tsx
import { useState, useEffect } from 'react'

interface Variable { name: string; label: string; placeholder: string }
interface Connector {
  id: string; name: string; description: string | null
  url_template: string; method: string; headers_json: string
  body_template: string | null; variables_json: string; is_builtin: number
}

interface Props { apiUrl: string }

const emptyForm = { name: '', description: '', url_template: '', method: 'GET', headers_json: '[]', body_template: '', variables_json: '[]' }

export default function ConnectorsView({ apiUrl }: Props) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [editing, setEditing] = useState<Connector | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [rawVars, setRawVars] = useState('')

  function loadConnectors() {
    fetch(`${apiUrl}/api/connectors`).then(r => r.json()).then(setConnectors).catch(() => {})
  }

  useEffect(() => { loadConnectors() }, [apiUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(c: Connector) {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '', url_template: c.url_template, method: c.method, headers_json: c.headers_json, body_template: c.body_template ?? '', variables_json: c.variables_json })
    const vars = JSON.parse(c.variables_json) as Variable[]
    setRawVars(vars.map(v => `${v.name}|${v.label}|${v.placeholder}`).join('\n'))
  }

  function startNew() {
    setEditing({ id: '', name: '', description: null, url_template: '', method: 'GET', headers_json: '[]', body_template: null, variables_json: '[]', is_builtin: 0 })
    setForm(emptyForm)
    setRawVars('')
  }

  async function handleSave() {
    if (!editing) return
    const vars: Variable[] = rawVars.split('\n').filter(Boolean).map(line => {
      const [name, label, placeholder] = line.split('|')
      return { name: name?.trim() ?? '', label: label?.trim() ?? '', placeholder: placeholder?.trim() ?? '' }
    })
    const body = { ...form, variables_json: JSON.stringify(vars), body_template: form.body_template || null }
    if (editing.id) {
      await fetch(`${apiUrl}/api/connectors/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch(`${apiUrl}/api/connectors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setEditing(null)
    loadConnectors()
  }

  async function handleDelete(c: Connector) {
    if (!window.confirm(`Delete connector "${c.name}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/connectors/${c.id}`, { method: 'DELETE' })
    loadConnectors()
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ width: '240px', borderRight: '1px solid #333', padding: '12px', overflowY: 'auto' }}>
        <button onClick={startNew} style={{ width: '100%', marginBottom: '8px' }}>+ New Connector</button>
        {connectors.map(c => (
          <div key={c.id} onClick={() => !c.is_builtin && startEdit(c)}
            style={{ padding: '8px', borderRadius: '4px', marginBottom: '4px', background: editing?.id === c.id ? '#333' : 'transparent', opacity: c.is_builtin ? 0.5 : 1, cursor: c.is_builtin ? 'default' : 'pointer' }}>
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            {c.is_builtin ? <div style={{ fontSize: '11px', color: '#888' }}>Built-in</div> : null}
          </div>
        ))}
      </aside>

      {editing !== null && !editing.is_builtin ? (
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '560px' }}>
          <label>Name<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
          <label>Description<input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
          <label>Method<select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}><option>GET</option><option>POST</option></select></label>
          <label>URL template<input value={form.url_template} placeholder="https://api.example.com/{endpoint}" onChange={e => setForm(f => ({ ...f, url_template: e.target.value }))} /></label>
          <label>Body template (POST only)<textarea value={form.body_template} rows={3} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} /></label>
          <label>
            Variables (one per line: <code>name|Label|placeholder</code>)
            <textarea value={rawVars} rows={4} placeholder={'lat|Latitude|e.g. 45.5017\nlon|Longitude|e.g. -73.5673'} onChange={e => setRawVars(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
            {editing.id && <button onClick={() => handleDelete(editing)} style={{ marginLeft: 'auto', color: '#f44' }}>Delete</button>}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          Select a connector to edit or create a new one
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire ConnectorsView into ScriptsView**

In `client/src/views/ScriptsView.tsx`, replace the connectors tab placeholder:

Find:
```tsx
{tab === 'connectors' && (
  <div style={{ color: '#888', fontSize: '13px' }}>Connectors view — see Task 14</div>
)}
```

Replace with:
```tsx
{tab === 'connectors' && null}
```

And replace the `{selected ? (...) : (...)}` main content block to also render `ConnectorsView` when the connectors tab is active. At the top of `ScriptsView`, add:

```tsx
import ConnectorsView from './ConnectorsView'
```

Wrap the main content section:
```tsx
{tab === 'connectors' ? (
  <ConnectorsView apiUrl={apiUrl} />
) : selected ? (
  // ... existing editor content
) : (
  // ... existing empty state
)}
```

- [ ] **Step 3: Run all tests**

```
cd server && npm test
cd ../client && npm test
```
Expected: all tests pass

- [ ] **Step 4: Commit**

```
git add client/src/views/ConnectorsView.tsx client/src/views/ScriptsView.tsx
git commit -m "feat: add ConnectorsView for managing reusable HTTP connector templates"
```

---

### Task 16: End-to-end verification

- [ ] **Step 1: Start the full stack**

```
docker compose up --build
```

- [ ] **Step 2: Verify the dashboard loads**

Open `http://localhost:5173`. Confirm: dashboard renders with existing widgets, nav shows Dashboard / Scripts / Secrets links.

- [ ] **Step 3: Verify code-mode data source**

1. Click Scripts → New Script → Write code
2. Name it "Test", leave schedule as `*/5 * * * *`
3. Replace the script body with `return { answer: 42 }`
4. Click Run Now
5. Confirm output shows `{ "answer": 42 }`
6. Click Save → confirm "Saved" appears

- [ ] **Step 4: Verify pipeline-mode data source**

1. Click Scripts → New Script → Build a pipeline
2. Click "+ Add Step" → select "Open-Meteo Weather"
3. Fill in Latitude: `45.5017`, Longitude: `-73.5673`
4. Click "+ Add Step" → Output → add mapping: `from: current_weather.temperature`, `to: temp`
5. Click Save, then Run Now
6. Confirm output shows a temperature value

- [ ] **Step 5: Verify View Generated Code**

After saving the pipeline source, click "View Generated Code". Confirm a readable JavaScript script appears in the read-only Monaco editor.

- [ ] **Step 6: Verify Script Widget on dashboard**

1. Go to Dashboard → Add Widget → Script
2. Open the gear icon on the new Script widget
3. Set Source ID to the pipeline source's ID (copy from the URL `?view=pipeline&id=...`)
4. Set Display Key to `temp`, Label to `Temperature`
5. Click Save
6. Confirm the widget shows a temperature value

- [ ] **Step 7: Verify secrets store**

1. Click Secrets → add key `TEST_KEY`, value `hello`
2. Confirm the key appears in the list
3. Click Delete → confirm it disappears

- [ ] **Step 8: Final commit**

```
git add -A
git commit -m "chore: end-to-end verification complete"
```
