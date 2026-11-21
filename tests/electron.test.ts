import { describe, expect, it } from 'vitest'
import { parseRange } from '../electron/range'
import { isNewer, versionParts } from '../electron/version'

describe('versionParts', () => {
  it('reads sloppy tags', () => {
    expect(versionParts('v1.8.5')).toEqual([1, 8, 5])
    expect(versionParts('v.1.8.5')).toEqual([1, 8, 5])
    expect(versionParts('2.0.0')).toEqual([2, 0, 0])
  })
})

describe('isNewer', () => {
  it('compares versions numerically', () => {
    expect(isNewer('2.0.0', '1.8.5')).toBe(true)
    expect(isNewer('1.10.0', '1.9.9')).toBe(true)
    expect(isNewer('1.8.5', '1.8.5')).toBe(false)
    expect(isNewer('1.8.4', '1.8.5')).toBe(false)
  })

  it('treats a "v." tag like any other', () => {
    expect(isNewer('v.1.8.5', '1.8.4')).toBe(true)
  })

  it('never offers a pre-release over the same release', () => {
    expect(isNewer('2.0.0-beta.1', '2.0.0')).toBe(false)
    expect(isNewer('2.0.0', '2.0.0-beta.1')).toBe(true)
    expect(isNewer('2.1.0-beta.1', '2.0.0')).toBe(true)
  })
})

describe('parseRange', () => {
  it('serves the whole file without a range', () => {
    expect(parseRange(null, 1000)).toBeNull()
  })

  it('reads an open-ended range', () => {
    expect(parseRange('bytes=100-', 1000)).toEqual({ start: 100, end: 999 })
  })

  it('clamps the end to the file size', () => {
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 })
  })

  it('reads a suffix range as the last bytes of the file', () => {
    expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 })
  })

  it('rejects a range past the end', () => {
    expect(parseRange('bytes=2000-', 1000)).toBe('invalid')
  })
})
