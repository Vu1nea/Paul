export interface Variable { name: string; label: string; placeholder: string }

interface StepBase { id: string; label: string }

export interface FetchStepData extends StepBase {
  type: 'fetch'
  connector_id: string | null
  url: string | null
  method: string | null
  headers: { key: string; value: string }[]
  body: string | null
  auth: { type: 'bearer' | 'apikey'; secret: string } | null
  variables: Record<string, string>
}

export interface PickStepData extends StepBase { type: 'pick'; sourceId: string; fields: string[] }
export interface RenameStepData extends StepBase { type: 'rename'; sourceId: string; mappings: { from: string; to: string }[] }
export interface MergeStepData extends StepBase { type: 'merge'; sources: { stepId: string; as: string }[] }
export interface MathStepData extends StepBase { type: 'math'; sourceId: string; left: string; operator: string; right: string; outputKey: string }
export interface OutputStepData extends StepBase { type: 'output'; sourceId: string; mappings: { from: string; to: string }[] }

export type AnyStep = FetchStepData | PickStepData | RenameStepData | MergeStepData | MathStepData | OutputStepData

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
