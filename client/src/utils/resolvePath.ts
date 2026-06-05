/**
 * Reads a value from a nested object using a dot-separated key path.
 * Returns `undefined` if any segment along the path is missing or null.
 * @example resolvePath({ a: { b: 42 } }, 'a.b') // → 42
 */
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}
