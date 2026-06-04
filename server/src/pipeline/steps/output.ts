import type { OutputStep } from '../types'
import { dotAccessor } from '../utils'

export function generateOutputStep(step: OutputStep): string {
  if (step.mappings.length === 0) {
    return 'return {\n  ...' + step.sourceId + '\n}'
  }
  const pairs = step.mappings
    .map(m => '  ' + m.to + ': ' + dotAccessor(step.sourceId, m.from))
    .join(',\n')
  return 'return {\n' + pairs + '\n}'
}
