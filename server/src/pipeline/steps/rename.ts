import type { RenameStep } from '../types'

function dotAccessor(stepId: string, path: string): string {
  return [stepId, ...path.split('.')].join('?.')
}

export function generateRenameStep(step: RenameStep): string {
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}
