import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { computeCacheKey, cacheSubpath, CacheManager } from '../src/cache'

describe('computeCacheKey', () => {
  it('returns deterministic hash for same inputs', () => {
    const a = computeCacheKey('photo.jpg', { width: 400, format: 'webp', quality: 80 }, 1000)
    const b = computeCacheKey('photo.jpg', { width: 400, format: 'webp', quality: 80 }, 1000)
    expect(a).toBe(b)
  })

  it('returns different hash for different mtime', () => {
    const a = computeCacheKey('photo.jpg', { width: 400 }, 1000)
    const b = computeCacheKey('photo.jpg', { width: 400 }, 2000)
    expect(a).not.toBe(b)
  })

  it('returns different hash for different params', () => {
    const a = computeCacheKey('photo.jpg', { width: 400 }, 1000)
    const b = computeCacheKey('photo.jpg', { width: 600 }, 1000)
    expect(a).not.toBe(b)
  })

  it('handles full param set deterministically', () => {
    const params = {
      width: 200,
      height: 200,
      format: 'webp',
      quality: 80,
      blur: 5,
      sharpen: 2,
      greyscale: true,
    }
    const a = computeCacheKey('path/to/photo.jpg', params, 1742083200000)
    const b = computeCacheKey('path/to/photo.jpg', params, 1742083200000)
    expect(a).toBe(b)
  })

  it('returns 32-char hex string', () => {
    const hash = computeCacheKey('photo.jpg', { width: 400 }, 1000)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('cacheSubpath returns two-level subdirectory', () => {
    const result = cacheSubpath('a1b2c3d4e5f67890')
    expect(result).toMatch(/^[0-9a-f]{2}\/[0-9a-f]+$/)
  })
})

describe('CacheManager', () => {
  it('recordAccess tracks keys', () => {
    const cm = new CacheManager('/tmp', 1024)
    cm.recordAccess('test')
    // No throw, access tracked internally
  })

  it('prune is no-op when under maxSize', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-'))
    const cm = new CacheManager(dir, 1024 * 1024)
    const sub = join(dir, 'ab')
    mkdirSync(sub, { recursive: true })
    writeFileSync(join(sub, 'test'), 'x')
    cm.prune() // Should not delete anything
    expect(existsSync(join(sub, 'test'))).toBe(true)
  })

  it('prune removes oldest files when over maxSize', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-'))
    const cm = new CacheManager(dir, 50) // tiny max
    const sub = join(dir, 'ab')
    mkdirSync(sub, { recursive: true })
    writeFileSync(join(sub, 'old'), Buffer.alloc(40))
    // Set old file's timestamps clearly in the past so sort is deterministic
    const past = new Date(Date.now() - 60_000)
    utimesSync(join(sub, 'old'), past, past)
    writeFileSync(join(sub, 'new'), Buffer.alloc(40))
    cm.recordAccess('ab/new')
    cm.prune()
    // 'old' should be removed first (no access recorded, old atime)
    expect(existsSync(join(sub, 'new'))).toBe(true)
    expect(existsSync(join(sub, 'old'))).toBe(false)
  })
})
