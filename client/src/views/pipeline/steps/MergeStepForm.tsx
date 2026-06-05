import type { MergeStepData, AnyStep } from './types'

/**
 * Form for a merge step. Combines multiple fetch step outputs into a single object
 * by nesting each under a namespace key. For example, sources
 * [{ stepId: 'a', as: 'weather' }, { stepId: 'b', as: 'stock' }] produce
 * { weather: <step a output>, stock: <step b output> }.
 */
interface Props {
  step: MergeStepData
  /** Only fetch steps are valid merge sources — each is nested under its `as` namespace key. */
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
