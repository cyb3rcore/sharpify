import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { NormalizedParams, SharpifyOptions } from './types'
import { negotiateFormat, getFormatOptions } from './format'

export async function buildPipeline(
  sourceBuffer: Buffer,
  params: NormalizedParams,
  config: SharpifyOptions
): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
  const meta = await sharp(sourceBuffer).metadata()

  // Determine format
  const srcFormat = meta.format ?? 'jpeg'
  const hasAlpha = meta.channels === 4 || (meta.hasAlpha ?? false)
  const fmt = negotiateFormat(undefined, srcFormat, hasAlpha, params)

  const instance = sharp(sourceBuffer, {
    failOn: (params.failOn ?? 'error') as 'error' | 'warning' | 'none' | 'truncated',
    limitInputPixels: config.limitInputPixels,
    animated: params.animated ?? false,
  })

  // Optional operations
  if (params.autoOrient) instance.rotate()
  if (params.rotate !== undefined) instance.rotate(params.rotate)
  if (params.flip) instance.flip()
  if (params.flop) instance.flop()
  if (params.trim) instance.trim({ threshold: params.trimThreshold ?? 10 })

  // Resize (core operation)
  if (params.width || params.height) {
    instance.resize(params.width, params.height, {
      fit: (params.fit ?? 'cover') as keyof sharp.FitEnum,
      position: (params.position ?? 'centre') as string,
      withoutEnlargement: params.withoutEnlargement ?? true,
    })
  } else if (params.withoutEnlargement) {
    // Apply withoutEnlargement even at source dimensions
    instance.resize(null, null, { withoutEnlargement: true })
  }

  // Image adjustments
  if (params.blur !== undefined) instance.blur(params.blur)
  if (params.sharpen !== undefined) {
    instance.sharpen(params.sharpenM1 !== undefined
      ? { sigma: params.sharpen, m1: params.sharpenM1 }
      : { sigma: params.sharpen })
  }
  if (params.greyscale) instance.greyscale()
  if (params.normalise) instance.normalise()
  if (params.negate) instance.negate()
  if (params.gamma !== undefined) instance.gamma(params.gamma)
  if (params.tint) instance.tint(params.tint)
  if (params.brightness !== undefined || params.saturation !== undefined || params.hue !== undefined) {
    instance.modulate({
      brightness: params.brightness,
      saturation: params.saturation,
      hue: params.hue,
    })
  }
  if (params.threshold !== undefined) instance.threshold(params.threshold)
  if (params.median !== undefined) instance.median(params.median)
  if (params.linearMultiplier !== undefined || params.linearOffset !== undefined) {
    instance.linear(params.linearMultiplier ?? 1, params.linearOffset ?? 0)
  }
  if (params.background) instance.flatten({ background: params.background })
  if (params.stripAlpha) instance.removeAlpha()
  if (params.preserveMetadata) instance.withMetadata()

  // Crop (pre-resize)
  if (params.crop) {
    const parts = params.crop.split(',').map(Number)
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
      instance.extract({ left: parts[0], top: parts[1], width: parts[2], height: parts[3] })
    }
  }

  // Pad border
  if (params.pad) {
    const parts = params.pad.split(',').map(Number)
    if (parts.length === 1) {
      instance.extend({ top: parts[0], bottom: parts[0], left: parts[0], right: parts[0] })
    } else if (parts.length === 4) {
      instance.extend({ top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] })
    }
  }

  // Output format
  instance.toFormat(fmt.format as keyof sharp.FormatEnum, getFormatOptions(params, fmt.format))

  // Timeout
  const timeout = params.timeout ?? config.timeoutSeconds ?? 30
  if (timeout > 0) instance.timeout({ seconds: timeout })

  const { data, info } = await instance.toBuffer({ resolveWithObject: true })
  return { buffer: data, info }
}

export async function transformAndCache(
  sourcePath: string,
  cachePath: string,
  params: NormalizedParams,
  config: SharpifyOptions,
  sourceBuffer?: Buffer
): Promise<void> {
  const srcBuf = sourceBuffer ?? readFileSync(sourcePath)
  const result = await buildPipeline(srcBuf, params, config)
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, result.buffer)
}
