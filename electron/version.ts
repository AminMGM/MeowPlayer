/**
 * Version helpers for the updater, kept free of Electron imports so they can
 * be unit tested.
 */

/**
 * Splits a version on any run of non-digits, so sloppy tags still compare:
 * "v1.8.5", "v.1.8.5" and "1.8.5" all become [1, 8, 5].
 */
export function versionParts(value: string): number[] {
  return value
    .replace(/^v/i, '')
    .split(/[^0-9]+/)
    .filter((piece) => piece.length > 0)
    .map((piece) => parseInt(piece, 10) || 0)
}

/** True when the tag carries a pre-release label such as "-beta.2". */
export function isPrerelease(value: string): boolean {
  return /-[0-9a-z]/i.test(value.replace(/^v\.?/i, ''))
}

/**
 * True when `candidate` is newer than `current`. A pre-release of a version is
 * older than the release itself, so "2.0.0-beta.1" never replaces "2.0.0".
 */
export function isNewer(candidate: string, current: string): boolean {
  const core = (value: string): number[] => versionParts(value.replace(/-.*$/, '')).slice(0, 3)
  const a = core(candidate)
  const b = core(current)
  for (let i = 0; i < 3; i += 1) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  // Same core version: only a release replaces a pre-release.
  return isPrerelease(current) && !isPrerelease(candidate)
}
