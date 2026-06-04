import type { Pipeline, FetchStep, ConnectorRow } from './types'
import { generateFetchStep } from './steps/fetch'
import { generatePickStep } from './steps/pick'
import { generateRenameStep } from './steps/rename'
import { generateMergeStep } from './steps/merge'
import { generateMathStep } from './steps/math'
import { generateOutputStep } from './steps/output'

export function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? `{${name}}`)
}

export function resolveConnectorStep(step: FetchStep, connector: ConnectorRow): FetchStep {
  const sub = (t: string) => substituteVariables(t, step.variables)
  const headers = JSON.parse(connector.headers_json) as { key: string; value: string }[]
  return {
    ...step,
    connector_id: null,
    url: sub(connector.url_template),
    method: connector.method,
    headers: headers.map(h => ({ key: h.key, value: sub(h.value) })),
    body: connector.body_template ? sub(connector.body_template) : null,
  }
}

export function generateScript(pipeline: Pipeline): string {
  const lines: string[] = []
  const hasOutput = pipeline.steps.some(s => s.type === 'output')
  for (const step of pipeline.steps) {
    switch (step.type) {
      case 'fetch':  lines.push(generateFetchStep(step));  break
      case 'pick':   lines.push(generatePickStep(step));   break
      case 'rename': lines.push(generateRenameStep(step)); break
      case 'merge':  lines.push(generateMergeStep(step));  break
      case 'math':   lines.push(generateMathStep(step));   break
      case 'output': lines.push(generateOutputStep(step)); break
    }
  }
  if (!hasOutput && pipeline.steps.length > 0) {
    const lastStep = pipeline.steps[pipeline.steps.length - 1]
    lines.push('return ' + lastStep.id)
  }
  return lines.join('\n')
}
