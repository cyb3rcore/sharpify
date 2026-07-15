import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync, statSync, readFileSync, renameSync } from 'node:fs'
import type sharp from 'sharp'
import type { SharpifyOptions, NormalizedParams } from './types'
import { parseParams, normalizeParams } from './params'
import { computeCacheKey, cacheSubpath, CacheManager } from './cache'
import { negotiateFormat } from './format'
import { transformAndCache } from './pipeline'

function hasTransformParams(params: NormalizedParams): boolean {
  return params.width !== undefined
    || params.height !== undefined
    || params.format !== undefined
    || params.quality !== undefined
    || params.blur !== undefined
    || params.sharpen !== undefined
    || params.rotate !== undefined
    || params.autoOrient !== undefined
    || params.trim !== undefined
    || params.greyscale !== undefined
    || params.flip !== undefined
    || params.flop !== undefined
    || params.brightness !== undefined
    || params.saturation !== undefined
    || params.hue !== undefined
    || params.normalise !== undefined
    || params.negate !== undefined
    || params.gamma !== undefined
    || params.tint !== undefined
    || params.background !== undefined
    || params.threshold !== undefined
    || params.median !== undefined
    || params.linearMultiplier !== undefined
    || params.linearOffset !== undefined
    || params.crop !== undefined
    || params.pad !== undefined
    || params.preserveMetadata !== undefined
    || params.stripAlpha !== undefined
    || params.lossless !== undefined
    || params.progressive !== undefined
    || params.mozjpeg !== undefined
    || params.effort !== undefined
    || params.bitdepth !== undefined
    || params.palette !== undefined
    || params.fit !== undefined
    || params.position !== undefined
    || params.animated !== undefined
    || params.withoutEnlargement !== undefined
}

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
    const urlPath = decodeURIComponent(req.url).split('?')[0]
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
      return reply.sendFile(pathname, config.sourceDir)
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
      return reply.sendFile(cacheFileName, config.cacheDir)
    }

    // Cache miss — check concurrency
    if (activeOps >= (config.maxConcurrency ?? 4)) {
      // Fall back to original when saturated
      return reply.sendFile(pathname, config.sourceDir)
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

      return reply.sendFile(cacheFileName, config.cacheDir)
    } catch (err) {
      req.log.error({ err, url: req.url }, 'sharpify: transformation failed, serving original')
      // Fall back to original image on any processing error
      return reply.sendFile(pathname, config.sourceDir)
    } finally {
      activeOps--
    }
  })
}

export default fp(sharpifyPlugin, {
  name: '@cyb3rcore/sharpify',
  dependencies: ['@fastify/static'],
})
