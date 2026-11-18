import { useEffect, useRef } from 'react'
import { engine } from '../audio/engine'
import { useStore } from '../store/useStore'
import type { VisualizerStyle } from '../types'

interface VisualizerProps {
  height?: number
  bars?: number
  className?: string
}

export function Visualizer({ height = 72, bars = 40, className }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isPlaying = useStore((state) => state.isPlaying)
  const enabled = useStore((state) => state.settings.visualizer)
  const style = useStore((state) => state.settings.visualizerStyle)
  const accent = useStore((state) => state.settings.accent)

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let phase = 0
    const data = new Uint8Array(1024)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const smoothed = new Array(bars).fill(0)

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const draw = (): void => {
      const analyser = engine.getAnalyser()
      const width = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, width, h)

      let values: number[] = []
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(data)
        const usable = Math.floor(data.length * 0.6)
        for (let i = 0; i < bars; i += 1) {
          const start = Math.floor((i / bars) * usable)
          const end = Math.floor(((i + 1) / bars) * usable)
          let sum = 0
          for (let j = start; j <= end && j < data.length; j += 1) sum += data[j]
          const average = sum / Math.max(1, end - start + 1)
          values.push(Math.min(1, (average / 255) ** 1.3))
        }
      } else {
        phase += 0.018
        values = Array.from({ length: bars }, (_, i) => 0.05 + Math.abs(Math.sin(i * 0.38 + phase)) * 0.04)
      }

      values.forEach((value, index) => {
        smoothed[index] = smoothed[index] * 0.55 + value * 0.45
      })

      if (style === 'ribbon') drawRibbon(ctx, width, h, dpr, smoothed, accent)
      else if (style === 'aurora') drawAurora(ctx, width, h, dpr, smoothed, accent, phase)
      else if (style === 'filament') drawFilament(ctx, width, h, dpr, smoothed, phase)
      else drawBars(ctx, width, h, dpr, smoothed, accent)

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [accent, bars, enabled, isPlaying, style])

  if (!enabled) return null
  return <canvas ref={canvasRef} className={`visualizer ${className ?? ''}`} style={{ height }} />
}

/* ------------------------------- bars ------------------------------- */

function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  dpr: number,
  values: number[],
  accent: string,
): void {
  const bars = values.length
  const gap = Math.max(2 * dpr, (width / bars) * 0.45)
  const barWidth = Math.max(1.5, (width - gap * (bars - 1)) / bars)
  const radius = Math.min(barWidth / 2, 4 * dpr)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  values.forEach((level, index) => {
    const barHeight = Math.max(2.5 * dpr, level * h * 0.94)
    const x = index * (barWidth + gap)
    const y = h - barHeight

    const gradient = ctx.createLinearGradient(0, y, 0, h)
    gradient.addColorStop(0, hexToRgba(accent, 0.85))
    gradient.addColorStop(0.55, hexToRgba(accent, 0.4))
    gradient.addColorStop(1, hexToRgba(accent, 0.12))

    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barHeight, radius)
    ctx.fillStyle = gradient
    ctx.shadowColor = hexToRgba(accent, 0.5)
    ctx.shadowBlur = 12 * dpr
    ctx.fill()

    // glass highlight along the top edge
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, Math.min(2.2 * dpr, barHeight), radius)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.fill()
  })

  ctx.restore()
}

/* ------------------------- shared line helpers ------------------------- */

/** Samples the spectrum into a smooth envelope across the full canvas width. */
function envelopeAt(values: number[], t: number): number {
  if (!values.length) return 0
  const position = Math.max(0, Math.min(values.length - 1, t * (values.length - 1)))
  const index = Math.floor(position)
  const next = Math.min(values.length - 1, index + 1)
  const mix = position - index
  return values[index] * (1 - mix) + values[next] * mix
}

function smoothPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
}

/* ------------------------------ ribbon ------------------------------ */
/** Two flowing white curves, one thick and one thin beneath it. */
function drawRibbon(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  dpr: number,
  values: number[],
  _accent: string,
): void {
  const centre = h * 0.52
  const samples = 96
  const top: { x: number; y: number }[] = []
  const bottom: { x: number; y: number }[] = []

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const x = t * width
    // taper at both ends so the curve fades into the edges like the reference
    const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.55
    const amp = envelopeAt(values, t) * h * 0.42 * taper + h * 0.015
    const angle = t * Math.PI * 6.2 + performance.now() * 0.00042
    top.push({ x, y: centre - Math.sin(angle) * amp })
    bottom.push({ x, y: centre + Math.sin(angle) * amp * 0.82 })
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // faint lower echo
  smoothPath(ctx, bottom)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)'
  ctx.lineWidth = 1.6 * dpr
  ctx.shadowColor = 'rgba(255, 255, 255, 0.55)'
  ctx.shadowBlur = 16 * dpr
  ctx.stroke()

  // bright main curve
  smoothPath(ctx, top)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.lineWidth = 2.6 * dpr
  ctx.shadowColor = 'rgba(255, 255, 255, 0.75)'
  ctx.shadowBlur = 22 * dpr
  ctx.stroke()

  ctx.restore()
}

/* ------------------------------ aurora ------------------------------ */
/** A stack of accent-tinted glowing curves that mesh into a veil. */
function drawAurora(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  dpr: number,
  values: number[],
  accent: string,
  phase: number,
): void {
  const centre = h * 0.5
  const samples = 110
  const layers = 22
  const drift = performance.now() * 0.00035 + phase

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'

  for (let layer = 0; layer < layers; layer += 1) {
    const spread = layer / (layers - 1) - 0.5
    const points: { x: number; y: number }[] = []
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples
      const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.5
      const amp = envelopeAt(values, t) * h * 0.4 * taper
      const angle = t * Math.PI * 4.4 + drift + spread * 2.4
      const y = centre + spread * h * 0.28 + Math.sin(angle) * amp * (0.72 + Math.abs(spread) * 0.5)
      points.push({ x: t * width, y })
    }

    const strength = 0.5 - Math.abs(spread) * 0.85
    smoothPath(ctx, points)
    ctx.strokeStyle = hexToRgba(accent, Math.max(0.05, strength))
    ctx.lineWidth = 1.1 * dpr
    ctx.shadowColor = hexToRgba(accent, 0.6)
    ctx.shadowBlur = 14 * dpr
    ctx.stroke()
  }

  // hot core line
  const core: { x: number; y: number }[] = []
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.5
    const amp = envelopeAt(values, t) * h * 0.36 * taper
    core.push({ x: t * width, y: centre + Math.sin(t * Math.PI * 4.4 + drift) * amp })
  }
  smoothPath(ctx, core)
  ctx.strokeStyle = 'rgba(245, 248, 255, 0.92)'
  ctx.lineWidth = 1.9 * dpr
  ctx.shadowColor = hexToRgba(accent, 0.9)
  ctx.shadowBlur = 26 * dpr
  ctx.stroke()

  ctx.restore()
}

/* ----------------------------- filament ----------------------------- */
/** Many thin white filaments braided into peaks, bright at the crest. */
function drawFilament(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  dpr: number,
  values: number[],
  phase: number,
): void {
  const centre = h * 0.5
  const samples = 120
  const strands = 13
  const drift = phase * 0.6

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'

  for (let strand = 0; strand < strands; strand += 1) {
    const offset = strand / (strands - 1) - 0.5
    const points: { x: number; y: number }[] = []
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples
      const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.42
      const amp = envelopeAt(values, t) * h * 0.44 * taper
      const angle = t * Math.PI * 5.6 + drift + offset * 1.5
      const y = centre + Math.sin(angle) * amp * (0.55 + offset * 0.9) + offset * h * 0.06
      points.push({ x: t * width, y })
    }

    smoothPath(ctx, points)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.14 + (1 - Math.abs(offset)) * 0.4})`
    ctx.lineWidth = 0.9 * dpr
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)'
    ctx.shadowBlur = 10 * dpr
    ctx.stroke()
  }

  ctx.restore()
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(value.slice(0, 2), 16) || 160
  const g = parseInt(value.slice(2, 4), 16) || 180
  const b = parseInt(value.slice(4, 6), 16) || 200
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export type { VisualizerStyle }
