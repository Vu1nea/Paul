import type { PickStep } from '../types'
import { dotAccessor, leafKey } from '../utils'

/** Generates a `const <id> = { field: source?.field, ... }` JS statement for a pick step. */
export function generatePickStep(step: PickStep): string {
  const pairs = step.fields
    .map(f => '  ' + leafKey(f) + ': ' + dotAccessor(step.sourceId, f))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}
