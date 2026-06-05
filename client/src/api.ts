import type { WidgetConfigs, Source, Connector, ConnectorBody } from '@paul/types'
import type { WeatherData } from './widgets'

const base = import.meta.env.VITE_API_URL as string

// Layout

/** Fetches the saved grid layout and all widget configs from the server. */
export function getLayout(): Promise<{ layout: Record<string, unknown[]>; configs: WidgetConfigs }> {
  return fetch(`${base}/api/layout`).then(r => r.json())
}

/** Persists the current grid layout and widget configs atomically. Throws on non-OK response. */
export async function saveLayout(layout: Record<string, unknown[]>, configs: WidgetConfigs): Promise<void> {
  const res = await fetch(`${base}/api/layout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout, configs }),
  })
  if (!res.ok) throw new Error('Failed to save layout')
}

// Sources

/** Returns all sources (scripts and pipelines). */
export function getSources(): Promise<Source[]> {
  return fetch(`${base}/api/sources`).then(r => r.json())
}

/** Returns a single source by ID, including its last_output. Supports abort signal for cancellation. */
export function getSource(id: string, signal?: AbortSignal): Promise<Source> {
  return fetch(`${base}/api/sources/${id}`, { signal }).then(r => r.json())
}

/** Creates a new source. Supply either `script` or `pipeline_json`, not both. Returns the new ID. */
export function createSource(body: { name: string; script?: string; pipeline_json?: string; schedule: string }): Promise<{ id: string }> {
  return fetch(`${base}/api/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())
}

/** Updates an existing source. Returns true if the server accepted the update. */
export async function updateSource(id: string, body: { name: string; script?: string; pipeline_json?: string; schedule: string }): Promise<boolean> {
  const res = await fetch(`${base}/api/sources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

/** Hard-deletes a source. */
export function deleteSource(id: string): Promise<void> {
  return fetch(`${base}/api/sources/${id}`, { method: 'DELETE' }).then(() => {})
}

/** Triggers an immediate run of the source and returns its output. */
export function runSource(id: string): Promise<{ output: unknown }> {
  return fetch(`${base}/api/sources/${id}/run`, { method: 'POST' }).then(r => r.json())
}

// Connectors

/** Returns all connectors, including built-ins. */
export function getConnectors(): Promise<Connector[]> {
  return fetch(`${base}/api/connectors`).then(r => r.json())
}

/** Creates a new connector. Returns the new ID. */
export function createConnector(body: ConnectorBody): Promise<{ id: string }> {
  return fetch(`${base}/api/connectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())
}

/** Replaces a connector's fields in full. */
export function updateConnector(id: string, body: ConnectorBody): Promise<void> {
  return fetch(`${base}/api/connectors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(() => {})
}

/** Hard-deletes a connector. */
export function deleteConnector(id: string): Promise<void> {
  return fetch(`${base}/api/connectors/${id}`, { method: 'DELETE' }).then(() => {})
}

// Secrets

/** Returns only the key names of stored secrets — values are never sent to the client. */
export function getSecretKeys(): Promise<string[]> {
  return fetch(`${base}/api/secrets`).then(r => r.json()).then((d: { keys: string[] }) => d.keys)
}

/** Stores a new secret key/value pair. Returns a 409 Response if the key already exists — caller must check res.status. */
export function createSecret(key: string, value: string): Promise<Response> {
  return fetch(`${base}/api/secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}

/** Hard-deletes a secret by key. */
export function deleteSecret(key: string): Promise<void> {
  return fetch(`${base}/api/secrets/${encodeURIComponent(key)}`, { method: 'DELETE' }).then(() => {})
}

// Weather

/** Proxies Open-Meteo via the local server. Supports abort signal for cancellation when widget configs change. */
export function getWeather(latitude: number, longitude: number, units: string, signal?: AbortSignal): Promise<WeatherData> {
  return fetch(`${base}/api/weather?latitude=${latitude}&longitude=${longitude}&units=${units}`, { signal }).then(r => r.json())
}
