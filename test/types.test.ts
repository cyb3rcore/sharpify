import { describe, it, expect } from 'vitest'

describe('types', () => {
  it('SharpifyOptions has required fields', () => {
    // Type check — compile-time assertion
    const opts: import('../src/types').SharpifyOptions = {
      prefix: '/images/',
      sourceDir: '/path/to/images',
      cacheDir: '/path/to/cache',
    }
    expect(opts.prefix).toBe('/images/')
  })

  it('NormalizedParams defaults are applied', () => {
    const p: import('../src/types').NormalizedParams = {}
    expect(p.width).toBeUndefined()
    expect(p.quality).toBeUndefined()
  })
})
