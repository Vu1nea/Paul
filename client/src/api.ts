const base = import.meta.env.VITE_API_URL as string

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

// Layout

export function getLayout(): Promise<{ layout: unknown; configs: WidgetConfigs }> {
  return fetch(`${base}/api/layout`).then(r => r.json())
}

export async function saveLayout(layout: unknown, configs: unknown): Promise<void> {
  const res = await fetch(`${base}/api/layout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout, configs }),
  })
  if (!res.ok) throw new Error('Failed to save layout')
}

// Sources

export function getSources(): Promise<Source[]> {
  return fetch(`${base}/api/sources`).then(r => r.json())
}

export function getSource(id: string, signal?: AbortSignal): Promise<Source> {
  return fetch(`${base}/api/sources/${id}`, { signal }).then(r => r.json())
}

export function createSource(body: { name: string; script?: string; pipeline_json?: string; schedule: string }): Promise<{ id: string }> {
  return fetch(`${base}/api/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())
}

export async function updateSource(id: string, body: { name: string; script?: string; pipeline_json?: string; schedule: string }): Promise<boolean> {
  const res = await fetch(`${base}/api/sources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

export function deleteSource(id: string): Promise<void> {
  return fetch(`${base}/api/sources/${id}`, { method: 'DELETE' }).then(() => {})
}

export function runSource(id: string): Promise<{ output: unknown }> {
  return fetch(`${base}/api/sources/${id}/run`, { method: 'POST' }).then(r => r.json())
}

// Connectors

export function getConnectors(): Promise<Connector[]> {
  return fetch(`${base}/api/connectors`).then(r => r.json())
}

export function createConnector(body: ConnectorBody): Promise<{ id: string }> {
  return fetch(`${base}/api/connectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())
}

export function updateConnector(id: string, body: ConnectorBody): Promise<void> {
  return fetch(`${base}/api/connectors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(() => {})
}

export function deleteConnector(id: string): Promise<void> {
  return fetch(`${base}/api/connectors/${id}`, { method: 'DELETE' }).then(() => {})
}

// Secrets

export function getSecretKeys(): Promise<string[]> {
  return fetch(`${base}/api/secrets`).then(r => r.json()).then((d: { keys: string[] }) => d.keys)
}

export function createSecret(key: string, value: string): Promise<Response> {
  return fetch(`${base}/api/secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}

export function deleteSecret(key: string): Promise<void> {
  return fetch(`${base}/api/secrets/${encodeURIComponent(key)}`, { method: 'DELETE' }).then(() => {})
}

// Weather

export function getWeather(latitude: number, longitude: number, units: string, signal?: AbortSignal): Promise<unknown> {
  return fetch(`${base}/api/weather?latitude=${latitude}&longitude=${longitude}&units=${units}`, { signal }).then(r => r.json())
}
