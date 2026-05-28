import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'

interface Variable { name: string; label: string; placeholder: string }
interface Connector {
  id: string; name: string; description: string | null
  url_template: string; method: string; headers_json: string
  body_template: string | null; variables_json: string; is_builtin: number
}

interface StepBase { id: string; label: string }
interface FetchStepData extends StepBase {
  type: 'fetch'
  connector_id: string | null
  url: string | null; method: string | null
  headers: { key: string; value: string }[]
  body: string | null
  auth: { type: 'bearer' | 'apikey'; secret: string } | null
  variables: Record<string, string>
}
interface PickStepData extends StepBase { type: 'pick'; sourceId: string; fields: string[] }
interface RenameStepData extends StepBase { type: 'rename'; sourceId: string; mappings: { from: string; to: string }[] }
interface MergeStepData extends StepBase { type: 'merge'; sources: { stepId: string; as: string }[] }
interface MathStepData extends StepBase { type: 'math'; sourceId: string; left: string; operator: string; right: string; outputKey: string }
interface OutputStepData extends StepBase { type: 'output'; sourceId: string; mappings: { from: string; to: string }[] }
type AnyStep = FetchStepData | PickStepData | RenameStepData | MergeStepData | MathStepData | OutputStepData

interface Props { apiUrl: string; sourceId: string }

function newStep(type: AnyStep['type'], id: string, fetchSteps: string[]): AnyStep {
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

export default function PipelineBuilderView({ apiUrl, sourceId }: Props) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('*/5 * * * *')
  const [steps, setSteps] = useState<AnyStep[]>([])
  const [generatedScript, setGeneratedScript] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [output, setOutput] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    fetch(`${apiUrl}/api/sources/${sourceId}`).then(r => r.json()).then((data: { name: string; schedule: string; script: string; pipeline_json: string | null }) => {
      setName(data.name)
      setSchedule(data.schedule)
      setGeneratedScript(data.script)
      if (data.pipeline_json) setSteps((JSON.parse(data.pipeline_json) as { steps: AnyStep[] }).steps)
    })
    fetch(`${apiUrl}/api/connectors`).then(r => r.json()).then(setConnectors)
  }, [apiUrl, sourceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateStep(id: string, patch: Partial<AnyStep>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } as AnyStep : s))
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setSteps(prev => {
      const arr = [...prev]
      const tmp = arr[idx]
      arr[idx] = arr[idx + dir]
      arr[idx + dir] = tmp
      return arr
    })
  }

  async function handleSave() {
    const pipeline_json = JSON.stringify({ steps })
    const res = await fetch(`${apiUrl}/api/sources/${sourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, schedule, pipeline_json }),
    })
    if (res.ok) {
      const updated = await fetch(`${apiUrl}/api/sources/${sourceId}`).then(r => r.json()) as { script: string }
      setGeneratedScript(updated.script)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    }
  }

  async function handleRun() {
    setRunning(true)
    const res = await fetch(`${apiUrl}/api/sources/${sourceId}/run`, { method: 'POST' })
    const data = await res.json() as { output: unknown }
    setOutput(data.output)
    setRunning(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/sources/${sourceId}`, { method: 'DELETE' })
    window.location.search = '?view=scripts'
  }

  async function handleSwitchToCode() {
    if (!window.confirm('This will replace the pipeline with the generated code. You won\'t be able to switch back.')) return
    await fetch(`${apiUrl}/api/sources/${sourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, schedule, script: generatedScript }),
    })
    window.location.search = '?view=scripts'
  }

  function addStep(type: AnyStep['type'], connectorId?: string) {
    const id = 'step_' + crypto.randomUUID().slice(0, 8)
    const fetchStepIds = steps.filter(s => s.type === 'fetch').map(s => s.id)
    const step = newStep(type, id, fetchStepIds)
    if (type === 'fetch' && connectorId) {
      const connector = connectors.find(c => c.id === connectorId)
      if (connector) {
        const variables: Record<string, string> = {}
        const vars = JSON.parse(connector.variables_json) as Variable[]
        vars.forEach(v => { variables[v.name] = '' })
        ;(step as FetchStepData).connector_id = connectorId
        ;(step as FetchStepData).variables = variables
        ;(step as FetchStepData).label = connector.name
      }
    }
    setSteps(prev => [...prev, step])
    setExpandedId(id)
    setShowAddPicker(false)
  }

  function renderStepForm(step: AnyStep) {
    const fetchStepIds = steps.filter(s => s.type === 'fetch').map(s => s.id)
    switch (step.type) {
      case 'fetch': {
        const connector = step.connector_id ? connectors.find(c => c.id === step.connector_id) : null
        const vars: Variable[] = connector ? JSON.parse(connector.variables_json) : []
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {connector ? (
              <>
                <div style={{ color: '#888', fontSize: '12px' }}>Using connector: <strong>{connector.name}</strong></div>
                {vars.map(v => (
                  <label key={v.name}>{v.label}
                    <input value={step.variables[v.name] ?? ''} placeholder={v.placeholder}
                      onChange={e => updateStep(step.id, { variables: { ...step.variables, [v.name]: e.target.value } } as Partial<FetchStepData>)} />
                  </label>
                ))}
              </>
            ) : (
              <>
                <label>URL<input value={step.url ?? ''} onChange={e => updateStep(step.id, { url: e.target.value } as Partial<FetchStepData>)} placeholder="https://api.example.com/data" /></label>
                <label>Method
                  <select value={step.method ?? 'GET'} onChange={e => updateStep(step.id, { method: e.target.value } as Partial<FetchStepData>)}>
                    <option>GET</option><option>POST</option>
                  </select>
                </label>
                {step.method === 'POST' && (
                  <label>Body (JSON)<textarea value={step.body ?? ''} onChange={e => updateStep(step.id, { body: e.target.value } as Partial<FetchStepData>)} rows={3} /></label>
                )}
              </>
            )}
            <label>Auth
              <select value={step.auth?.type ?? ''} onChange={e => {
                const t = e.target.value as '' | 'bearer' | 'apikey'
                updateStep(step.id, { auth: t ? { type: t, secret: step.auth?.secret ?? '' } : null } as Partial<FetchStepData>)
              }}>
                <option value="">None</option>
                <option value="bearer">Bearer Token (from Secret)</option>
                <option value="apikey">API Key Header (from Secret)</option>
              </select>
            </label>
            {step.auth && (
              <label>Secret Key
                <input value={step.auth.secret} placeholder="e.g. MY_API_KEY"
                  onChange={e => updateStep(step.id, { auth: { ...step.auth!, secret: e.target.value } } as Partial<FetchStepData>)} />
              </label>
            )}
          </div>
        )
      }
      case 'pick':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<PickStepData>)}>
              {fetchStepIds.map(id => <option key={id} value={id}>{steps.find(s => s.id === id)?.label ?? id}</option>)}
            </select></label>
            <label>Fields (dot-notation, one per line)
              <textarea value={step.fields.join('\n')} rows={4}
                onChange={e => updateStep(step.id, { fields: e.target.value.split('\n').filter(Boolean) } as Partial<PickStepData>)} />
            </label>
          </div>
        )
      case 'rename':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<RenameStepData>)}>
              {steps.filter(s => s.id !== step.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
            {step.mappings.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                <input value={m.from} placeholder="old key" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, from: e.target.value }
                  updateStep(step.id, { mappings } as Partial<RenameStepData>)
                }} />
                <span>→</span>
                <input value={m.to} placeholder="new name" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, to: e.target.value }
                  updateStep(step.id, { mappings } as Partial<RenameStepData>)
                }} />
              </div>
            ))}
            <button onClick={() => updateStep(step.id, { mappings: [...step.mappings, { from: '', to: '' }] } as Partial<RenameStepData>)}>+ Add mapping</button>
          </div>
        )
      case 'merge':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {step.sources.map((src, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={src.stepId} onChange={e => {
                  const sources = [...step.sources]; sources[i] = { ...src, stepId: e.target.value }
                  updateStep(step.id, { sources } as Partial<MergeStepData>)
                }}>
                  {fetchStepIds.map(id => <option key={id} value={id}>{steps.find(s => s.id === id)?.label ?? id}</option>)}
                </select>
                <span>as</span>
                <input value={src.as} placeholder="namespace" onChange={e => {
                  const sources = [...step.sources]; sources[i] = { ...src, as: e.target.value }
                  updateStep(step.id, { sources } as Partial<MergeStepData>)
                }} />
              </div>
            ))}
          </div>
        )
      case 'math':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<MathStepData>)}>
              {steps.filter(s => s.id !== step.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={step.left} placeholder="field or number" onChange={e => updateStep(step.id, { left: e.target.value } as Partial<MathStepData>)} />
              <select value={step.operator} onChange={e => updateStep(step.id, { operator: e.target.value } as Partial<MathStepData>)}>
                {['+', '-', '*', '/', '%'].map(op => <option key={op}>{op}</option>)}
              </select>
              <input value={step.right} placeholder="field or number" onChange={e => updateStep(step.id, { right: e.target.value } as Partial<MathStepData>)} />
            </div>
            <label>Output key<input value={step.outputKey} onChange={e => updateStep(step.id, { outputKey: e.target.value } as Partial<MathStepData>)} /></label>
          </div>
        )
      case 'output':
        return (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>Source<select value={step.sourceId} onChange={e => updateStep(step.id, { sourceId: e.target.value } as Partial<OutputStepData>)}>
              {steps.filter(s => s.id !== step.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></label>
            {step.mappings.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px' }}>
                <input value={m.from} placeholder="field path (e.g. weather.temp)" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, from: e.target.value }
                  updateStep(step.id, { mappings } as Partial<OutputStepData>)
                }} />
                <span>→</span>
                <input value={m.to} placeholder="output key" onChange={e => {
                  const mappings = [...step.mappings]; mappings[i] = { ...m, to: e.target.value }
                  updateStep(step.id, { mappings } as Partial<OutputStepData>)
                }} />
              </div>
            ))}
            <button onClick={() => updateStep(step.id, { mappings: [...step.mappings, { from: '', to: '' }] } as Partial<OutputStepData>)}>+ Add output field</button>
          </div>
        )
    }
  }

  return (
    <div className="view">
      <header className="app-header">
        <h1>Paul</h1>
        <nav className="app-nav">
          <a href="?">Dashboard</a>
          <a href="?view=scripts">Scripts</a>
          <a href="?view=secrets">Secrets</a>
        </nav>
      </header>
      <main style={{ padding: '24px', maxWidth: '720px' }}>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          Name<input value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
        </label>
        <label style={{ display: 'block', marginBottom: '16px' }}>
          Schedule (cron)<input value={schedule} onChange={e => setSchedule(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
        </label>

        <div style={{ marginBottom: '16px' }}>
          {steps.map((step, idx) => (
            <div key={step.id} style={{ border: '1px solid #333', borderRadius: '4px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', gap: '8px' }}
                onClick={() => setExpandedId(expandedId === step.id ? null : step.id)}>
                <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>{step.type}</span>
                <input value={step.label} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '14px' }}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateStep(step.id, { label: e.target.value })} />
                <button onClick={e => { e.stopPropagation(); moveStep(idx, -1) }} disabled={idx === 0}>↑</button>
                <button onClick={e => { e.stopPropagation(); moveStep(idx, 1) }} disabled={idx === steps.length - 1}>↓</button>
                <button onClick={e => { e.stopPropagation(); setSteps(prev => prev.filter(s => s.id !== step.id)) }}>×</button>
              </div>
              {expandedId === step.id && renderStepForm(step)}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <button onClick={() => setShowAddPicker(p => !p)}>+ Add Step</button>
          {showAddPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: '#222', border: '1px solid #444', borderRadius: '4px', padding: '8px', zIndex: 10, minWidth: '200px' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px', padding: '4px 8px' }}>Step type</div>
              {(['pick', 'rename', 'merge', 'math', 'output'] as const).map(type => (
                <button key={type} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                  onClick={() => addStep(type)}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>
              ))}
              <div style={{ borderTop: '1px solid #444', marginTop: '8px', paddingTop: '8px', fontWeight: 500, padding: '4px 8px' }}>Fetch</div>
              {connectors.map(c => (
                <button key={c.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                  onClick={() => addStep('fetch', c.id)}>{c.name}</button>
              ))}
              <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                onClick={() => addStep('fetch')}>Custom HTTP Request</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <button onClick={handleRun} disabled={running}>{running ? 'Running...' : 'Run Now'}</button>
          <button onClick={handleSave}>Save</button>
          {savedMsg && <span style={{ color: '#4a4' }}>Saved</span>}
          <button onClick={() => setShowCode(p => !p)}>View Generated Code</button>
          <button onClick={handleDelete} style={{ marginLeft: 'auto', color: '#f44' }}>Delete</button>
        </div>

        {output !== null && (
          <pre style={{ background: '#1a1a1a', padding: '12px', borderRadius: '4px', color: typeof output === 'object' && output !== null && 'error' in output ? '#f44' : 'inherit', marginBottom: '12px' }}>
            {JSON.stringify(output, null, 2)}
          </pre>
        )}

        {showCode && (
          <div style={{ border: '1px solid #333', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
              <button onClick={handleSwitchToCode} style={{ color: '#fa0' }}>Switch to Code Mode</button>
            </div>
            <Editor height="300px" language="javascript" theme="vs-dark" value={generatedScript} options={{ readOnly: true }} />
          </div>
        )}
      </main>
    </div>
  )
}
