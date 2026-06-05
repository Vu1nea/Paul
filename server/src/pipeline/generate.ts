import type { Pipeline, FetchStep, ConnectorRow } from './types'
import { generateFetchStep } from './steps/fetch'
import { generatePickStep } from './steps/pick'
import { generateRenameStep } from './steps/rename'
import { generateMergeStep } from './steps/merge'
import { generateMathStep } from './steps/math'
import { generateOutputStep } from './steps/output'

/**
 * Parses a pipeline JSON string, resolves any connector references, and returns
 * a runnable JS script string suitable for execution in the VM sandbox.
 */
export function buildScriptFromJson(
  pipelineJson: string,
  getConnector: (id: string) => ConnectorRow | undefined
): string {
  const pipeline = JSON.parse(pipelineJson) as Pipeline
  const resolvedSteps = pipeline.steps.map(step => {
    if (step.type !== 'fetch' || !step.connector_id) return step
    const connector = getConnector(step.connector_id)
    if (!connector) return step
    return resolveConnectorStep(step as FetchStep, connector)
  })
  return generateScript({ steps: resolvedSteps })
}

/**
 * Replaces `{name}` placeholders in a template string using the provided map.
 * Unresolved placeholders are left as-is.
 */
export function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? `{${name}}`)
}

/**
 * Merges a connector's URL template, method, headers, and body into a fetch step,
 * substituting the step's variables. Clears `connector_id` on the returned step.
 */
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

/**
 * Walks pipeline steps in order and concatenates their generated code lines.
 * Appends an implicit `return <lastStep>` if no explicit output step is present.
 */
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
