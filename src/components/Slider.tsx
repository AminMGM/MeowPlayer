import { useRef, useState } from 'react'
import { cx } from '../utils'

interface SliderProps {
  value: number
  max: number
  min?: number
  step?: number
  /** Called while dragging. Leave out to only commit on release (seeking). */
  onChange?: (value: number) => void
  /** Called once when the pointer is released, or on a key press. */
  onCommit?: (value: number) => void
  /** Formats the hover tooltip; no tooltip when left out. */
  format?: (value: number) => string
  label: string
  className?: string
  disabled?: boolean
}

/**
 * A thin track that thickens on hover, with a glowing accent fill, a hover
 * tooltip and drag preview. Seeking only commits on release, so dragging
 * no longer stutters the audio or floods the disk with session saves.
 */
export function Slider({
  value,
  max,
  min = 0,
  step = 1,
  onChange,
  onCommit,
  format,
  label,
  className,
  disabled,
}: SliderProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [hover, setHover] = useState<{ x: number; value: number } | null>(null)

  const range = Math.max(0.0001, max - min)
  const shown = drag ?? value
  const ratio = Math.min(1, Math.max(0, (shown - min) / range))

  const valueAt = (clientX: number): { x: number; value: number } => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return { x: 0, value: min }
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const raw = min + t * range
    const snapped = Math.round(raw / step) * step
    return { x: t * 100, value: Math.min(max, Math.max(min, snapped)) }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (disabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = valueAt(event.clientX).value
    setDrag(next)
    onChange?.(next)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const point = valueAt(event.clientX)
    setHover(point)
    if (drag === null) return
    setDrag(point.value)
    onChange?.(point.value)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (drag === null) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const final = valueAt(event.clientX).value
    setDrag(null)
    onCommit?.(final)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const big = range / 10
    const keys: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: big,
      PageDown: -big,
    }
    let next: number | null = null
    if (event.key in keys) next = value + keys[event.key]
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === null) return
    event.preventDefault()
    event.stopPropagation()
    const clamped = Math.min(max, Math.max(min, next))
    onChange?.(clamped)
    onCommit?.(clamped)
  }

  return (
    <div
      ref={ref}
      className={cx('slider', drag !== null && 'dragging', disabled && 'disabled', className)}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(shown * 100) / 100}
      aria-valuetext={format ? format(shown) : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
    >
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${ratio * 100}%` }} />
        {hover && drag === null && <div className="slider-ghost" style={{ width: `${hover.x}%` }} />}
      </div>
      <div className="slider-thumb" style={{ left: `${ratio * 100}%` }} />
      {format && (hover || drag !== null) && (
        <div className="slider-tip" style={{ left: `${drag !== null ? ratio * 100 : hover?.x ?? 0}%` }}>
          {format(drag ?? hover?.value ?? value)}
        </div>
      )}
    </div>
  )
}
