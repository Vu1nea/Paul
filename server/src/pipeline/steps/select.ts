import type { SelectStep } from '../types'

/** Generates a `const <id> = <sourceId>[<index>]` JS statement for a select step. */
export function generateSelectStep(step: SelectStep): string {
  const idx = Math.max(0, Math.trunc(Number(step.index) || 0))
  return 'const ' + step.id + ' = ' + step.sourceId + '[' + idx + ']'
}
