import type { WidgetProps } from './WidgetBase'
import { resolvePath } from '../utils/resolvePath'

export interface ScriptConfig {
  sourceId: string
  displayKey: string
  label: string
}

export function ScriptWidget({ config, data }: WidgetProps<ScriptConfig, Record<string, unknown>>) {
  if (!data) return <div style={{ padding: '8px' }}>Loading...</div>
  if ('error' in data && typeof data.error === 'string') {
    return <div style={{ padding: '8px', color: 'red' }}>{data.error}</div>
  }
  const value = resolvePath(data, config.displayKey)
  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontSize: '12px', color: '#666' }}>{config.label}</div>
      <div style={{ fontSize: '20px', marginTop: '4px' }}>
        {value !== undefined ? String(value) : 'Key not found'}
      </div>
    </div>
  )
}
