import type { FetchStep } from '../types'

function escapeSingleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function generateFetchStep(step: FetchStep): string {
  const url = step.url ?? ''
  const safeUrl = url.replace(/\$\{/g, '\\${')
  const method = step.method ?? 'GET'

  const headerLines: string[] = []
  for (const h of step.headers) {
    headerLines.push("      '" + escapeSingleQuoted(h.key) + "': '" + escapeSingleQuoted(h.value) + "'")
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
    '  `' + safeUrl + '`,\n' +
    '  {\n' +
    optionParts.join(',\n') + '\n' +
    '  }\n' +
    ').then(r => r.json())'
  )
}
