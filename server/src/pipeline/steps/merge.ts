import type { MergeStep } from '../types'

export function generateMergeStep(step: MergeStep): string {
  const pairs = step.sources
    .map(s => '  ' + s.as + ': ' + s.stepId)
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}
