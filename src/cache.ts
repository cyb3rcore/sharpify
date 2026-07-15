import { createHash } from 'node:crypto'
import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { NormalizedParams } from './types'

export function computeCacheKey(
  relativePath: string,
  params: NormalizedParams,
  mtimeMs: number
): string {
  const canonical = Object.keys(params)
    .sort()
    .filter(k => params[k as keyof NormalizedParams] !== undefined)
    .map(k => `${k}=${params[k as keyof NormalizedParams]}`)
    .join('&')

  const input = `${relativePath}:${mtimeMs}:${canonical}`
  return createHash('sha256').update(input).digest('hex').slice(0, 32)
}

export function cacheSubpath(key: string): string {
  // Two-char subdirectory to prevent inode pressure
  return join(key.slice(0, 2), key.slice(2))
}

export class CacheManager {
  private accessTimes = new Map<string, number>()
  private maxSize: number
  private cacheDir: string

  constructor(cacheDir: string, maxSize: number = 1024 * 1024 * 1024) {
    this.cacheDir = cacheDir
    this.maxSize = maxSize
  }

  recordAccess(key: string): void {
    this.accessTimes.set(key, Date.now())
  }

  prune(): void {
    let totalSize = 0
    const entries: Array<{ key: string; size: number; atime: number }> = []

    try {
      const dirs = readdirSync(this.cacheDir, { withFileTypes: true })
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue
        const subdir = join(this.cacheDir, dir.name)
        for (const file of readdirSync(subdir)) {
          const filePath = join(subdir, file)
          try {
            const stat = statSync(filePath)
            totalSize += stat.size
            const accessKey = join(dir.name, file)
            entries.push({
              key: accessKey,
              size: stat.size,
              atime: this.accessTimes.get(accessKey) ?? stat.atimeMs,
            })
          } catch { /* race with deletion, skip */ }
        }
      }
    } catch { /* cache dir doesn't exist yet */ }

    if (totalSize <= this.maxSize) return

    // Sort by access time (oldest first) and delete until under limit
    entries.sort((a, b) => a.atime - b.atime)
    for (const entry of entries) {
      if (totalSize <= this.maxSize) break
      try {
        unlinkSync(join(this.cacheDir, entry.key))
        totalSize -= entry.size
        this.accessTimes.delete(entry.key)
      } catch { /* race */ }
    }
  }
}
