import { useState, useEffect } from 'react'
import { getConnectors, createConnector, updateConnector, deleteConnector } from '../api'
import type { Connector } from '@paul/types'
import type { Variable, TextVariable, SelectVariable } from './pipeline/steps/types'

/**
 * CRUD view for HTTP connectors — reusable API endpoint templates.
 * A connector defines a URL template, method, and a set of named variables that
 * get substituted at runtime (e.g. url_template "https://api.example.com/{city}",
 * variable name "city"). Built-in connectors are read-only and shown greyed out.
 *
 * Variables are managed as a structured list. Each variable has a type:
 *   - text: renders as a plain input in FetchStepForm
 *   - select: renders as a dropdown; connector author defines the options here
 */

const emptyForm = { name: '', description: '', url_template: '', method: 'GET', headers_json: '[]', body_template: '' }

function newTextVar(): TextVariable {
  return { type: 'text', name: '', label: '', placeholder: '' }
}


export default function ConnectorsView() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [editing, setEditing] = useState<Connector | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [vars, setVars] = useState<Variable[]>([])

  function loadConnectors() {
    getConnectors().then(setConnectors).catch(() => {})
  }

  useEffect(() => { loadConnectors() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(c: Connector) {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '', url_template: c.url_template, method: c.method, headers_json: c.headers_json, body_template: c.body_template ?? '' })
    setVars(JSON.parse(c.variables_json) as Variable[])
  }

  function startNew() {
    setEditing({ id: '', name: '', description: null, url_template: '', method: 'GET', headers_json: '[]', body_template: null, variables_json: '[]', is_builtin: 0 })
    setForm(emptyForm)
    setVars([])
  }

  async function handleSave() {
    if (!editing) return
    const body = { ...form, variables_json: JSON.stringify(vars), body_template: form.body_template || null }
    if (editing.id) {
      await updateConnector(editing.id, body)
    } else {
      await createConnector(body)
    }
    setEditing(null)
    loadConnectors()
  }

  async function handleDelete(c: Connector) {
    if (!window.confirm(`Delete connector "${c.name}"? This cannot be undone.`)) return
    await deleteConnector(c.id)
    loadConnectors()
  }

  function updateVar(idx: number, patch: Partial<Variable>) {
    setVars(prev => prev.map((v, i) => i === idx ? { ...v, ...patch } as Variable : v))
  }

  function changeVarType(idx: number, type: 'text' | 'select') {
    setVars(prev => prev.map((v, i) => {
      if (i !== idx) return v
      return type === 'select'
        ? { type: 'select', name: v.name, label: v.label, options: [] }
        : { type: 'text', name: v.name, label: v.label, placeholder: '' }
    }))
  }

  function addOption(idx: number) {
    setVars(prev => prev.map((v, i) => {
      if (i !== idx || v.type !== 'select') return v
      return { ...v, options: [...v.options, { label: '', value: '' }] }
    }))
  }

  function updateOption(varIdx: number, optIdx: number, patch: { label?: string; value?: string }) {
    setVars(prev => prev.map((v, i) => {
      if (i !== varIdx || v.type !== 'select') return v
      return { ...v, options: v.options.map((o, j) => j === optIdx ? { ...o, ...patch } : o) }
    }))
  }

  function removeOption(varIdx: number, optIdx: number) {
    setVars(prev => prev.map((v, i) => {
      if (i !== varIdx || v.type !== 'select') return v
      return { ...v, options: v.options.filter((_, j) => j !== optIdx) }
    }))
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

          <div>
            <div style={{ marginBottom: '6px', fontWeight: 500 }}>Variables</div>
            {vars.map((v, idx) => (
              <div key={idx} style={{ border: '1px solid #333', borderRadius: '4px', padding: '10px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <label style={{ flex: 1 }}>Name
                    <input value={v.name} placeholder="e.g. city" onChange={e => updateVar(idx, { name: e.target.value })} />
                  </label>
                  <label style={{ flex: 1 }}>Label
                    <input value={v.label} placeholder="e.g. City" onChange={e => updateVar(idx, { label: e.target.value })} />
                  </label>
                  <label>Type
                    <select value={v.type ?? 'text'} onChange={e => changeVarType(idx, e.target.value as 'text' | 'select')}>
                      <option value="text">Text</option>
                      <option value="select">Select</option>
                    </select>
                  </label>
                  <button onClick={() => setVars(prev => prev.filter((_, i) => i !== idx))} style={{ marginTop: '18px', color: '#f44', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>×</button>
                </div>

                {(v.type ?? 'text') === 'text' ? (
                  <label>Placeholder
                    <input value={(v as TextVariable).placeholder} placeholder="e.g. 45.5017" onChange={e => updateVar(idx, { placeholder: e.target.value })} />
                  </label>
                ) : (
                  <div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Options (label → value)</div>
                    {(v as SelectVariable).options.map((o, oi) => (
                      <div key={oi} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                        <input value={o.label} placeholder="Label" style={{ flex: 1 }} onChange={e => updateOption(idx, oi, { label: e.target.value })} />
                        <input value={o.value} placeholder="Value" style={{ flex: 1 }} onChange={e => updateOption(idx, oi, { value: e.target.value })} />
                        <button onClick={() => removeOption(idx, oi)} style={{ color: '#f44', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => addOption(idx)} style={{ fontSize: '12px', marginTop: '2px' }}>+ Add option</button>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setVars(prev => [...prev, newTextVar()])} style={{ width: '100%' }}>+ Add Variable</button>
          </div>

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
