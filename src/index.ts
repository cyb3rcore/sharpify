import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync, statSync, readFileSync, renameSync } from 'node:fs'
import type sharp from 'sharp'
import type { SharpifyOptions, NormalizedParams } from './types'
import '@fastify/static'
import { parseParams, normalizeParams, hasTransformParams } from './params'
import { computeCacheKey, cacheSubpath, CacheManager } from './cache'
import { negotiateFormat } from './format'
import { transformAndCache } from './pipeline'


async function sharpifyPlugin(fastify: FastifyInstance, opts: SharpifyOptions) {
  // Check sharp availability at registration time (before route handler)
  let sharpInstance: typeof sharp
  try {
    sharpInstance = (await import('sharp')).default
  } catch {
    throw new Error('@cyb3rcore/sharpify: sharp is not available. Install it: npm install sharp')
  }

  const config: SharpifyOptions = {
    maxWidth: 4096,
    maxHeight: 4096,
    timeoutSeconds: 30,
    maxConcurrency: 4,
    withoutEnlargement: true,
    maxCacheSize: 1024 * 1024 * 1024,
    ...opts,
  }

  mkdirSync(config.cacheDir, { recursive: true })

  const cacheManager = new CacheManager(config.cacheDir, config.maxCacheSize)
  let activeOps = 0

  fastify.get(`${config.prefix}*`, async (req: FastifyRequest, reply: FastifyReply) => {
    const prefix = config.prefix.endsWith('/') ? config.prefix : config.prefix + '/'
    let urlPath: string
    try {
      urlPath = decodeURIComponent(req.url).split('?')[0]
    } catch {
      return reply.code(400).send({ error: 'Malformed URL' })
    }
    const pathname = urlPath.startsWith(prefix)
      ? urlPath.slice(prefix.length - 1)
      : urlPath.slice(config.prefix.length)

    // Security: prevent path traversal
    if (pathname.includes('..')) {
      return reply.code(404).send()
    }

    const sourcePath = join(config.sourceDir, pathname)
    if (!sourcePath.startsWith(config.sourceDir)) {
      return reply.code(404).send()
    }

    const rawParams = req.query as Record<string, string | string[]>
    const parsed = parseParams(rawParams, config)
    const params = normalizeParams(parsed, config)

    // No transform params → serve original
    if (!hasTransformParams(params)) {
      reply.header('Cache-Control', 'public, no-cache')
      return reply.sendFile(pathname, config.sourceDir, { cacheControl: false })
    }

    // Compute cache key
    let sourceMtime: number
    try {
      sourceMtime = statSync(sourcePath).mtimeMs
    } catch {
      return reply.code(404).send()
    }

    const cacheKey = computeCacheKey(pathname, params, sourceMtime)

    // Read source metadata for alpha detection BEFORE format negotiation
    // This ensures cache file extension matches actual content
    let sourceHasAlpha = false
    let sourceFormatActual = pathname.split('.').pop() ?? 'jpeg'
    let srcBuf: Buffer
    try {
      srcBuf = readFileSync(sourcePath)
      const meta = await sharpInstance(srcBuf).metadata()
      sourceHasAlpha = meta.channels === 4 || (meta.hasAlpha ?? false)
      sourceFormatActual = meta.format ?? sourceFormatActual
    } catch {
      return reply.code(404).send()
    }

    const fmt = negotiateFormat(
      req.headers.accept as string | undefined,
      sourceFormatActual,
      sourceHasAlpha,
      params
    )
    // Propagate negotiated format so buildPipeline uses it for encoding
    params.format = fmt.format
    const ext = fmt.format === 'jpeg' ? 'jpg' : fmt.format
    const cacheDirRel = cacheSubpath(cacheKey)
    const cacheFileName = `${cacheDirRel}.${ext}`
    const cacheFilePath = join(config.cacheDir, cacheFileName)

    // Cache hit → serve cached
    if (existsSync(cacheFilePath)) {
      cacheManager.recordAccess(cacheFileName)
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
      return reply.sendFile(cacheFileName, config.cacheDir, { cacheControl: false })
    }

    // Cache miss — check concurrency
    if (activeOps >= (config.maxConcurrency ?? 4)) {
      // Fall back to original when saturated
      reply.header('Cache-Control', 'public, no-cache')
      return reply.sendFile(pathname, config.sourceDir, { cacheControl: false })
    }

    activeOps++
    try {
      // Atomic write: write to .tmp then rename
      const tmpPath = cacheFilePath + '.tmp.' + process.pid
      await transformAndCache(sourcePath, tmpPath, params, config, srcBuf)
      mkdirSync(dirname(cacheFilePath), { recursive: true })
      renameSync(tmpPath, cacheFilePath)
      cacheManager.recordAccess(cacheFileName)
      cacheManager.prune()
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')

      return reply.sendFile(cacheFileName, config.cacheDir, { cacheControl: false })
    } catch (err) {
      req.log.error({ err, url: req.url }, 'sharpify: transformation failed, serving original')
      // Fall back to original image on any processing error
      reply.header('Cache-Control', 'public, no-cache')
      return reply.sendFile(pathname, config.sourceDir, { cacheControl: false })
    } finally {
      activeOps--
    }
  })
}

export default fp(sharpifyPlugin, {
  name: '@cyb3rcore/sharpify',
  dependencies: ['@fastify/static'],
})
