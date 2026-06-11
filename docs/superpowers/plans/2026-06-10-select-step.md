# Select Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `select` pipeline step that extracts a single element from a list by index, outputting the whole element for downstream Pick steps to further process.

**Architecture:** The step follows the established pattern — a server-side type + generator + test, then client-side type + form + wiring in the builder. The generator produces `const <id> = <sourceId>[<index>]`. Source is restricted to fetch steps only (same as Pick).

**Tech Stack:** TypeScript, Jest (server tests), React (client form), no additional dependencies.

---

### Task 1: Add `SelectStep` server type

**Files:**
- Modify: `server/src/pipeline/types.ts`

- [ ] **Step 1: Add the `SelectStep` interface and update the union**

In `server/src/pipeline/types.ts`, add after the `OutputStep` interface (before the `PipelineStep` union):

```ts
export interface SelectStep {
  type: 'select'
  id: string
  label: string
  sourceId: string
  index: number
}
```

Update the `PipelineStep` union on line 65:

```ts
export type PipelineStep = FetchStep | PickStep | RenameStep | MergeStep | MathStep | OutputStep | SelectStep
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/pipeline/types.ts
git commit -m "feat: add SelectStep type to pipeline types"
```

---

### Task 2: Implement `generateSelectStep` with TDD

**Files:**
- Create: `server/src/pipeline/steps/select.ts`
- Modify: `server/src/pipeline/generate.ts`
- Modify: `server/src/pipeline/index.ts`
- Modify: `server/src/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

In `server/src/__tests__/pipeline.test.ts`, add a new `it` block inside the existing `describe('generateScript', ...)` block (after the last `it`):

```ts
it('generates a select step that indexes into a list', () => {
  const pipeline: Pipeline = {
    steps: [
      {
        type: 'fetch', id: 'step_1', label: 'List',
        connector_id: null, url: 'https://api.example.com/items',
        method: 'GET', headers: [], body: null, auth: null, variables: {},
      },
      {
        type: 'select', id: 'step_2', label: 'First Item',
        sourceId: 'step_1', index: 0,
      },
      { type: 'output', id: 'step_3', label: 'Out', sourceId: 'step_2', mappings: [] },
    ],
  }
  const script = generateScript(pipeline)
  expect(script).toContain('const step_2 = step_1[0]')
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd server && npx jest src/__tests__/pipeline.test.ts --no-coverage
```

Expected: FAIL — "Property 'select' does not exist" or TypeScript error, or the `switch` falls through without generating anything.

- [ ] **Step 3: Create the generator**

Create `server/src/pipeline/steps/select.ts`:

```ts
import type { SelectStep } from '../types'

/** Generates a `const <id> = <sourceId>[<index>]` JS statement for a select step. */
export function generateSelectStep(step: SelectStep): string {
  return 'const ' + step.id + ' = ' + step.sourceId + '[' + step.index + ']'
}
```

- [ ] **Step 4: Wire the generator into `generate.ts`**

In `server/src/pipeline/generate.ts`, add the import at the top (after the existing imports):

```ts
import { generateSelectStep } from './steps/select'
```

In the `generateScript` function's `switch` statement (after the `case 'output'` line):

```ts
case 'select': lines.push(generateSelectStep(step)); break
```

- [ ] **Step 5: Export from `index.ts`**

In `server/src/pipeline/index.ts`, update the types export line to include `SelectStep`:

```ts
export type { FetchStep, PickStep, RenameStep, MergeStep, MathStep, OutputStep, SelectStep, PipelineStep, Pipeline, ConnectorRow } from './types'
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
cd server && npx jest src/__tests__/pipeline.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Run the full test suite**

```bash
cd server && npm run test
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/pipeline/steps/select.ts server/src/pipeline/generate.ts server/src/pipeline/index.ts server/src/__tests__/pipeline.test.ts
git commit -m "feat: implement select step generator"
```

---

### Task 3: Add `SelectStepData` client type

**Files:**
- Modify: `client/src/views/pipeline/steps/types.ts`

- [ ] **Step 1: Add the `SelectStepData` interface**

In `client/src/views/pipeline/steps/types.ts`, add after the `PickStepData` interface (line 36):

```ts
/** Extracts a single element from a list by index. User is responsible for ensuring the source returns an array. */
export interface SelectStepData extends StepBase { type: 'select'; sourceId: string; index: number }
```

- [ ] **Step 2: Update the `AnyStep` union**

Change line 57:

```ts
export type AnyStep = FetchStepData | PickStepData | SelectStepData | RenameStepData | MergeStepData | MathStepData | OutputStepData
```

- [ ] **Step 3: Add the `'select'` case to `newStep`**

In the `newStep` function's `switch` statement (after the `case 'pick'` line):

```ts
case 'select': return { type, id, label: 'Select Element', sourceId: src, index: 0 }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/views/pipeline/steps/types.ts
git commit -m "feat: add SelectStepData client type"
```

---

### Task 4: Create `SelectStepForm` component

**Files:**
- Create: `client/src/views/pipeline/steps/SelectStepForm.tsx`

- [ ] **Step 1: Create the form**

Create `client/src/views/pipeline/steps/SelectStepForm.tsx`:

```tsx
import type { SelectStepData, AnyStep } from './types'

interface Props {
  step: SelectStepData
  /** Only fetch steps are valid sources for select — same restriction as Pick. */
  fetchSteps: AnyStep[]
  onChange: (patch: Partial<SelectStepData>) => void
}

export default function SelectStepForm({ step, fetchSteps, onChange }: Props) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>Source
        <select value={step.sourceId} onChange={e => onChange({ sourceId: e.target.value })}>
          {fetchSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>Index (0 = first element)
        <input
          type="number"
          min={0}
          value={step.index}
          onChange={e => onChange({ index: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        />
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/views/pipeline/steps/SelectStepForm.tsx
git commit -m "feat: add SelectStepForm component"
```

---

### Task 5: Wire `select` into `PipelineBuilderView`

**Files:**
- Modify: `client/src/views/pipeline/PipelineBuilderView.tsx`

- [ ] **Step 1: Import `SelectStepForm`**

In `client/src/views/pipeline/PipelineBuilderView.tsx`, add after the `PickStepForm` import (line 9):

```ts
import SelectStepForm from './steps/SelectStepForm'
```

- [ ] **Step 2: Add `'select'` to the step type picker**

In the JSX step type picker (around line 173), `['pick', 'rename', 'merge', 'math', 'output']` becomes:

```tsx
{(['pick', 'select', 'rename', 'merge', 'math', 'output'] as const).map(type => (
  <button key={type} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
    onClick={() => addStep(type)}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>
))}
```

- [ ] **Step 3: Add `case 'select'` to `renderStepForm`**

In the `renderStepForm` function's `switch` (after the `case 'pick'` line, around line 132):

```ts
case 'select': return <SelectStepForm step={step} fetchSteps={fetchSteps} onChange={patch => onChange(patch)} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/views/pipeline/PipelineBuilderView.tsx
git commit -m "feat: wire select step into pipeline builder UI"
```
