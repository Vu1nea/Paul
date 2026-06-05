import type { MergeStep } from '../types'

/** Generates a `const <id> = { alias: stepRef, ... }` JS statement that bundles multiple step results. */
export function generateMergeStep(step: MergeStep): string {
  const pairs = step.sources
    .map(s => '  ' + s.as + ': ' + s.stepId)
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}
