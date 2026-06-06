# Connector Select Variables — Design Spec

**Date:** 2026-06-05
**Status:** Approved

## Summary

Extend the connector variable system to support a `select` input type. Today all connector variables render as plain text inputs in FetchStepForm. After this change, a connector author can define a variable as a dropdown with a fixed list of label→value pairs. The pipeline builder user then sees a `<select>` instead of a free-text field when configuring a fetch step that uses that connector.

Dynamic search (e.g. city typeahead) is explicitly out of scope and deferred.

---

## Data Model

### Variable type (client/src/views/pipeline/steps/types.ts)

The existing `Variable` interface is replaced with a discriminated union:

```ts
interface TextVariable {
  type: 'text'   // or absent — treated as text for backwards compatibility
  name: string
  label: string
  placeholder: string
}

interface SelectVariable {
  type: 'select'
  name: string
  label: string
  options: { label: string; value: string }[]
}

type Variable = TextVariable | SelectVariable
```

**Backwards compatibility:** Existing stored variables have no `type` field. Any variable where `type` is absent or `'text'` is treated as a text input. No DB migration is needed — `variables_json` is an opaque JSON blob in the `connectors` table.

**Deduplication:** `ConnectorsView.tsx` defines a local `Variable` interface that duplicates the one in `steps/types.ts`. The local definition is deleted; both files import from `steps/types.ts`.

---

## ConnectorsView — Edit Form

The `rawVars: string` state and the pipe-delimited textarea (`name|label|placeholder`, one per line) are removed entirely. Replaced with `vars: Variable[]` state.

### Load path
`startEdit` parses `c.variables_json` directly into `vars`:
```ts
setVars(JSON.parse(c.variables_json) as Variable[])
```
No string parsing.

### Save path
`handleSave` serialises `vars` directly:
```ts
variables_json: JSON.stringify(vars)
```
No string serialisation.

### Edit UI

The variable section renders a list of cards, one per variable, plus an "Add Variable" button at the bottom. Each card contains:

| Field | Control | Notes |
|-------|---------|-------|
| Name | `<input>` | The `{key}` substituted into the URL template |
| Label | `<input>` | Shown to the pipeline user in FetchStepForm |
| Type | `<select>`: Text / Select | Switches the card between text and select mode |
| Placeholder | `<input>` | Text mode only |
| Options list | Rows of Label + Value inputs | Select mode only |
| Add option | Button | Appends `{ label: '', value: '' }` to the options array |
| Remove option (×) | Button per row | Removes that option |
| Remove variable (×) | Button per card | Removes the variable from `vars` |

A variable card in select mode with an empty options list is valid to save — `FetchStepForm` renders an empty `<select>` in that case, which is visible but unusable. Connector authors are expected not to ship select variables with no options.

---

## FetchStepForm — Rendering

The existing variable rendering loop is updated to branch on `v.type`:

```ts
vars.map(v => {
  if (v.type === 'select') {
    return (
      <label key={v.name}>{v.label}
        <select
          value={step.variables[v.name] ?? v.options[0]?.value ?? ''}
          onChange={e => onChange({ variables: { ...step.variables, [v.name]: e.target.value } })}
        >
          {v.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    )
  }
  // default: text
  return (
    <label key={v.name}>{v.label}
      <input value={step.variables[v.name] ?? ''} placeholder={v.placeholder}
        onChange={e => onChange({ variables: { ...step.variables, [v.name]: e.target.value } })} />
    </label>
  )
})
```

**Initial value for new steps:** When a fetch step is freshly added with a connector that has select variables, `step.variables` starts empty. The select renders with `v.options[0]?.value ?? ''` as the displayed value, but `step.variables` is only written on change — so if the user saves without touching the select, the first option is never persisted.

To fix this, `PipelineBuilderView.addStep` already loops over connector variables and initialises each to `''`. That loop should instead use `v.options[0]?.value ?? ''` for select variables so the default is persisted from the moment the step is created.

No other changes to `FetchStepForm`.

---

## Files Changed

| File | Change |
|------|--------|
| `client/src/views/pipeline/steps/types.ts` | Replace `Variable` with `TextVariable | SelectVariable` union |
| `client/src/views/ConnectorsView.tsx` | Remove `rawVars` state and textarea; add `vars: Variable[]` state and per-variable card UI; remove local `Variable` interface |
| `client/src/views/pipeline/steps/FetchStepForm.tsx` | Branch on `v.type` to render `<select>` or `<input>` |
| `client/src/views/pipeline/PipelineBuilderView.tsx` | Pre-populate select variable defaults in `addStep` |

No server changes. No DB migration. No changes to `@paul/types`.

---

## Out of Scope

- Dynamic search/autocomplete (deferred — future `type: 'search'` extension)
- Multi-select
- Dependent selects (one select's options depend on another's value)
