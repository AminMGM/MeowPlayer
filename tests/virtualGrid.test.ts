import { describe, expect, it } from 'vitest'
import { gridWindow } from '../src/components/VirtualGrid'

describe('gridWindow', () => {
  const base = { count: 1677, columns: 6, rowHeight: 250, viewport: 900 }

  it('starts at the top', () => {
    expect(gridWindow({ ...base, offset: 120 })).toMatchObject({ start: 0, top: 0 })
  })

  it('follows the scroll position', () => {
    const w = gridWindow({ ...base, offset: -5000 })
    expect(w.start).toBe((20 - 2) * 6)
    expect(w.top).toBe(18 * 250)
    expect(w.end).toBeGreaterThan(w.start)
  })

  it('is stable: measuring again at the same scroll gives the same window', () => {
    // The 2.2.5 bug subtracted the padding from the offset, so each measurement drifted further down.
    const first = gridWindow({ ...base, offset: -5000 })
    const again = gridWindow({ ...base, offset: -5000 })
    expect(again).toEqual(first)
  })

  it('never renders an empty window, even when scrolled past the end', () => {
    const w = gridWindow({ ...base, offset: -10_000_000 })
    expect(w.end).toBeGreaterThan(w.start)
    expect(w.start).toBeLessThan(base.count)
  })
})
