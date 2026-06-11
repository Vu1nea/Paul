import type { SelectStepData, AnyStep } from './types'

interface Props {
  step: SelectStepData
  /** Only fetch steps are valid sources for select — same restriction as Pick. */
  fetchSteps: AnyStep[]
  onChange: (patch: Partial<SelectStepData>) => void
}

export default function SelectStepForm({ step, fetchSteps, onChange }: Props) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>Source
        <select value={step.sourceId} onChange={e => onChange({ sourceId: e.target.value })}>
          {fetchSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>Index (0 = first element)
        <input
          type="number"
          min={0}
          value={step.index}
          onChange={e => onChange({ index: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        />
      </label>
    </div>
  )
}
