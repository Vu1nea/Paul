import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import ConnectorsView from './ConnectorsView'

interface Source {
  id: string
  name: string
  schedule: string
  last_run_at: string | null
  last_output: unknown
  script?: string
  pipeline_json?: string | null
}

interface Props {
  apiUrl: string
}

type ActiveTab = 'sources' | 'connectors'

export default function ScriptsView({ apiUrl }: Props) {
  const [tab, setTab] = useState<ActiveTab>('sources')
  const [sources, setSources] = useState<Source[]>([])
  const [selected, setSelected] = useState<Source | null>(null)
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('*/5 * * * *')
  const [code, setCode] = useState('')
  const [output, setOutput] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)

  function loadSources() {
    fetch(`${apiUrl}/api/sources`).then(r => r.json()).then(setSources).catch(() => {})
  }

  useEffect(() => { loadSources() }, [apiUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectSource(s: Source) {
    fetch(`${apiUrl}/api/sources/${s.id}`)
      .then(r => r.json())
      .then((full: Source) => {
        setSelected(full)
        setName(full.name)
        setSchedule(full.schedule)
        setCode(full.script ?? '')
        setOutput(full.last_output ?? null)
      })
  }

  async function handleNew() {
    setShowModeModal(true)
  }

  async function createSource(mode: 'code' | 'pipeline') {
    setShowModeModal(false)
    if (mode === 'pipeline') {
      const res = await fetch(`${apiUrl}/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled', script: '', schedule: '*/5 * * * *', pipeline_json: JSON.stringify({ steps: [] }) }),
      })
      const data = await res.json() as { id: string }
      window.location.search = `?view=pipeline&id=${data.id}`
      return
    }
    const res = await fetch(`${apiUrl}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled', script: 'return { value: 42 }', schedule: '*/5 * * * *' }),
    })
    const data = await res.json() as { id: string }
    loadSources()
    fetch(`${apiUrl}/api/sources/${data.id}`).then(r => r.json()).then(selectSource)
  }

  async function handleSave() {
    if (!selected) return
    await fetch(`${apiUrl}/api/sources/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, script: code, schedule }),
    })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
    loadSources()
  }

  async function handleRun() {
    if (!selected) return
    setRunning(true)
    const res = await fetch(`${apiUrl}/api/sources/${selected.id}/run`, { method: 'POST' })
    const data = await res.json() as { output: unknown }
    setOutput(data.output)
    setRunning(false)
  }

  async function handleDelete() {
    if (!selected) return
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/sources/${selected.id}`, { method: 'DELETE' })
    setSelected(null)
    loadSources()
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
      <main style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        <aside style={{ width: '240px', borderRight: '1px solid #333', padding: '12px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={() => setTab('sources')} style={{ fontWeight: tab === 'sources' ? 'bold' : 'normal' }}>Sources</button>
            <button onClick={() => setTab('connectors')} style={{ fontWeight: tab === 'connectors' ? 'bold' : 'normal' }}>Connectors</button>
          </div>
          {tab === 'sources' && (
            <>
              <button onClick={handleNew} style={{ width: '100%', marginBottom: '8px' }}>+ New Script</button>
              {sources.map(s => (
                <div key={s.id} onClick={() => selectSource(s)} style={{ padding: '8px', cursor: 'pointer', background: selected?.id === s.id ? '#333' : 'transparent', borderRadius: '4px', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{s.schedule}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never run'}
                  </div>
                </div>
              ))}
            </>
          )}
          {tab === 'connectors' && null}
        </aside>

        {tab === 'connectors' ? (
          <ConnectorsView apiUrl={apiUrl} />
        ) : selected ? (
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            {selected.pipeline_json ? (
              <div style={{ color: '#888', padding: '24px', textAlign: 'center' }}>
                This source uses the pipeline builder.{' '}
                <a href={`?view=pipeline&id=${selected.id}`} style={{ color: '#4af' }}>Open Pipeline Builder</a>
              </div>
            ) : (
              <>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  Name<input value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
                </label>
                <label style={{ display: 'block', marginBottom: '12px' }}>
                  Schedule (cron)<input value={schedule} onChange={e => setSchedule(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
                </label>
                <Editor height="300px" language="javascript" theme="vs-dark" value={code} onChange={v => setCode(v ?? '')} />
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={handleRun} disabled={running}>{running ? 'Running...' : 'Run Now'}</button>
                  <button onClick={handleSave}>Save</button>
                  {savedMsg && <span style={{ color: '#4a4' }}>Saved</span>}
                  <button onClick={handleDelete} style={{ marginLeft: 'auto', color: '#f44' }}>Delete</button>
                </div>
                {output !== null && (
                  <pre style={{ marginTop: '12px', background: '#1a1a1a', padding: '12px', borderRadius: '4px', color: typeof output === 'object' && output !== null && 'error' in output ? '#f44' : 'inherit' }}>
                    {JSON.stringify(output, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            Select a source or create a new one
          </div>
        )}
      </main>

      {showModeModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModeModal(false) }}>
          <div className="modal">
            <h2 className="modal-title">Create new data source</h2>
            <div className="modal-body" style={{ display: 'flex', gap: '16px' }}>
              <button onClick={() => createSource('pipeline')} style={{ flex: 1, padding: '16px' }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>Build a pipeline</div>
                <div style={{ fontSize: '12px', color: '#888' }}>Visual step-by-step builder. No code required.</div>
              </button>
              <button onClick={() => createSource('code')} style={{ flex: 1, padding: '16px' }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>Write code</div>
                <div style={{ fontSize: '12px', color: '#888' }}>JavaScript editor with full control.</div>
              </button>
            </div>
            <div className="modal-footer">
              <button className="modal-btn" onClick={() => setShowModeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
