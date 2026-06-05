export interface FetchStep {
  type: 'fetch'
  id: string
  label: string
  // null after resolveConnectorStep has merged the connector's template into this step.
  connector_id: string | null
  url: string | null
  method: string | null
  headers: { key: string; value: string }[]
  body: string | null
  auth: { type: 'bearer' | 'apikey'; secret: string } | null
  // User-supplied values substituted into {placeholder} slots in connector templates.
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
