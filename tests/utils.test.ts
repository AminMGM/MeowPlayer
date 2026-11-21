import { describe, expect, it } from 'vitest'
import { activeLyricIndex, formatTime, isInFolder, lyricProgress, parseLrc } from '../src/utils'

describe('parseLrc', () => {
  it('reads timestamps with two- and three-digit fractions', () => {
    const lines = parseLrc('[00:01.50]One\n[00:02.250]Two')
    expect(lines).toEqual([
      { time: 1.5, text: 'One' },
      { time: 2.25, text: 'Two' },
    ])
  })

  it('expands lines with several timestamps and sorts them', () => {
    const lines = parseLrc('[00:10.00][00:05.00]Chorus')
    expect(lines.map((line) => line.time)).toEqual([5, 10])
  })

  it('keeps instrumental gaps as empty lines, but not leading or repeated ones', () => {
    const lines = parseLrc('[00:00.00]\n[00:01.00]Hello\n[00:05.00]\n[00:06.00]\n[00:09.00]World')
    expect(lines.map((line) => line.text)).toEqual(['Hello', '', 'World'])
  })

  it('ignores metadata tags', () => {
    expect(parseLrc('[ar:Someone]\n[ti:Song]')).toEqual([])
  })
})

describe('activeLyricIndex', () => {
  const lines = parseLrc('[00:01.00]a\n[00:03.00]b\n[00:05.00]c')

  it('returns -1 before the first line', () => {
    expect(activeLyricIndex(lines, 0.2)).toBe(-1)
  })

  it('finds the line being sung', () => {
    expect(activeLyricIndex(lines, 3.5)).toBe(1)
    expect(activeLyricIndex(lines, 99)).toBe(2)
  })

  it('measures progress through the active line', () => {
    expect(lyricProgress(lines, 0, 2)).toBeCloseTo(0.5)
  })
})

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(3725)).toBe('1:02:05')
    expect(formatTime(Number.NaN)).toBe('0:00')
  })
})

describe('isInFolder', () => {
  it('matches files inside a folder', () => {
    expect(isInFolder('D:\\Music\\Album\\song.mp3', 'D:\\Music')).toBe(true)
    expect(isInFolder('d:\\music\\song.mp3', 'D:\\Music\\')).toBe(true)
  })

  it('does not match a sibling folder that shares a prefix', () => {
    expect(isInFolder('D:\\Music2\\song.mp3', 'D:\\Music')).toBe(false)
  })
})
