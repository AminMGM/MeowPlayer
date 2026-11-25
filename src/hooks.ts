import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { extractAccent } from './utils'

/**
 * Closes a popover on a click outside `ref` or on Escape. The ref must wrap
 * both the trigger and the popover, so clicks inside never close it early.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  const close = useRef(onClose)
  useLayoutEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) close.current()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
      }
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, ref])
}

/** Tracks a CSS media query, e.g. to tuck the sidebar away on narrow windows. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

const clockSubscribers = new Map<number, Set<() => void>>()
const clockTimers = new Map<number, number>()

/**
 * The current time, rounded down to `step` milliseconds and refreshed on that
 * interval, for labels like "12 min left" without reading the clock in render.
 */
export function useClock(step = 30_000): number {
  const subscribe = useCallback(
    (notify: () => void) => {
      let set = clockSubscribers.get(step)
      if (!set) {
        set = new Set()
        clockSubscribers.set(step, set)
        const listeners = set
        clockTimers.set(step, window.setInterval(() => listeners.forEach((listener) => listener()), Math.min(step, 15_000)))
      }
      set.add(notify)
      return () => {
        set?.delete(notify)
        if (set && set.size === 0) {
          window.clearInterval(clockTimers.get(step))
          clockTimers.delete(step)
          clockSubscribers.delete(step)
        }
      }
    },
    [step],
  )
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / step) * step)
}

/** The accent colour of a piece of artwork, for tinting detail pages. */
export function useArtworkTint(src: string | null | undefined): string | null {
  const [found, setFound] = useState<{ src: string; color: string | null } | null>(null)
  useEffect(() => {
    if (!src) return
    let cancelled = false
    void extractAccent(src).then((color) => {
      if (!cancelled) setFound({ src, color })
    })
    return () => {
      cancelled = true
    }
  }, [src])
  return src && found?.src === src ? found.color : null
}

/** True once `ref` has scrolled out of its scroll container. */
export function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), { threshold: 0 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return past
}

/** Finds the nearest scrolling ancestor, which every view's `.view` element is. */
export function scrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null
  while (current) {
    const overflow = getComputedStyle(current).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return current
    current = current.parentElement
  }
  return null
}

/**
 * Windowing for long lists: returns the slice of rows that is on screen (plus
 * a margin) given a fixed row height, measured against the scroll container.
 */
export function useVirtualRows(
  ref: RefObject<HTMLElement | null>,
  count: number,
  rowHeight: number,
  enabled: boolean,
): { start: number; end: number } {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 60) })

  useLayoutEffect(() => {
    const node = ref.current
    const scroller = enabled ? scrollParent(node) : null
    if (!node || !scroller) return
    const overscan = 12
    let frame = 0
    const measure = (): void => {
      frame = 0
      const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      const first = Math.floor(-top / rowHeight)
      const visible = Math.ceil(scroller.clientHeight / rowHeight)
      const start = Math.max(0, first - overscan)
      const end = Math.min(count, Math.max(0, first) + visible + overscan)
      setRange((current) => (current.start === start && current.end === end ? current : { start, end }))
    }
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    scroller.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', schedule)
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, count, rowHeight, enabled])

  // Short lists render every row.
  return enabled ? { start: range.start, end: Math.min(range.end, count) } : { start: 0, end: count }
}

/**
 * Where floating layers that must escape the animated page are portalled: the
 * app root, so they stay inside the app's stacking context and below dialogs.
 */
export function portalRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('.app') ?? document.body
}
