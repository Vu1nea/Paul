import type { PickStep } from '../types'

function dotAccessor(stepId: string, path: string): string {
  return [stepId, ...path.split('.')].join('?.')
}

function leafKey(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1]
}

export function generatePickStep(step: PickStep): string {
  const pairs = step.fields
    .map(f => '  ' + leafKey(f) + ': ' + dotAccessor(step.sourceId, f))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}
