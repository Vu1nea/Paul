import type { Source } from '@paul/types'

/**
 * Config form for the ScriptWidget. Lets the user pick a source and then select
 * a display key from that source's last_output. Keys are derived by flattening the
 * output JSON into dot-notation paths (e.g. "weather.temperature").
 * If the source has no output yet, a refresh button triggers onRefreshSources.
 */

/** Recursively collects all leaf-node dot-notation paths from a JSON object for use as displayKey options. */
function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return prefix ? [prefix] : []
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return flattenKeys(v, path)
    return [path]
  })
}

interface Props {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  /** Available pipeline/script sources — used to populate the source dropdown and derive displayKey options. */
  sources: Source[]
  /** Called when the user wants to re-fetch sources after running a script to populate fresh output keys. */
  onRefreshSources: () => void
}

export default function ScriptWidgetConfigForm({ config, onChange, sources, onRefreshSources }: Props) {
  const selectedId = String(config.sourceId ?? '')
  const src = sources.find(s => s.id === selectedId)
  const keys = src ? flattenKeys(src.last_output) : []

  function renderDisplayKeySelect() {
    if (!selectedId) return <select disabled><option>— pick a source first —</option></select>
    if (keys.length === 0) return (
      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select disabled><option>— no output yet —</option></select>
        <button type="button" onClick={onRefreshSources}>↻</button>
      </span>
    )
    return (
      <select value={String(config.displayKey ?? '')} onChange={e => onChange({ ...config, displayKey: e.target.value })}>
        <option value="">— select a key —</option>
        {keys.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
    )
  }

  return (
    <div className="config-form">
      <label>Source
        <select value={selectedId} onChange={e => onChange({ ...config, sourceId: e.target.value, displayKey: '' })}>
          <option value="">— select a source —</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label>Display Key{renderDisplayKeySelect()}</label>
      <label>Label<input value={String(config.label ?? '')} onChange={e => onChange({ ...config, label: e.target.value })} /></label>
    </div>
  )
}
