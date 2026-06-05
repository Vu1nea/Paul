import type { WidgetProps } from './WidgetBase'
import { resolvePath } from '../utils/resolvePath'

/**
 * Displays a single value from a script or pipeline source's last_output.
 * The value is resolved from the output JSON using a dot-notation path (displayKey).
 * Shows a red error message if the source data could not be loaded from the API.
 */
export interface ScriptConfig {
  /** ID of the pipeline/script source whose last output is displayed. */
  sourceId: string
  /** Dot-notation path into the source's last_output JSON (resolved via resolvePath). */
  displayKey: string
  /** Human-readable label shown above the value on the widget. */
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
