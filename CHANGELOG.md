## 0.2.3

- **fix:** add sharpenM1 to TRANSFORM_TRIGGERS, clamp quality, update tests (`ef11f6a`)
  - Add sharpenM1 to TRANSFORM_TRIGGERS so ?sharpm=N alone triggers a pipeline
- Clamp quality [0,100] in normalizeParams (consistent with blur/median/sharpen)
- Update comment on withoutEnlargement-only pipeline branch
- Replace dynamic import('sharp') with static import in plugin test
- Add unit test for sharpenM1 trigger detection
- Add e2e test verifying ?sharpm=2 triggers transform via full server path
- Fix stale README test count (44->64, 6->5 files)

## 0.2.2

- **fix:** add @semantic-release/git plugin so version bumps commit to repo (`b764908`)
  Without this, semantic-release publishes new versions but never
commits the updated package.json and CHANGELOG.md back to the repo.
This left the repo permanently out of sync with what's on npm.

- **chore:** gate release on CI passing, matching reactify pattern (`d8056a1`)

# @cyb3rcore/sharpify

## 0.2.0

### Minor Changes

- ae55e9d: Initial release of `@cyb3rcore/sharpify` — a Fastify plugin for on-the-fly image transformation with sharp.

  Commits included:

  - `aa94c26` — chore: scaffold project structure
  - `97181e5` — feat: add type definitions (SharpifyOptions, NormalizedParams, FormatResult)
  - `2546b47` — feat: add param parsing with security caps (parseParams, normalizeParams)
  - `9f183ea` — feat: add format negotiation with Accept header (negotiateFormat, getFormatOptions)
  - `3d5c87f` — feat: add cache key computation and LRU manager (computeCacheKey, CacheManager)
  - `d32b650` — fix: make prune tests write files in subdirectories that prune actually scans
  - `8d7eaf9` — feat: add sharp pipeline builder with all operations (buildPipeline, transformAndCache)
  - `472ebc5` — feat: add plugin registration with route handler (sharpifyPlugin)
  - `39fd1df` — fix: address final review — propagate format negotiation, prune cache, add error tests
  - `bd557b4` — ci: add CI/CD workflows with changesets release pipeline

  ### Features

  - On-the-fly image resize, format conversion, and processing via URL query params (`?w=400&fmt=webp&q=80`)
  - Accept-header content negotiation (AVIF > WebP > JPEG > PNG)
  - 30+ sharp operations: resize, crop, blur, sharpen, rotate, greyscale, modulate, tint, trim, flip, flop, normalize, negate, gamma, threshold, median, linear, pad, strip-alpha
  - Disk cache with SHA-256 key, two-char subdirectory layout, LRU eviction
  - Atomic cache writes (`.tmp` + `renameSync`)
  - Full `@fastify/static` integration via `reply.sendFile()`
  - DoS protections: dimension caps (max 4096), processing timeout (30s), concurrency semaphore, without-enlargement guard, path traversal prevention
  - Error fallback: processing failures serve the original image
  - Per-derivative Cache-Control via `setHeaders`
  - Format-specific options: progressive JPEG, mozjpeg, lossless WebP/AVIF, indexed PNG, chroma subsampling, encoding effort
