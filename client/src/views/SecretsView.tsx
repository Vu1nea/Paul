import { useState, useEffect } from 'react'
import AppShell from '../AppShell'
import { getSecretKeys, createSecret, deleteSecret } from '../api'

export default function SecretsView() {
  const [keys, setKeys] = useState<string[]>([])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function loadKeys() {
    getSecretKeys().then(setKeys).catch(() => {})
  }

  useEffect(() => { loadKeys() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!newKey.trim() || !newValue.trim()) return
    const res = await createSecret(newKey.trim(), newValue.trim())
    if (res.status === 409) { setError('Key already exists'); return }
    setError(null)
    setNewKey('')
    setNewValue('')
    loadKeys()
  }

  async function handleDelete(key: string) {
    if (!window.confirm(`Delete secret "${key}"? This cannot be undone.`)) return
    await deleteSecret(key)
    loadKeys()
  }

  return (
    <AppShell>
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
    </AppShell>
  )
}
