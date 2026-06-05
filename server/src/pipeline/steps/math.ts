import type { MathStep } from '../types'
import { operandExpr } from '../utils'

/** Generates a `const <id> = { ...source, outputKey: left op right }` JS statement for a math step. */
export function generateMathStep(step: MathStep): string {
  const left = operandExpr(step.sourceId, step.left)
  const right = operandExpr(step.sourceId, step.right)
  return (
    'const ' + step.id + ' = {\n' +
    '  ...' + step.sourceId + ',\n' +
    '  ' + step.outputKey + ': ' + left + ' ' + step.operator + ' ' + right + '\n' +
    '}'
  )
}
