import type { RenameStepData, AnyStep } from './types'

/**
 * Form for a rename step. Each mapping renames one key in the source's output:
 * `from` is the existing key name, `to` is the desired new name.
 */
interface Props {
  step: RenameStepData
  /** All steps except this one — any step type can be a rename source. */
  otherSteps: AnyStep[]
  onChange: (patch: Partial<RenameStepData>) => void
}

export default function RenameStepForm({ step, otherSteps, onChange }: Props) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>Source
        <select value={step.sourceId} onChange={e => onChange({ sourceId: e.target.value })}>
          {otherSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      {step.mappings.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px' }}>
          <input value={m.from} placeholder="old key" onChange={e => {
            const mappings = [...step.mappings]; mappings[i] = { ...m, from: e.target.value }
            onChange({ mappings })
          }} />
          <span>→</span>
          <input value={m.to} placeholder="new name" onChange={e => {
            const mappings = [...step.mappings]; mappings[i] = { ...m, to: e.target.value }
            onChange({ mappings })
          }} />
        </div>
      ))}
      <button onClick={() => onChange({ mappings: [...step.mappings, { from: '', to: '' }] })}>+ Add mapping</button>
    </div>
  )
}
