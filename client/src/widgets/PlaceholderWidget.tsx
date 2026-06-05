import type { WidgetProps } from './WidgetBase'

/** Debug widget — dumps raw config and data props as formatted JSON. Used as a fallback for unknown widget types. */
export function PlaceholderWidget({ config, data }: WidgetProps) {
  return (
    <div style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px', overflow: 'auto' }}>
      <div><strong>config:</strong></div>
      <pre>{JSON.stringify(config, null, 2)}</pre>
      <div><strong>data:</strong></div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
