export function dotAccessor(stepId: string, path: string): string {
  return [stepId, ...path.split('.')].join('?.')
}

export function leafKey(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1]
}

export function operandExpr(sourceId: string, operand: string | number): string {
  if (typeof operand === 'number') return String(operand)
  return dotAccessor(sourceId, operand)
}
