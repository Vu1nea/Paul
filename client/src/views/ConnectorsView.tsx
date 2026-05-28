import { useState, useEffect } from 'react'

interface Variable { name: string; label: string; placeholder: string }
interface Connector {
  id: string; name: string; description: string | null
  url_template: string; method: string; headers_json: string
  body_template: string | null; variables_json: string; is_builtin: number
}

interface Props { apiUrl: string }

const emptyForm = { name: '', description: '', url_template: '', method: 'GET', headers_json: '[]', body_template: '', variables_json: '[]' }

export default function ConnectorsView({ apiUrl }: Props) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [editing, setEditing] = useState<Connector | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [rawVars, setRawVars] = useState('')

  function loadConnectors() {
    fetch(`${apiUrl}/api/connectors`).then(r => r.json()).then(setConnectors).catch(() => {})
  }

  useEffect(() => { loadConnectors() }, [apiUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(c: Connector) {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '', url_template: c.url_template, method: c.method, headers_json: c.headers_json, body_template: c.body_template ?? '', variables_json: c.variables_json })
    const vars = JSON.parse(c.variables_json) as Variable[]
    setRawVars(vars.map(v => `${v.name}|${v.label}|${v.placeholder}`).join('\n'))
  }

  function startNew() {
    setEditing({ id: '', name: '', description: null, url_template: '', method: 'GET', headers_json: '[]', body_template: null, variables_json: '[]', is_builtin: 0 })
    setForm(emptyForm)
    setRawVars('')
  }

  async function handleSave() {
    if (!editing) return
    const vars: Variable[] = rawVars.split('\n').filter(Boolean).map(line => {
      const [name, label, placeholder] = line.split('|')
      return { name: name?.trim() ?? '', label: label?.trim() ?? '', placeholder: placeholder?.trim() ?? '' }
    })
    const body = { ...form, variables_json: JSON.stringify(vars), body_template: form.body_template || null }
    if (editing.id) {
      await fetch(`${apiUrl}/api/connectors/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch(`${apiUrl}/api/connectors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setEditing(null)
    loadConnectors()
  }

  async function handleDelete(c: Connector) {
    if (!window.confirm(`Delete connector "${c.name}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/connectors/${c.id}`, { method: 'DELETE' })
    loadConnectors()
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ width: '240px', borderRight: '1px solid #333', padding: '12px', overflowY: 'auto' }}>
        <button onClick={startNew} style={{ width: '100%', marginBottom: '8px' }}>+ New Connector</button>
        {connectors.map(c => (
          <div key={c.id} onClick={() => !c.is_builtin && startEdit(c)}
            style={{ padding: '8px', borderRadius: '4px', marginBottom: '4px', background: editing?.id === c.id ? '#333' : 'transparent', opacity: c.is_builtin ? 0.5 : 1, cursor: c.is_builtin ? 'default' : 'pointer' }}>
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            {c.is_builtin ? <div style={{ fontSize: '11px', color: '#888' }}>Built-in</div> : null}
          </div>
        ))}
      </aside>

      {editing !== null && !editing.is_builtin ? (
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '560px' }}>
          <label>Name<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
          <label>Description<input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
          <label>Method<select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}><option>GET</option><option>POST</option></select></label>
          <label>URL template<input value={form.url_template} placeholder="https://api.example.com/{endpoint}" onChange={e => setForm(f => ({ ...f, url_template: e.target.value }))} /></label>
          <label>Body template (POST only)<textarea value={form.body_template} rows={3} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))} /></label>
          <label>
            Variables (one per line: <code>name|Label|placeholder</code>)
            <textarea value={rawVars} rows={4} placeholder={'lat|Latitude|e.g. 45.5017\nlon|Longitude|e.g. -73.5673'} onChange={e => setRawVars(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
            {editing.id && <button onClick={() => handleDelete(editing)} style={{ marginLeft: 'auto', color: '#f44' }}>Delete</button>}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
          Select a connector to edit or create a new one
        </div>
      )}
    </div>
  )
}
