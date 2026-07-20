import { describe, it, expect } from 'vitest'
import { negotiateFormat } from '../src/format'
import type { NormalizedParams } from '../src/types'

describe('negotiateFormat', () => {
  it('uses explicit fmt param over accept header', () => {
    const p: NormalizedParams = { format: 'png' }
    const result = negotiateFormat('image/webp', 'jpeg', false, p)
    expect(result.format).toBe('png')
  })

  it('prefers avif over webp in accept header', () => {
    const p: NormalizedParams = {}
    const result = negotiateFormat('image/avif,image/webp', 'jpeg', false, p)
    expect(result.format).toBe('avif')
  })

  it('prefers webp over jpeg in accept header', () => {
    const p: NormalizedParams = {}
    const result = negotiateFormat('image/webp,*/*', 'jpeg', false, p)
    expect(result.format).toBe('webp')
  })

  it('skips avif and webp when source has alpha and format does not support it', () => {
    // JPEG doesn't support alpha, so if Accept only has image/webp and image/jpeg,
    // but source has alpha, we should fall back to something that supports alpha
    const p: NormalizedParams = {}
    const result = negotiateFormat('image/webp,image/jpeg', 'png', true, p)
    expect(result.format).toBe('webp') // webp supports alpha
  })

  it('falls back to source format when no accept header', () => {
    const p: NormalizedParams = {}
    const result = negotiateFormat(undefined, 'jpeg', false, p)
    expect(result.format).toBe('jpeg')
  })

  it('applies default quality of 80 when not specified', () => {
    const p: NormalizedParams = {}
    const result = negotiateFormat(undefined, 'jpeg', false, p)
    expect(result.quality).toBe(80)
  })

  it('uses specified quality from params', () => {
    const p: NormalizedParams = { quality: 50 }
    const result = negotiateFormat(undefined, 'jpeg', false, p)
    expect(result.quality).toBe(50)
  })

  it('handles Accept wildcard image/*', () => {
    const p: NormalizedParams = {}
    const result = negotiateFormat('image/*', 'jpeg', false, p)
    expect(result.format).toBe('avif') // best match in priority list
  })
  it('handles Accept */* with explicit source preference', () => {
    const p: NormalizedParams = {}
    const result = negotiateFormat('*/*', 'png', false, p)
    expect(result.format).toBe('avif') // top priority
  })
  it('falls back to source when Accept has no matching format for alpha', () => {
    const p: NormalizedParams = {}
    const result = negotiateFormat('image/webp', 'png', true, p)
    expect(result.format).toBe('webp')
  })
})
