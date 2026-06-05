import type { MathStepData, AnyStep } from './types'

interface Props {
  step: MathStepData
  otherSteps: AnyStep[]
  onChange: (patch: Partial<MathStepData>) => void
}

export default function MathStepForm({ step, otherSteps, onChange }: Props) {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>Source
        <select value={step.sourceId} onChange={e => onChange({ sourceId: e.target.value })}>
          {otherSteps.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input value={step.left} placeholder="field or number" onChange={e => onChange({ left: e.target.value })} />
        <select value={step.operator} onChange={e => onChange({ operator: e.target.value })}>
          {['+', '-', '*', '/', '%'].map(op => <option key={op}>{op}</option>)}
        </select>
        <input value={step.right} placeholder="field or number" onChange={e => onChange({ right: e.target.value })} />
      </div>
      <label>Output key<input value={step.outputKey} onChange={e => onChange({ outputKey: e.target.value })} /></label>
    </div>
  )
}
