import type { RenameStep } from '../types'
import { dotAccessor } from '../utils'

export function generateRenameStep(step: RenameStep): string {
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'const ' + step.id + ' = {\n' + pairs + '\n}'
}
