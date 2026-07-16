# @cyb3rcore/sharpify

Fastify plugin for on-the-fly image transformation with [sharp](https://sharp.pixelplumbing.com/). Tightly integrated with `@fastify/static` — serves originals via static, transforms on request, caches derivatives to disk.

```ts
fastify.register(fastifyStatic, { root: 'public', prefix: '/', wildcard: true })
fastify.register(sharpify, {
  prefix: '/images/',
  sourceDir: 'public/images',
  cacheDir: 'public/_cache',
})
```

## Install

```sh
npm install @cyb3rcore/sharpify
```

Requires `@fastify/static` and `fastify` as peer dependencies.

## How it works

```
GET /images/photo.jpg?w=400&fmt=webp&q=80
  ↓
sharpify route handler (GET /images/*)
  ↓
Has transform params?  →  no  →  reply.sendFile()  →  @fastify/static serves original
  ↓ yes
Compute cache key (SHA-256 of source path + mtime + params)
  ↓
Cache file exists?  →  yes  →  reply.sendFile(cacheFile)  →  @fastify/static streams it
  ↓ no
Sharp pipeline: read source → resize → convert → write to cache (atomic .tmp + rename)
  ↓
reply.sendFile(cacheFile)  →  @fastify/static serves the cached derivative
```

Requests without any transform params pass through to `@fastify/static` zero-overhead — sharpify doesn't touch them.

## Registration

```ts
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import sharpify from '@cyb3rcore/sharpify'

const app = Fastify()

// Register @fastify/static first — sharpify delegates to it via reply.sendFile()
await app.register(fastifyStatic, {
  root: 'public',
  prefix: '/',
  wildcard: true,
})

// Register sharpify — it owns /images/ route for transformed images
await app.register(sharpify, {
  prefix: '/images/',
  sourceDir: 'public/images',
  cacheDir: 'public/_cache',
})

await app.listen({ port: 3000 })
```

## Query parameters

### Core operations

| Operation       | Param  | Type          | Default        | Notes                                |
| --------------- | ------ | ------------- | -------------- | ------------------------------------ |
| Width           | `w`    | number        | source         | Clamped to `maxWidth` (default 4096) |
| Height          | `h`    | number        | source         | Clamped to `maxHeight` (default 4096)|
| Fit             | `fit`  | string        | `cover`        | `cover`, `contain`, `fill`, `inside`, `outside` |
| Position        | `pos`  | string        | `centre`       | Also `entropy`, `attention` strategies |
| Format          | `fmt`  | string        | auto (Accept)  | `jpeg`, `png`, `webp`, `avif`, `tiff`, `gif` |
| Quality         | `q`    | number(1-100) | 80             | Mapped per-format                     |
| Without enlarge | `we`   | boolean       | true           | Don't upscale                       |

### Image adjustments

| Operation              | Param         | Type           | Description                               |
| ---------------------- | ------------- | -------------- | ----------------------------------------- |
| Sharpen                | `sharp`       | number(sigma)  | Post-resize sharpen                       |
| Sharpen (fine)         | `sharpm`      | number(m1)     | Fine control with `sharp`                 |
| Blur                   | `blur`        | number(sigma)  | Gaussian blur (capped at 100)             |
| Rotate                 | `rot`         | number(deg)    | Arbitrary rotation                        |
| Auto-orient            | `or`          | boolean        | Respect EXIF orientation                  |
| Trim                   | `trim`        | boolean        | Auto-trim similar-colored borders         |
| Trim threshold         | `trimt`       | number         | Sensitivity for trim                     |
| Greyscale              | `bw`          | boolean        | Convert to black & white                  |
| Flip (vertical)        | `flip`        | boolean        | Mirror vertically                         |
| Flop (horizontal)      | `flop`        | boolean        | Mirror horizontally                       |
| Brightness             | `bri`         | number         | Multiplier via `modulate`                 |
| Saturation             | `sat`         | number         | Multiplier via `modulate`                 |
| Hue rotate             | `hue`         | number(deg)    | Hue rotation via `modulate`               |
| Normalise contrast     | `con`         | boolean        | Histogram stretch                         |
| Negate                 | `neg`         | boolean        | Invert colours                            |
| Gamma                  | `gam`         | number         | Gamma correction                          |
| Tint                   | `tint`        | hex colour     | `ff4400` — tint the image                 |
| Background             | `bg`          | hex colour     | Flatten alpha onto this colour            |
| Threshold              | `thresh`      | number(0-255)  | Posterize at threshold                    |
| Median filter          | `median`      | number(3-9)    | Noise reduction                           |
| Linear (mult)          | `mult`        | number         | `output = mult * input + offset`          |
| Linear (offset)        | `offset`      | number         |                                           |
| Region crop            | `crop`        | string         | `left,top,width,height`                   |
| Pad border             | `pad`         | number/string  | `N` (all) or `t,r,b,l`                      |
| Preserve metadata      | `meta`        | boolean        | Keep EXIF/ICC profiles                    |
| Remove alpha           | `strip-alpha` | boolean        | Strip transparency channel                |
| Lossless               | `lossless`    | boolean        | For WebP, AVIF                           |

### Format-specific controls

| Param          | Affects        | Default      | Notes                             |
| -------------- | -------------- | ------------ | --------------------------------- |
| `progressive`  | JPEG           | false        | Progressive (interlace) scan      |
| `mozjpeg`      | JPEG           | false        | mozjpeg defaults                  |
| `chroma`       | JPEG, AVIF     | `4:4:4`        | Chroma subsampling                 |
| `effort`       | WebP, AVIF, PNG | varies       | Encoding speed/quality tradeoff   |
| `bitdepth`     | AVIF, PNG      | 8            | Bit depth                         |
| `palette`      | PNG            | false        | Indexed PNG (quantized)           |
| `compression`  | PNG            | 6            | zlib compression level            |
| `preset`       | WebP           | `default`      | Encoding preset                    |

### Security

| Param      | Type   | Default   | Description                         |
| ---------- | ------ | --------- | ----------------------------------- |
| `timeout`  | number | 30        | Processing timeout in seconds       |

## Content negotiation

When `fmt` is not specified, sharpify negotiates the best format from the `Accept` header:

1. **AVIF** (`image/avif`) — best compression, when browser supports it
2. **WebP** (`image/webp`) — widely supported modern format
3. **JPEG** / **PNG** — fallback based on source format

Formats that don't support alpha (JPEG) are skipped when the source image has an alpha channel.

## Plugin options

```ts
interface SharpifyOptions {
  // Required
  prefix: string          // URL prefix, e.g. '/images/'
  sourceDir: string       // Absolute path to source images
  cacheDir: string        // Absolute path to cache directory

  // Security / limits
  maxWidth?: number       // default 4096
  maxHeight?: number      // default 4096
  timeoutSeconds?: number // default 30
  maxConcurrency?: number // default 4
  withoutEnlargement?: boolean // default true
  maxCacheSize?: number   // default 1GB (LRU eviction)
}
```

## Caching

Sharpify caches every transformed image to disk. The cache key is a SHA-256 hash of:

```
sourceRelativePath + sourceMtime + canonicalParams
```

- **Editing the source file** changes the mtime → new cache key → old file orphaned → eventually evicted by LRU
- **Two-char subdirectory** layout prevents inode pressure from many cache files
- **Atomic writes** (`.tmp.PID` → `renameSync`) prevent serving partial files
- **LRU eviction** removes least-recently-accessed files when total cache exceeds `maxCacheSize`
- **`@fastify/static` multi-root** (`['_cache', 'public']`) — sharpify writes to cache, static serves from cache; on cache hit there's zero sharp involvement

## DoS protections

| Vector              | Mitigation                                               |
| ------------------- | -------------------------------------------------------- |
| Memory bomb         | Output dimensions capped at 4096, `withoutEnlargement: true`, `limitInputPixels` |
| CPU exhaustion      | `sharp().timeout({ seconds: 30 })` on every pipeline      |
| Slow operations     | Blur capped at sigma 100, median capped at 5             |
| Thread pool         | Concurrency semaphore (default 4 max)                    |
| Disk fill           | LRU eviction, quantized cache keys                       |
| Path traversal      | Hash-based cache filenames, prefix guard on sourceDir    |
| Image bomb          | `failOn: 'error'`, `unlimited: false`                    |

## Error handling

| Scenario                     | Behavior                                              |
| ---------------------------- | ----------------------------------------------------- |
| Sharp timeout                | Logs warning, serves original image                   |
| Image not found              | 404 from `reply.sendFile()`                           |
| Invalid query params         | Silently clamp to defaults                            |
| Sharp processing error       | Logs error, serves original                           |
| Sharp not installed          | Friendly error at plugin registration                 |

## Tests

```sh
npm test        # 44 tests across 6 files
npm run build   # TypeScript compilation
```

## License

MIT
