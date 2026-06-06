/** A plain-text connector variable. `type` may be absent on legacy stored variables — treat as text. */
export interface TextVariable { type?: 'text'; name: string; label: string; placeholder: string }

/** A fixed-choice connector variable rendered as a `<select>` in FetchStepForm. */
export interface SelectVariable { type: 'select'; name: string; label: string; options: { label: string; value: string }[] }

/** A connector variable definition — `name` is the substitution key used in url_template as `{name}`. */
export type Variable = TextVariable | SelectVariable

/** Shared base for every pipeline step. `id` must be unique within a pipeline. */
interface StepBase { id: string; label: string }

/**
 * Fetches data from an HTTP endpoint.
 * `connector_id` and `url` are mutually exclusive — when a connector is chosen,
 * `url`/`method`/`headers`/`body` are ignored and the connector's template is used instead.
 * `variables` maps connector variable names to their runtime values.
 */
export interface FetchStepData extends StepBase {
  type: 'fetch'
  /** ID of the connector to use, or null for a custom HTTP request. */
  connector_id: string | null
  /** Request URL — only used when connector_id is null. */
  url: string | null
  method: string | null
  headers: { key: string; value: string }[]
  /** JSON body string — only used for POST requests when connector_id is null. */
  body: string | null
  /** Auth config referencing a secret key stored in the Secrets store. */
  auth: { type: 'bearer' | 'apikey'; secret: string } | null
  /** Values for connector variable placeholders, keyed by Variable.name. */
  variables: Record<string, string>
}

/** Selects a subset of fields from the source step's output. `fields` are dot-notation paths. */
export interface PickStepData extends StepBase { type: 'pick'; sourceId: string; fields: string[] }

/** Renames keys in the source step's output. `from` is the existing key, `to` is the new name. */
export interface RenameStepData extends StepBase { type: 'rename'; sourceId: string; mappings: { from: string; to: string }[] }

/**
 * Merges multiple step outputs into a single object.
 * Each source is nested under its `as` namespace key in the merged result,
 * e.g. `{ a: <step1 output>, b: <step2 output> }`.
 */
export interface MergeStepData extends StepBase { type: 'merge'; sources: { stepId: string; as: string }[] }

/**
 * Performs a binary math operation and writes the result to `outputKey`.
 * `left` and `right` accept either a dot-notation field path from the source or a numeric literal.
 */
export interface MathStepData extends StepBase { type: 'math'; sourceId: string; left: string; operator: string; right: string; outputKey: string }

/** Maps fields from the source step's output to the final pipeline output object. `from` is a dot-notation field path, `to` is the output key name. */
export interface OutputStepData extends StepBase { type: 'output'; sourceId: string; mappings: { from: string; to: string }[] }

export type AnyStep = FetchStepData | PickStepData | RenameStepData | MergeStepData | MathStepData | OutputStepData

/**
 * Creates a new step with sensible defaults for a given type.
 * `fetchSteps` is the list of existing fetch step IDs — used to pre-populate
 * sourceId so the new step has a valid source immediately.
 */
export function newStep(type: AnyStep['type'], id: string, fetchSteps: string[]): AnyStep {
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
