# Plan: Connector Select Variables

**Spec:** `docs/superpowers/specs/2026-06-05-connector-select-variables-design.md`
**Branch:** `feature/pipeline-cleanup`

## Overview

Extend connector variables to support a `select` input type alongside the existing plain-text input. Four files change; no server changes, no DB migration.

---

## Task 1: Extend Variable type in steps/types.ts

**File:** `client/src/views/pipeline/steps/types.ts`

1. Replace the single `Variable` interface with a discriminated union:
   ```ts
   export interface TextVariable  { type?: 'text'; name: string; label: string; placeholder: string }
   export interface SelectVariable { type: 'select'; name: string; label: string; options: { label: string; value: string }[] }
   export type Variable = TextVariable | SelectVariable
   ```
2. Export both named interfaces so `ConnectorsView` and `FetchStepForm` can import them.

**Verify:** `cd client && npm run lint` passes (no TS errors).

---

## Task 2: Rewrite variable editing UI in ConnectorsView.tsx

**File:** `client/src/views/ConnectorsView.tsx`

1. Remove local `Variable` interface. Import `Variable`, `TextVariable`, `SelectVariable` from `./views/pipeline/steps/types`.
2. Replace `rawVars: string` state with `vars: Variable[]` state (initialised to `[]`).
3. Update `startEdit`: replace `setRawVars(...)` with `setVars(JSON.parse(c.variables_json) as Variable[])`.
4. Update `startNew`: replace `setRawVars('')` with `setVars([])`.
5. Update `handleSave`: replace the `rawVars` parsing block with `variables_json: JSON.stringify(vars)`.
6. Replace the variables textarea in the edit panel JSX with:
   - A list of variable cards rendered from `vars`
   - Each card: Name input, Label input, Type `<select>` (Text/Select)
     - Text mode: Placeholder input
     - Select mode: options list (rows of Label + Value inputs), Add option button, remove (×) per row
   - Remove variable (×) button per card
   - "Add Variable" button at the bottom (appends a default `TextVariable`)

**Verify:** `cd client && npm run lint` passes.

---

## Task 3: Branch on variable type in FetchStepForm.tsx

**File:** `client/src/views/pipeline/steps/FetchStepForm.tsx`

1. Update the `Variable` import to use the union type from `./types`.
2. In the connector variable render loop, replace the single `<input>` with a branch:
   - `v.type === 'select'`: render `<select>` with `v.options` mapped to `<option>` elements; controlled value is `step.variables[v.name] ?? v.options[0]?.value ?? ''`
   - otherwise: render `<input>` as today with `v.placeholder`

**Verify:** `cd client && npm run lint` passes.

---

## Task 4: Pre-populate select defaults in PipelineBuilderView.tsx

**File:** `client/src/views/pipeline/PipelineBuilderView.tsx`

1. In `addStep`, find the loop: `vars.forEach(v => { variables[v.name] = '' })`.
2. Update it to: `vars.forEach(v => { variables[v.name] = v.type === 'select' ? (v.options[0]?.value ?? '') : '' })`.

**Verify:** `cd client && npm run lint` passes.

---

## Final verification

- `cd client && npm run lint` — no errors across all changed files
- `cd server && npm run test` — all server tests still pass (no server changes, just confirming no regressions)
