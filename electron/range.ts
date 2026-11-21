/**
 * Parses an HTTP Range header for a single byte range. Returns `null` when no
 * usable range was asked for (serve the whole file), or `'invalid'` when the
 * range cannot be satisfied.
 */
export function parseRange(header: string | null, total: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return null

  let start: number
  let end: number
  if (!rawStart) {
    // Suffix range: "bytes=-500" means the last 500 bytes.
    const length = parseInt(rawEnd, 10)
    if (!Number.isFinite(length) || length <= 0) return 'invalid'
    start = Math.max(0, total - length)
    end = total - 1
  } else {
    start = parseInt(rawStart, 10)
    end = rawEnd ? parseInt(rawEnd, 10) : total - 1
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid'
  if (end >= total) end = total - 1
  if (start >= total || start > end) return 'invalid'
  return { start, end }
}
