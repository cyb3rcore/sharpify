import { describe, it, expect } from 'vitest'

import { parseParams, normalizeParams, hasTransformParams } from '../src/params'
import type { SharpifyOptions, NormalizedParams } from '../src/types'

const defaultConfig: SharpifyOptions = {
  prefix: '/images/',
  sourceDir: '/images',
  cacheDir: '/cache',
  maxWidth: 4096,
  maxHeight: 4096,
  timeoutSeconds: 30,
  withoutEnlargement: true,
}

describe('parseParams', () => {
  it('parses width and height from query', () => {
    const result = parseParams({ w: '400', h: '300' }, defaultConfig)
    expect(result.width).toBe(400)
    expect(result.height).toBe(300)
  })

  it('parses format from fmt param', () => {
    const result = parseParams({ fmt: 'webp' }, defaultConfig)
    expect(result.format).toBe('webp')
  })

  it('parses quality from q param', () => {
    const result = parseParams({ q: '85' }, defaultConfig)
    expect(result.quality).toBe(85)
  })

  it('clamps width to maxWidth', () => {
    const result = parseParams({ w: '99999' }, defaultConfig)
    expect(result.width).toBe(4096)
  })

  it('clamps height to maxHeight', () => {
    const result = parseParams({ h: '99999' }, defaultConfig)
    expect(result.height).toBe(4096)
  })

  it('handles missing params gracefully', () => {
    const result = parseParams({}, defaultConfig)
    expect(result.width).toBeUndefined()
    expect(result.quality).toBeUndefined()
  })

  it('parses boolean flags', () => {
    const result = parseParams({ bw: 'true', flip: '1', neg: 'true' }, defaultConfig)
    expect(result.greyscale).toBe(true)
    expect(result.flip).toBe(true)
    expect(result.negate).toBe(true)
  })

  it('parses crop=left,top,width,height', () => {
    const result = parseParams({ crop: '10,20,300,400' }, defaultConfig)
    expect(result.crop).toBe('10,20,300,400')
  })

  it('parses float values for blur', () => {
    const result = parseParams({ blur: '1.5' }, defaultConfig)
    expect(result.blur).toBe(1.5)
  })
  it('parses float values for brightness', () => {
    const result = parseParams({ bri: '1.5' }, defaultConfig)
    expect(result.brightness).toBe(1.5)
  })
  it('parses float saturation (0.5)', () => {
    const result = parseParams({ sat: '0.5' }, defaultConfig)
    expect(result.saturation).toBe(0.5)
  })
  it('parses float gamma', () => {
    const result = parseParams({ gam: '2.2' }, defaultConfig)
    expect(result.gamma).toBe(2.2)
  })
  it('parses float linear multiplier', () => {
    const result = parseParams({ mult: '1.5' }, defaultConfig)
    expect(result.linearMultiplier).toBe(1.5)
  })

  it('detects width as transform trigger', () => {
    expect(hasTransformParams({ width: 100 })).toBe(true)
  })
  it('detects format as transform trigger', () => {
    expect(hasTransformParams({ format: 'webp' })).toBe(true)
  })
  it('does NOT trigger on fit alone', () => {
    expect(hasTransformParams({ fit: 'cover' })).toBe(false)
  })
  it('does NOT trigger on position alone', () => {
    expect(hasTransformParams({ position: 'top' })).toBe(false)
  })
  it('does NOT trigger on empty params', () => {
    expect(hasTransformParams({})).toBe(false)
  })
  it('returns true for any trigger param', () => {
    expect(hasTransformParams({ blur: 5 })).toBe(true)
    expect(hasTransformParams({ crop: '0,0,50,50' })).toBe(true)
    expect(hasTransformParams({ greyscale: true })).toBe(true)
  })
  it('detects sharpenM1 as transform trigger', () => {
    expect(hasTransformParams({ sharpenM1: 2 })).toBe(true)
  })

})

describe('normalizeParams', () => {
  it('sets withoutEnlargement to config default when not in params', () => {
    const result = normalizeParams({ width: 400 }, defaultConfig)
    expect(result.withoutEnlargement).toBe(true)
  })

  it('caps blur sigma', () => {
    const result = normalizeParams({ blur: 9999 }, defaultConfig)
    expect(result.blur).toBe(100)
  })

  it('caps median window', () => {
    const result = normalizeParams({ median: 99 }, defaultConfig)
    expect(result.median).toBe(5)
  })
})
