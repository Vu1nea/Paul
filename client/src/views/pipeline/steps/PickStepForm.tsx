import type { PickStepData, AnyStep } from './types'

interface Props {
  step: PickStepData
  fetchSteps: AnyStep[]
  onChange: (patch: Partial<PickStepData>) => void
}

export default function PickStepForm({ step, fetchSteps, onChange }: Props) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>Source
        <select value={step.sourceId} onChange={e => onChange({ sourceId: e.target.value })}>
          {fetchSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>Fields (dot-notation, one per line)
        <textarea value={step.fields.join('\n')} rows={4}
          onChange={e => onChange({ fields: e.target.value.split('\n') })}
          onBlur={e => onChange({ fields: e.target.value.split('\n').filter(Boolean) })} />
      </label>
    </div>
  )
}
