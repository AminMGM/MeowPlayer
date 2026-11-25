import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { scrollParent } from '../hooks'
import { cx } from '../utils'

/** The index letter for a sort value: A–Z, '#' for digits and symbols, or the first letter of other scripts. */
export function indexLetter(value: string): string {
  const first = value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .charAt(0)
    .toUpperCase()
  if (!first || /[0-9\p{P}\p{S}]/u.test(first)) return '#'
  return first
}

/**
 * A slim A–Z rail on the right of a long song list. It fades in while the list
 * scrolls (or under the pointer) and jumps to a letter on click or drag.
 */
export function AlphaIndex({
  values,
  bodyRef,
  rowHeight,
}: {
  /** The sort value of each row, in display order. */
  values: string[]
  bodyRef: RefObject<HTMLElement | null>
  rowHeight: number
}) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [box, setBox] = useState<{ top: number; bottom: number; right: number } | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  // First row of each letter, in the order the letters appear in the list.
  const letters = useMemo(() => {
    const first = new Map<string, number>()
    values.forEach((value, index) => {
      const letter = indexLetter(value)
      if (!first.has(letter)) first.set(letter, index)
    })
    return [...first.entries()]
  }, [values])

  useEffect(() => {
    const scroller = scrollParent(bodyRef.current)
    if (!scroller) return
    let timer = 0
    const place = (): void => {
      const rect = scroller.getBoundingClientRect()
      setBox({ top: rect.top + 12, bottom: window.innerHeight - rect.bottom + 12, right: window.innerWidth - rect.right + 14 })
    }
    const onScroll = (): void => {
      setVisible(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (!dragging.current) setVisible(false)
      }, 1300)
    }
    place()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(place)
    observer.observe(scroller)
    window.addEventListener('resize', place)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.clearTimeout(timer)
    }
  }, [bodyRef])

  if (letters.length < 2 || !box) return null

  const jump = (letter: string, row: number): void => {
    const body = bodyRef.current
    const scroller = scrollParent(body)
    if (!body || !scroller) return
    const offset = body.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    // Leave room for the sticky header above the list.
    scroller.scrollTo({ top: Math.max(0, offset + row * rowHeight - 56) })
    setCurrent(letter)
  }

  const fromPoint = (clientY: number): void => {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const slot = Math.min(letters.length - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * letters.length)))
    const [letter, row] = letters[slot]
    if (letter !== current) jump(letter, row)
  }

  // Portalled: an animated page ancestor would otherwise become the containing block of `position: fixed`.
  return createPortal(
    <div
      ref={railRef}
      className={cx('alpha-index', (visible || current) && 'show')}
      style={{ top: box.top, bottom: box.bottom, right: box.right }}
      role="navigation"
      aria-label="Jump to letter"
      onPointerEnter={() => setVisible(true)}
      onPointerLeave={() => {
        if (!dragging.current) setVisible(false)
      }}
      onPointerDown={(event) => {
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        fromPoint(event.clientY)
      }}
      onPointerMove={(event) => {
        if (dragging.current) fromPoint(event.clientY)
      }}
      onPointerUp={() => {
        dragging.current = false
        setCurrent(null)
      }}
      onPointerCancel={() => {
        dragging.current = false
        setCurrent(null)
      }}
    >
      {letters.map(([letter, row]) => (
        <span key={letter} data-row={row} className={cx('alpha-letter', current === letter && 'current')}>
          {letter}
          {current === letter && <span className="alpha-bubble">{letter}</span>}
        </span>
      ))}
    </div>,
    document.body,
  )
}
