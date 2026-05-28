export interface FetchStep {
  type: 'fetch'
  id: string
  label: string
  connector_id: string | null
  url: string | null
  method: string | null
  headers: { key: string; value: string }[]
  body: string | null
  auth: { type: 'bearer' | 'apikey'; secret: string } | null
  variables: Record<string, string>
}

export interface PickStep {
  type: 'pick'
  id: string
  label: string
  sourceId: string
  fields: string[]
}

export interface RenameStep {
  type: 'rename'
  id: string
  label: string
  sourceId: string
  mappings: { from: string; to: string }[]
}

export interface MergeStep {
  type: 'merge'
  id: string
  label: string
  sources: { stepId: string; as: string }[]
}

export interface MathStep {
  type: 'math'
  id: string
  label: string
  sourceId: string
  left: string | number
  operator: '+' | '-' | '*' | '/' | '%'
  right: string | number
  outputKey: string
}

export interface OutputStep {
  type: 'output'
  id: string
  label: string
  sourceId: string
  mappings: { from: string; to: string }[]
}

export type PipelineStep = FetchStep | PickStep | RenameStep | MergeStep | MathStep | OutputStep

export interface Pipeline {
  steps: PipelineStep[]
}

export interface ConnectorRow {
  id: string
  url_template: string
  method: string
  headers_json: string
  body_template: string | null
}

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

function dotAccessor(stepId: string, path: string): string {
  return [stepId, ...path.split('.')].join('?.')
}

function leafKey(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1]
}

function operandExpr(sourceId: string, operand: string | number): string {
  if (typeof operand === 'number') return String(operand)
  return dotAccessor(sourceId, operand)
}

function generateFetchStep(step: FetchStep): string {
  const url = step.url ?? ''
  const method = step.method ?? 'GET'

  const headerLines: string[] = []
  for (const h of step.headers) {
    headerLines.push("      '" + h.key + "': '" + h.value + "'")
  }
  if (step.auth?.type === 'bearer') {
    headerLines.push("      'Authorization': `Bearer ${getSecret('" + step.auth.secret + "')}`")
  } else if (step.auth?.type === 'apikey') {
    headerLines.push("      'X-API-Key': `${getSecret('" + step.auth.secret + "')}`")
  }

  const optionParts: string[] = ["    method: '" + method + "'"]
  if (headerLines.length > 0) {
    optionParts.push('    headers: {\n' + headerLines.join(',\n') + '\n    }')
  }
  if (step.body) {
    optionParts.push('    body: ' + step.body)
  }

  return (
    'const ' + step.id + ' = await fetch(\n' +
    '  `' + url + '`,\n' +
    '  {\n' +
    optionParts.join(',\n') + '\n' +
    '  }\n' +
    ').then(r => r.json())'
  )
}

function generatePickStep(step: PickStep): string {
  const pairs = step.fields
    .map(f => '  ' + leafKey(f) + ': ' + dotAccessor(step.sourceId, f))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}

function generateRenameStep(step: RenameStep): string {
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}

function generateMergeStep(step: MergeStep): string {
  const pairs = step.sources
    .map(s => '  ' + s.as + ': ' + s.stepId)
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}

function generateMathStep(step: MathStep): string {
  const left = operandExpr(step.sourceId, step.left)
  const right = operandExpr(step.sourceId, step.right)
  return (
    'const ' + step.id + ' = {\n' +
    '  ...' + step.sourceId + ',\n' +
    '  ' + step.outputKey + ': ' + left + ' ' + step.operator + ' ' + right + '\n' +
    '}'
  )
}

function generateOutputStep(step: OutputStep): string {
  if (step.mappings.length === 0) {
    return 'return {\n  ...' + step.sourceId + '\n}'
  }
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'return {\n' + pairs + '\n}'
}

export function generateScript(pipeline: Pipeline): string {
  const lines: string[] = []
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
  return lines.join('\n')
}
