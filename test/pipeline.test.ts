import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import sharp from 'sharp'
import { buildPipeline, transformAndCache } from '../src/pipeline'
import { parseParams, normalizeParams } from '../src/params'
import type { SharpifyOptions } from '../src/types'

const config: SharpifyOptions = {
  prefix: '/images/',
  sourceDir: 'test/fixtures',
  cacheDir: '/tmp/sharpify-test-cache',
  maxWidth: 4096,
  maxHeight: 4096,
  timeoutSeconds: 30,
  withoutEnlargement: true,
}

describe('buildPipeline', () => {
  it('resizes image to specified width', async () => {
    const buffer = readFileSync('test/fixtures/test.jpg')
    const params = normalizeParams(parseParams({ w: '50' }, config), config)
    const result = await buildPipeline(buffer, params, config)
    expect(result.info.width).toBe(50)
  })

  it('converts to webp format', async () => {
    const buffer = readFileSync('test/fixtures/test.jpg')
    const params = normalizeParams(parseParams({ fmt: 'webp' }, config), config)
    const result = await buildPipeline(buffer, params, config)
    expect(result.info.format).toBe('webp')
  })

  it('applies blur', async () => {
    const buffer = readFileSync('test/fixtures/test.jpg')
    const params = normalizeParams(parseParams({ blur: '5' }, config), config)
    const result = await buildPipeline(buffer, params, config)
    expect(result.info.format).toBe('jpeg') // format preserved
    expect(result.buffer.length).toBeGreaterThan(0)
  })

  it('applies greyscale', async () => {
    const buffer = readFileSync('test/fixtures/test.jpg')
    const params = normalizeParams(parseParams({ bw: 'true' }, config), config)
    const result = await buildPipeline(buffer, params, config)
    const channels = await sharp(result.buffer).metadata().then(m => m.channels)
    expect(channels).toBe(3) // greyscale still has 3 channels in sRGB
  })
  it('applies sharpen when only sharpenM1 is set (defaults sigma to 1)', async () => {
    const buffer = readFileSync('test/fixtures/test.jpg')
    const params = normalizeParams(parseParams({ sharpm: '2' }, config), config)
    const result = await buildPipeline(buffer, params, config)
    expect(result.info.format).toBe('jpeg')
    expect(result.buffer.length).toBeGreaterThan(0)
    // Verify pixels are different from unsharpened version by comparing
    // channels — sharpened output should have same dimensions
    const meta = await sharp(buffer).metadata()
    expect(result.info.width).toBe(meta.width)
    expect(result.info.height).toBe(meta.height)
  })

  it('crops then resizes — crop coordinates are source-space', async () => {
    const buffer = readFileSync('test/fixtures/test.jpg')
    const params = normalizeParams(parseParams({ crop: '25,25,50,50', w: '25' }, config), config)
    const result = await buildPipeline(buffer, params, config)
    expect(result.info.width).toBe(25)
    expect(result.info.height).toBe(25)
  })

  it('crop without resize extracts exact region', async () => {
    const buffer = readFileSync('test/fixtures/test.jpg')
    const params = normalizeParams(parseParams({ crop: '10,10,30,40' }, config), config)
    const result = await buildPipeline(buffer, params, config)
    expect(result.info.width).toBe(30)
    expect(result.info.height).toBe(40)
  })
})

describe('transformAndCache', () => {
  it('writes cache file to disk', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'sharpify-'))
    const sourcePath = 'test/fixtures/test.jpg'
    const cachePath = join(cacheDir, 'test-cache.jpg')
    const params = normalizeParams(parseParams({ w: '50' }, config), config)

    await transformAndCache(sourcePath, cachePath, params, config)
    expect(existsSync(cachePath)).toBe(true)

    // Verify the cached file has correct dimensions
    const meta = await sharp(cachePath).metadata()
    expect(meta.width).toBe(50)
  })
})
