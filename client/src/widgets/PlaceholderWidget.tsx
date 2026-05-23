import type { WidgetProps } from './WidgetBase'

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
