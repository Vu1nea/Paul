import type { MathStep } from '../types'

function dotAccessor(stepId: string, path: string): string {
  return [stepId, ...path.split('.')].join('?.')
}

function operandExpr(sourceId: string, operand: string | number): string {
  if (typeof operand === 'number') return String(operand)
  return dotAccessor(sourceId, operand)
}

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
