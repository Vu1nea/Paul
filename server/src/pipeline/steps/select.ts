import type { SelectStep } from '../types'

/** Generates a `const <id> = <sourceId>[<index>]` JS statement for a select step. */
export function generateSelectStep(step: SelectStep): string {
  return 'const ' + step.id + ' = ' + step.sourceId + '[' + step.index + ']'
}
