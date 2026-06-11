# Select Step Design

## Overview

Add a new `select` pipeline step that extracts a single element from a list by index. The user is responsible for using this step only when the source fetch returns an array. The step outputs the whole element — field extraction is handled by chaining a Pick step after.

## Data Shape

### Client (`client/src/views/pipeline/steps/types.ts`)

```ts
interface SelectStepData extends StepBase {
  type: 'select'
  sourceId: string  // fetch step ID
  index: number     // non-negative integer, defaults to 0
}
```

Added to the `AnyStep` union. `newStep('select', id, fetchSteps)` defaults to `{ index: 0, sourceId: fetchSteps[0] ?? '' }`.

### Server (`server/src/pipeline/types.ts`)

```ts
interface SelectStep {
  type: 'select'
  id: string
  label: string
  sourceId: string
  index: number
}
```

Added to the `PipelineStep` union.

## Code Generation

`server/src/pipeline/steps/select.ts` generates:

```js
const <id> = <sourceId>[<index>]
```

Example — step id `step_abc`, sourceId `step_xyz`, index `0`:

```js
const step_abc = step_xyz[0]
```

## Client UI

`SelectStepForm` follows the same structure as `PickStepForm`:

- **Source** — `<select>` populated with fetch steps only (same restriction as Pick)
- **Index** — `<input type="number" min="0">` with label "Index (0 = first element)"

`PipelineBuilderView` additions:
- Import `SelectStepForm`
- Add `'select'` to the step type picker dropdown
- Add `case 'select'` in `renderStepForm`, passing `fetchSteps` as the source list

## Constraints

- Source is restricted to fetch steps only — the same restriction Pick uses.
- Index is a non-negative integer. Out-of-bounds yields `undefined` at runtime (JavaScript array behaviour).
- Negative index support is out of scope for now. It can be added later without changing the type shape.
- Multi-element selection is out of scope — this step always selects exactly one element.
