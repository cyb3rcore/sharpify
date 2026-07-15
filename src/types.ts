export interface SharpifyOptions {
  prefix: string
  sourceDir: string
  cacheDir: string
  maxWidth?: number
  maxHeight?: number
  timeoutSeconds?: number
  maxConcurrency?: number
  withoutEnlargement?: boolean
  maxCacheSize?: number
  limitInputPixels?: number
}

export interface NormalizedParams {
  width?: number
  height?: number
  fit?: string
  position?: string
  format?: string
  quality?: number
  withoutEnlargement?: boolean
  sharpen?: number
  sharpenM1?: number
  blur?: number
  rotate?: number
  autoOrient?: boolean
  trim?: boolean
  trimThreshold?: number
  greyscale?: boolean
  flip?: boolean
  flop?: boolean
  brightness?: number
  saturation?: number
  hue?: number
  normalise?: boolean
  negate?: boolean
  gamma?: number
  tint?: string
  background?: string
  threshold?: number
  median?: number
  linearMultiplier?: number
  linearOffset?: number
  crop?: string
  pad?: string
  preserveMetadata?: boolean
  stripAlpha?: boolean
  lossless?: boolean
  animated?: boolean
  progressive?: boolean
  mozjpeg?: boolean
  chromaSubsampling?: string
  effort?: number
  bitdepth?: number
  palette?: boolean
  compressionLevel?: number
  preset?: string
  timeout?: number
  failOn?: string
}

export interface FormatResult {
  format: string
  quality: number
  options: Record<string, unknown>
  contentType: string
}
