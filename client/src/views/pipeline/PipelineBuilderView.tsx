import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import AppShell from '../../AppShell'
import { getSource, updateSource, deleteSource, runSource, getConnectors } from '../../api'
import type { Connector } from '@paul/types'
import { newStep } from './steps/types'
import type { AnyStep, FetchStepData, Variable } from './steps/types'
import FetchStepForm from './steps/FetchStepForm'
import PickStepForm from './steps/PickStepForm'
import RenameStepForm from './steps/RenameStepForm'
import MergeStepForm from './steps/MergeStepForm'
import MathStepForm from './steps/MathStepForm'
import OutputStepForm from './steps/OutputStepForm'

interface Props { sourceId: string }

export default function PipelineBuilderView({ sourceId }: Props) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('*/5 * * * *')
  const [steps, setSteps] = useState<AnyStep[]>([])
  const [generatedScript, setGeneratedScript] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [output, setOutput] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    getSource(sourceId).then(data => {
      setName(data.name)
      setSchedule(data.schedule)
      setGeneratedScript(data.script ?? '')
      if (data.pipeline_json) setSteps((JSON.parse(data.pipeline_json) as { steps: AnyStep[] }).steps)
    })
    getConnectors().then(setConnectors)
  }, [sourceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateStep(id: string, patch: Partial<AnyStep>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } as AnyStep : s))
    setHasUnsavedChanges(true)
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setSteps(prev => {
      const arr = [...prev]
      const tmp = arr[idx]; arr[idx] = arr[idx + dir]; arr[idx + dir] = tmp
      return arr
    })
    setHasUnsavedChanges(true)
  }

  async function handleSave() {
    const pipeline_json = JSON.stringify({ steps })
    const ok = await updateSource(sourceId, { name, schedule, pipeline_json })
    if (ok) {
      const updated = await getSource(sourceId)
      setGeneratedScript(updated.script ?? '')
      setHasUnsavedChanges(false)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    }
  }

  async function handleRun() {
    setRunning(true)
    const data = await runSource(sourceId)
    setOutput(data.output)
    setRunning(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteSource(sourceId)
    window.location.search = '?view=scripts'
  }

  async function handleSwitchToCode() {
    if (!window.confirm("This will replace the pipeline with the generated code. You won't be able to switch back.")) return
    await updateSource(sourceId, { name, schedule, script: generatedScript })
    window.location.search = '?view=scripts'
  }

  function addStep(type: AnyStep['type'], connectorId?: string) {
    const id = 'step_' + crypto.randomUUID().slice(0, 8)
    const fetchStepIds = steps.filter(s => s.type === 'fetch').map(s => s.id)
    const step = newStep(type, id, fetchStepIds)
    if (type === 'fetch' && connectorId) {
      const connector = connectors.find(c => c.id === connectorId)
      if (connector) {
        const variables: Record<string, string> = {}
        const vars = JSON.parse(connector.variables_json) as Variable[]
        vars.forEach(v => { variables[v.name] = '' })
        ;(step as FetchStepData).connector_id = connectorId
        ;(step as FetchStepData).variables = variables
        ;(step as FetchStepData).label = connector.name
      }
    }
    setSteps(prev => [...prev, step])
    setExpandedId(id)
    setShowAddPicker(false)
    setHasUnsavedChanges(true)
  }

  function renderStepForm(step: AnyStep) {
    const fetchSteps = steps.filter(s => s.type === 'fetch')
    const otherSteps = steps.filter(s => s.id !== step.id)
    const onChange = (patch: Partial<AnyStep>) => updateStep(step.id, patch)

    switch (step.type) {
      case 'fetch':  return <FetchStepForm step={step} connectors={connectors} onChange={patch => onChange(patch)} />
      case 'pick':   return <PickStepForm step={step} fetchSteps={fetchSteps} onChange={patch => onChange(patch)} />
      case 'rename': return <RenameStepForm step={step} otherSteps={otherSteps} onChange={patch => onChange(patch)} />
      case 'merge':  return <MergeStepForm step={step} fetchSteps={fetchSteps} onChange={patch => onChange(patch)} />
      case 'math':   return <MathStepForm step={step} otherSteps={otherSteps} onChange={patch => onChange(patch)} />
      case 'output': return <OutputStepForm step={step} otherSteps={otherSteps} onChange={patch => onChange(patch)} />
    }
  }

  return (
    <AppShell>
      <main style={{ padding: '24px', maxWidth: '720px' }}>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          Name<input value={name} onChange={e => { setName(e.target.value); setHasUnsavedChanges(true) }} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
        </label>
        <label style={{ display: 'block', marginBottom: '16px' }}>
          Schedule (cron)<input value={schedule} onChange={e => { setSchedule(e.target.value); setHasUnsavedChanges(true) }} style={{ display: 'block', width: '100%', marginTop: '4px' }} />
        </label>

        <div style={{ marginBottom: '16px' }}>
          {steps.map((step, idx) => (
            <div key={step.id} style={{ border: '1px solid #333', borderRadius: '4px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', gap: '8px' }}
                onClick={() => setExpandedId(expandedId === step.id ? null : step.id)}>
                <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>{step.type}</span>
                <input value={step.label} style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '14px' }}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateStep(step.id, { label: e.target.value })} />
                <button onClick={e => { e.stopPropagation(); moveStep(idx, -1) }} disabled={idx === 0}>↑</button>
                <button onClick={e => { e.stopPropagation(); moveStep(idx, 1) }} disabled={idx === steps.length - 1}>↓</button>
                <button onClick={e => { e.stopPropagation(); setSteps(prev => prev.filter(s => s.id !== step.id)); setHasUnsavedChanges(true) }}>×</button>
              </div>
              {expandedId === step.id && renderStepForm(step)}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <button onClick={() => setShowAddPicker(p => !p)}>+ Add Step</button>
          {showAddPicker && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: '#7a7a7a', border: '1px solid #444', borderRadius: '4px', padding: '8px', zIndex: 10, minWidth: '200px' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px', padding: '4px 8px' }}>Step type</div>
              {(['pick', 'rename', 'merge', 'math', 'output'] as const).map(type => (
                <button key={type} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                  onClick={() => addStep(type)}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>
              ))}
              <div style={{ borderTop: '1px solid #444', marginTop: '8px', paddingTop: '8px', fontWeight: 500, padding: '4px 8px' }}>Fetch</div>
              {connectors.map(c => (
                <button key={c.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                  onClick={() => addStep('fetch', c.id)}>{c.name}</button>
              ))}
              <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none' }}
                onClick={() => addStep('fetch')}>Custom HTTP Request</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <button onClick={handleRun} disabled={running || hasUnsavedChanges} title={hasUnsavedChanges ? 'Save before running' : undefined}>{running ? 'Running...' : 'Run Now'}</button>
          <button onClick={handleSave}>Save</button>
          {savedMsg && <span style={{ color: '#4a4' }}>Saved</span>}
          {hasUnsavedChanges && <span style={{ color: '#fa0', fontSize: '12px' }}>Unsaved changes</span>}
          <button onClick={() => setShowCode(p => !p)}>View Generated Code</button>
          <button onClick={handleDelete} style={{ marginLeft: 'auto', color: '#f44' }}>Delete</button>
        </div>

        {output !== null && (
          <pre style={{ background: '#1a1a1a', padding: '12px', borderRadius: '4px', color: typeof output === 'object' && output !== null && 'error' in output ? '#f44' : 'white', marginBottom: '12px' }}>
            {JSON.stringify(output, null, 2)}
          </pre>
        )}

        {showCode && (
          <div style={{ border: '1px solid #333', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
              <button onClick={handleSwitchToCode} style={{ color: '#fa0' }}>Switch to Code Mode</button>
            </div>
            <Editor height="300px" language="javascript" theme="vs-dark" value={generatedScript} options={{ readOnly: true }} />
          </div>
        )}
      </main>
    </AppShell>
  )
}
