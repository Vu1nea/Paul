export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}
