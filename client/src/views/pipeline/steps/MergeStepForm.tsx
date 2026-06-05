import type { MergeStepData, AnyStep } from './types'

interface Props {
  step: MergeStepData
  fetchSteps: AnyStep[]
  onChange: (patch: Partial<MergeStepData>) => void
}

export default function MergeStepForm({ step, fetchSteps, onChange }: Props) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {step.sources.map((src, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={src.stepId} onChange={e => {
            const sources = [...step.sources]; sources[i] = { ...src, stepId: e.target.value }
            onChange({ sources })
          }}>
            {fetchSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <span>as</span>
          <input value={src.as} placeholder="namespace" onChange={e => {
            const sources = [...step.sources]; sources[i] = { ...src, as: e.target.value }
            onChange({ sources })
          }} />
        </div>
      ))}
    </div>
  )
}
