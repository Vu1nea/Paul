export interface Source {
  id: string
  name: string
  schedule: string
  last_run_at: string | null
  last_output: unknown
  script?: string
  pipeline_json?: string | null
}

export interface Connector {
  id: string
  name: string
  description: string | null
  url_template: string
  method: string
  headers_json: string
  body_template: string | null
  variables_json: string
  is_builtin: number
}

export interface ConnectorBody {
  name: string
  description?: string
  url_template: string
  method?: string
  headers_json?: string
  body_template?: string | null
  variables_json?: string
}

export type WidgetConfigs = Record<string, { type: string; config: Record<string, unknown> }>
