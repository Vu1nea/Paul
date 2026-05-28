import { useState, useEffect } from 'react'

interface Props {
  apiUrl: string
}

export default function SecretsView({ apiUrl }: Props) {
  const [keys, setKeys] = useState<string[]>([])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function loadKeys() {
    fetch(`${apiUrl}/api/secrets`)
      .then(r => r.json())
      .then(data => setKeys((data as { keys: string[] }).keys))
      .catch(() => {})
  }

  useEffect(() => { loadKeys() }, [apiUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!newKey.trim() || !newValue.trim()) return
    const res = await fetch(`${apiUrl}/api/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey.trim(), value: newValue.trim() }),
    })
    if (res.status === 409) { setError('Key already exists'); return }
    setError(null)
    setNewKey('')
    setNewValue('')
    loadKeys()
  }

  async function handleDelete(key: string) {
    if (!window.confirm(`Delete secret "${key}"? This cannot be undone.`)) return
    await fetch(`${apiUrl}/api/secrets/${encodeURIComponent(key)}`, { method: 'DELETE' })
    loadKeys()
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
      <main style={{ padding: '24px' }}>
        <h2>Secrets</h2>
        <div className="config-form" style={{ maxWidth: '400px', marginBottom: '24px' }}>
          <label>Key<input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="MY_API_KEY" /></label>
          <label>Value<input type="password" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="secret value" /></label>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button onClick={handleAdd}>Add Secret</button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {keys.map(k => (
            <li key={k} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <code>{k}</code>
              <button onClick={() => handleDelete(k)}>Delete</button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
