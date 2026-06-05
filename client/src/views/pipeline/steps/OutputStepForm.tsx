import type { OutputStepData, AnyStep } from './types'

/**
 * Form for an output step. Defines the final shape of the pipeline's result by
 * mapping fields from a source step to top-level output keys. `from` is a
 * dot-notation field path (e.g. "weather.temperature"), `to` is the key name
 * written into the pipeline's last_output.
 */
interface Props {
  step: OutputStepData
  /** All steps except this one — any step type can be an output source. */
  otherSteps: AnyStep[]
  onChange: (patch: Partial<OutputStepData>) => void
}

export default function OutputStepForm({ step, otherSteps, onChange }: Props) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>Source
        <select value={step.sourceId} onChange={e => onChange({ sourceId: e.target.value })}>
          {otherSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      {step.mappings.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px' }}>
          <input value={m.from} placeholder="field path (e.g. weather.temp)" onChange={e => {
            const mappings = [...step.mappings]; mappings[i] = { ...m, from: e.target.value }
            onChange({ mappings })
          }} />
          <span>→</span>
          <input value={m.to} placeholder="output key" onChange={e => {
            const mappings = [...step.mappings]; mappings[i] = { ...m, to: e.target.value }
            onChange({ mappings })
          }} />
        </div>
      ))}
      <button onClick={() => onChange({ mappings: [...step.mappings, { from: '', to: '' }] })}>+ Add output field</button>
    </div>
  )
}
