import type { NormalizedParams, FormatResult } from './types'

const FORMAT_PRIORITY: Array<{
  format: string
  mime: string
  supportsAlpha: boolean
}> = [
  { format: 'avif', mime: 'image/avif', supportsAlpha: true },
  { format: 'webp', mime: 'image/webp', supportsAlpha: true },
  { format: 'jpeg', mime: 'image/jpeg', supportsAlpha: false },
  { format: 'png', mime: 'image/png', supportsAlpha: true },
  { format: 'gif', mime: 'image/gif', supportsAlpha: true },
  { format: 'tiff', mime: 'image/tiff', supportsAlpha: true },
]

const SOURCE_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
}

export function negotiateFormat(
  acceptHeader: string | undefined,
  sourceFormat: string,
  hasAlpha: boolean,
  params: NormalizedParams
): FormatResult {
  // Explicit format wins
  if (params.format) {
    const codec = FORMAT_PRIORITY.find(f => f.format === params.format)
    if (codec) {
      return {
        format: codec.format,
        quality: params.quality ?? 80,
        options: {},
        contentType: codec.mime,
      }
    }
  }

  const accept = acceptHeader ?? ''
  const parsedAccept = accept.split(',').map(a => a.trim().toLowerCase())

  // First pass: specific MIME match (no wildcards)
  for (const codec of FORMAT_PRIORITY) {
    if (hasAlpha && !codec.supportsAlpha) continue
    const specificMatch = parsedAccept.some(a => a.startsWith(codec.mime))
    if (specificMatch && accept) {
      return {
        format: codec.format,
        quality: params.quality ?? 80,
        options: {},
        contentType: codec.mime,
      }
    }
  }

  // Second pass: wildcard match (*/*, image/*)
  for (const codec of FORMAT_PRIORITY) {
    if (hasAlpha && !codec.supportsAlpha) continue
    const wildcardMatch = parsedAccept.some(a => a === '*/*' || a.startsWith('image/*'))
    if (wildcardMatch && accept) {
      return {
        format: codec.format,
        quality: params.quality ?? 80,
        options: {},
        contentType: codec.mime,
      }
    }
  }

  // Fall back to source format
  const sourceMime = SOURCE_MIME[sourceFormat] ?? 'image/jpeg'
  return {
    format: sourceFormat === 'jpg' ? 'jpeg' : sourceFormat,
    quality: params.quality ?? 80,
    options: {},
    contentType: sourceMime,
  }
}

export function getFormatOptions(params: NormalizedParams, format: string): Record<string, unknown> {
  const opts: Record<string, unknown> = {}

  if (params.quality) opts.quality = params.quality
  if (params.lossless) opts.lossless = true
  if (params.progressive) opts.progressive = true
  if (params.mozjpeg) opts.mozjpeg = true
  if (params.chromaSubsampling) opts.chromaSubsampling = params.chromaSubsampling
  if (params.effort !== undefined) opts.effort = params.effort
  if (params.bitdepth !== undefined) opts.bitdepth = params.bitdepth
  if (params.palette) opts.palette = true
  if (params.compressionLevel !== undefined) opts.compressionLevel = params.compressionLevel
  if (params.preset) opts.preset = params.preset

  return opts
}
