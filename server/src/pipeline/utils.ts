/** Builds an optional-chaining expression for generated code, e.g. `stepId?.a?.b`. */
export function dotAccessor(stepId: string, path: string): string {
  return [stepId, ...path.split('.')].join('?.')
}

/** Returns the final segment of a dot-path, e.g. `"a.b.c"` → `"c"`. */
export function leafKey(path: string): string {
  const parts = path.split('.')
  return parts[parts.length - 1]
}

/** Returns a numeric literal or a `dotAccessor` expression for use in generated math expressions. */
export function operandExpr(sourceId: string, operand: string | number): string {
  if (typeof operand === 'number') return String(operand)
  return dotAccessor(sourceId, operand)
}
