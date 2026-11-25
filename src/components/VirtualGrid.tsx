import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { scrollParent } from '../hooks'
import { cx } from '../utils'

/** Grids shorter than this render every item. */
const VIRTUAL_AFTER = 60

/**
 * A CSS grid that only builds the rows near the screen. The grid's own CSS
 * decides the column count; rows outside the window become top and bottom
 * padding. With 600 albums, scrolling no longer leaves 600 decoded covers
 * in memory.
 */
export function VirtualGrid<T>({
  items,
  className,
  render,
}: {
  items: T[]
  className: string
  render: (item: T, index: number) => ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length, 48), top: 0, bottom: 0 })
  const virtual = items.length > VIRTUAL_AFTER

  useLayoutEffect(() => {
    const grid = ref.current
    const scroller = virtual ? scrollParent(grid) : null
    if (!grid || !scroller) return
    let frame = 0
    const measure = (): void => {
      frame = 0
      const style = getComputedStyle(grid)
      const columns = Math.max(1, style.gridTemplateColumns.split(' ').filter(Boolean).length)
      const first = grid.children[0] as HTMLElement | undefined
      if (!first) return
      const gap = parseFloat(style.rowGap) || 0
      const rowHeight = first.getBoundingClientRect().height + gap
      if (rowHeight < 10) return
      const rows = Math.ceil(items.length / columns)
      const offset = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top - (parseFloat(style.paddingTop) || 0)
      const overscan = 2
      const firstRow = Math.max(0, Math.floor(-offset / rowHeight) - overscan)
      const lastRow = Math.min(rows, Math.ceil((scroller.clientHeight - offset) / rowHeight) + overscan)
      const next = {
        start: firstRow * columns,
        end: Math.min(items.length, lastRow * columns),
        top: firstRow * rowHeight,
        bottom: Math.max(0, (rows - lastRow) * rowHeight),
      }
      setRange((current) =>
        current.start === next.start && current.end === next.end && Math.abs(current.top - next.top) < 1 ? current : next,
      )
    }
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    scroller.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(scroller)
    observer.observe(grid)
    return () => {
      scroller.removeEventListener('scroll', schedule)
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [items.length, virtual])

  const start = virtual ? range.start : 0
  const end = virtual ? Math.min(range.end, items.length) : items.length
  return (
    <div
      ref={ref}
      className={cx(className, virtual && 'virtual')}
      style={virtual ? { paddingTop: range.top, paddingBottom: range.bottom } : undefined}
    >
      {items.slice(start, end).map((item, offset) => render(item, start + offset))}
    </div>
  )
}
