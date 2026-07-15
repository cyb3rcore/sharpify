import { describe, it, expect } from 'vitest'
import { parseParams, normalizeParams } from '../src/params'
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
