import type { SharpifyOptions, NormalizedParams } from './types'

export function parseParams(
  query: Record<string, string | string[]>,
  config: SharpifyOptions
): NormalizedParams {
  const p: NormalizedParams = {}

  const str = (key: string): string | undefined => {
    const v = query[key]
    return Array.isArray(v) ? v[0] : v
  }
  const num = (key: string): number | undefined => {
    const s = str(key)
    if (s === undefined) return undefined
    const n = parseFloat(s)
    return isNaN(n) ? undefined : n
  }
  const bool = (key: string): boolean | undefined => {
    const s = str(key)
    if (s === undefined) return undefined
    return s === 'true' || s === '1' || s === ''
  }

  p.width = clamp(num('w'), config.maxWidth ?? 4096)
  p.height = clamp(num('h'), config.maxHeight ?? 4096)
  p.format = str('fmt')
  p.quality = num('q')
  p.fit = str('fit') ?? str('f')
  p.position = str('pos') ?? str('p')
  p.withoutEnlargement = bool('we') ?? config.withoutEnlargement

  p.sharpen = num('sharp')
  p.sharpenM1 = num('sharpm')
  p.blur = num('blur')
  p.rotate = num('rot')
  p.autoOrient = bool('or')
  p.trim = bool('trim')
  p.trimThreshold = num('trimt')
  p.greyscale = bool('bw')
  p.flip = bool('flip')
  p.flop = bool('flop')
  p.brightness = num('bri')
  p.saturation = num('sat')
  p.hue = num('hue')
  p.normalise = bool('con')
  p.negate = bool('neg')
  p.gamma = num('gam')
  p.tint = str('tint')
  p.background = str('bg')
  p.threshold = num('thresh')
  p.median = num('median')
  p.linearMultiplier = num('mult')
  p.linearOffset = num('offset')
  p.crop = str('crop')
  p.pad = str('pad')
  p.preserveMetadata = bool('meta')
  p.stripAlpha = bool('strip-alpha')
  p.lossless = bool('lossless')
  p.animated = bool('anim')
  p.progressive = bool('progressive')
  p.mozjpeg = bool('mozjpeg')
  p.chromaSubsampling = str('chroma')
  p.effort = num('effort')
  p.bitdepth = num('bitdepth')
  p.palette = bool('palette')
  p.compressionLevel = num('compression')
  p.preset = str('preset')
  p.timeout = num('timeout')
  p.failOn = str('failOn') ?? str('failon')

  return p
}

export function normalizeParams(
  params: NormalizedParams,
  config: SharpifyOptions
): NormalizedParams {
  const p = { ...params }

  // Apply security caps
  if (p.blur !== undefined) p.blur = Math.min(p.blur, 100)
  if (p.median !== undefined) p.median = Math.min(p.median, 5)
  if (p.sharpen !== undefined) p.sharpen = Math.min(p.sharpen, 10)
  if (p.timeout !== undefined) p.timeout = Math.min(p.timeout, 120)

  // Validate failOn
  const validFailOn = ['none', 'truncated', 'error', 'warning']
  if (p.failOn !== undefined && !validFailOn.includes(p.failOn)) {
    p.failOn = 'error'
  }

  // Ensure defaults
  if (p.withoutEnlargement === undefined) p.withoutEnlargement = true

  return p
}

function clamp(value: number | undefined, max: number): number | undefined {
  if (value === undefined) return undefined
  return Math.min(Math.max(value, 1), max)
}

const TRANSFORM_TRIGGERS: Array<keyof NormalizedParams> = [
  'width', 'height', 'format', 'quality',
  'crop', 'pad',
  'blur', 'sharpen', 'rotate', 'autoOrient', 'trim',
  'greyscale', 'flip', 'flop',
  'brightness', 'saturation', 'hue',
  'normalise', 'negate', 'gamma', 'tint', 'background',
  'threshold', 'median',
  'linearMultiplier', 'linearOffset',
  'lossless', 'progressive', 'mozjpeg',
  'effort', 'bitdepth', 'palette',
  'stripAlpha', 'preserveMetadata',
  'animated',
]

export function hasTransformParams(params: NormalizedParams): boolean {
  return TRANSFORM_TRIGGERS.some(k => params[k] !== undefined)
}
