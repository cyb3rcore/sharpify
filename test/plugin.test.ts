import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import sharpify from '../src/index'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { readFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { mkdirSync } from 'node:fs'

const fixturesDir = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

let app: ReturnType<typeof Fastify>
const tmpCache = mkdtempSync(join(tmpdir(), 'sharpify-e2e-'))

beforeAll(async () => {
  app = Fastify()

  // Register @fastify/static at root to provide reply.sendFile() decorator.
  // sharpify's /images/* route takes priority over /* for image paths.
  await app.register(fastifyStatic, {
    root: fixturesDir,
    prefix: '/',
    wildcard: true,
  })

  await app.register(sharpify, {
    prefix: '/images/',
    sourceDir: fixturesDir,
    cacheDir: tmpCache,
  })

  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('sharpify plugin', () => {
  it('serves original image when no transform params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/test.jpg',
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/jpe?g/)
  })

  it('transforms image with width param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/test.jpg?w=50',
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/jpe?g/)
    // Verify it's actually resized
    const sharp = (await import('sharp')).default
    const meta = await sharp(res.rawPayload).metadata()
    expect(meta.width).toBe(50)
  })

  it('converts to webp format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/test.jpg?fmt=webp',
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/webp')
  })

  it('caches transformed images to disk', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/test.jpg?w=25&fmt=webp&q=70',
    })
    expect(res.statusCode).toBe(200)

    // Second request should be served from cache
    const res2 = await app.inject({
      method: 'GET',
      url: '/images/test.jpg?w=25&fmt=webp&q=70',
    })
    expect(res2.statusCode).toBe(200)
    expect(res2.rawPayload.length).toBe(res.rawPayload.length)
  })

  it('returns 404 for non-existent image', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/nonexistent.jpg',
    })
    expect(res.statusCode).toBe(404)
  })

  it('handles multiple params together', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/test.png?w=100&h=100&fit=cover&bw=true',
    })
    expect(res.statusCode).toBe(200)
  })

  it('accept header negotiation serves webp', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/test.jpg?w=100',
      headers: { accept: 'image/webp,image/jpeg' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/webp')
  })

  it('serves original on transformation error', async () => {
    // crop=0,0,0,0 will cause sharp to throw (zero-dimension extract)
    const res = await app.inject({
      method: 'GET',
      url: '/images/test.jpg?crop=0,0,0,0',
    })
    // Should still get 200 with original image (not 500)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/jpe?g/)
  })

  it('rejects path traversal attempts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/images/../../../etc/passwd',
    })
    expect(res.statusCode).toBe(404)
  })

  it('handles concurrent requests without crashing', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      app.inject({ method: 'GET', url: `/images/test.jpg?w=${50 + i}` })
    )
    const results = await Promise.all(promises)
    results.forEach(r => expect(r.statusCode).toBe(200))
  })
})
