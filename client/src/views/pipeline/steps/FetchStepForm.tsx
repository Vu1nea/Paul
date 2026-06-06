import type { Connector } from '@paul/types'
import type { FetchStepData, Variable } from './types'

/**
 * Form for a fetch step. Renders in one of two modes depending on whether a
 * connector is attached:
 *   - Connector mode: shows the connector's variable inputs only (url/method/body hidden).
 *   - Custom mode: shows full URL, method, and optional body fields.
 * Auth is available in both modes and references a secret by key name.
 */
interface Props {
  step: FetchStepData
  /** All available connectors — used to render variable inputs when step.connector_id is set. */
  connectors: Connector[]
  /** Called with a partial patch; caller merges it into the full step. */
  onChange: (patch: Partial<FetchStepData>) => void
}

export default function FetchStepForm({ step, connectors, onChange }: Props) {
  const connector = step.connector_id ? connectors.find(c => c.id === step.connector_id) : null
  const vars: Variable[] = connector ? JSON.parse(connector.variables_json) : []

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {connector ? (
        <>
          <div style={{ color: '#888', fontSize: '12px' }}>Using connector: <strong>{connector.name}</strong></div>
          {vars.map(v => (
            <label key={v.name}>{v.label}
              {v.type === 'select' ? (
                <select
                  value={step.variables[v.name] ?? v.options[0]?.value ?? ''}
                  onChange={e => onChange({ variables: { ...step.variables, [v.name]: e.target.value } })}
                >
                  {v.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input value={step.variables[v.name] ?? ''} placeholder={v.placeholder}
                  onChange={e => onChange({ variables: { ...step.variables, [v.name]: e.target.value } })} />
              )}
            </label>
          ))}
        </>
      ) : (
        <>
          <label>URL<input value={step.url ?? ''} placeholder="https://api.example.com/data" onChange={e => onChange({ url: e.target.value })} /></label>
          <label>Method
            <select value={step.method ?? 'GET'} onChange={e => onChange({ method: e.target.value })}>
              <option>GET</option><option>POST</option>
            </select>
          </label>
          {step.method === 'POST' && (
            <label>Body (JSON)<textarea value={step.body ?? ''} rows={3} onChange={e => onChange({ body: e.target.value })} /></label>
          )}
        </>
      )}
      <label>Auth
        <select value={step.auth?.type ?? ''} onChange={e => {
          const t = e.target.value as '' | 'bearer' | 'apikey'
          onChange({ auth: t ? { type: t, secret: step.auth?.secret ?? '' } : null })
        }}>
          <option value="">None</option>
          <option value="bearer">Bearer Token (from Secret)</option>
          <option value="apikey">API Key Header (from Secret)</option>
        </select>
      </label>
      {step.auth && (
        <label>Secret Key
          <input value={step.auth.secret} placeholder="e.g. MY_API_KEY"
            onChange={e => onChange({ auth: { ...step.auth!, secret: e.target.value } })} />
        </label>
      )}
    </div>
  )
}
