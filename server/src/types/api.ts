/** Shape returned by GET /api/sources and GET /api/sources/:id. */
export interface Source {
  id: string
  name: string
  schedule: string
  /** ISO 8601 timestamp of the last execution, or null if never run. */
  last_run_at: string | null
  /** Parsed JSON output of the last run, or null if never run. `{ error: string }` on failure. */
  last_output: unknown
  /** Resolved executable JS. Present on GET /api/sources/:id; omitted from the list endpoint. */
  script?: string
  /** Raw pipeline definition JSON. Present only for pipeline-mode sources. */
  pipeline_json?: string | null
}

/** Full connector row as returned by GET /api/connectors. */
export interface Connector {
  id: string
  name: string
  description: string | null
  /** URL template with `{variable}` placeholders substituted at runtime. */
  url_template: string
  method: string
  /** JSON-serialised array of `{ key: string; value: string }` request headers. */
  headers_json: string
  body_template: string | null
  /** JSON-serialised array of Variable definitions used to render the connector's input form. */
  variables_json: string
  /** 1 = built-in (read-only); 0 = user-created. */
  is_builtin: number
}

/** Request body for POST /api/connectors and PUT /api/connectors/:id. */
export interface ConnectorBody {
  name: string
  description?: string
  url_template: string
  method?: string
  headers_json?: string
  body_template?: string | null
  variables_json?: string
}

/** Keyed by widget instance ID. Persisted as the `configs` field in POST /api/layout. */
export type WidgetConfigs = Record<string, { type: string; config: Record<string, unknown> }>
