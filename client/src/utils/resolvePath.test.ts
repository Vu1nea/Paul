import { describe, it, expect } from 'vitest'
import { resolvePath } from './resolvePath'

describe('resolvePath', () => {
  it('resolves a top-level key', () => {
    expect(resolvePath({ a: 1 }, 'a')).toBe(1)
  })

  it('resolves a nested path', () => {
    expect(resolvePath({ weather: { temp: 72 } }, 'weather.temp')).toBe(72)
  })

  it('returns undefined for missing path', () => {
    expect(resolvePath({ a: 1 }, 'b.c')).toBeUndefined()
  })

  it('handles deeply nested paths', () => {
    expect(resolvePath({ a: { b: { c: 'deep' } } }, 'a.b.c')).toBe('deep')
  })
})
