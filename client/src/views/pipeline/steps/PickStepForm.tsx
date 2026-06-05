import type { PickStepData, AnyStep } from './types'

/**
 * Form for a pick step. Lets the user select which fields to keep from a fetch
 * step's output. Fields are entered as dot-notation paths, one per line
 * (e.g. "weather.temperature"). Blank lines are stripped on blur.
 */
interface Props {
  step: PickStepData
  /** Only fetch steps are valid sources for pick — other step types are excluded. */
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
