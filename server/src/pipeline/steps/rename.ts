import type { RenameStep } from '../types'
import { dotAccessor } from '../utils'

/** Generates a `const <id> = { newKey: source?.oldKey, ... }` JS statement for a rename step. */
export function generateRenameStep(step: RenameStep): string {
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}
