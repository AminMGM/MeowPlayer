import { useEffect, useRef } from 'react'
import { engine } from '../audio/engine'
import { useStore } from '../store/useStore'
import { hexToRgba } from '../utils'

interface VisualizerProps {
  height?: number
  bars?: number
  className?: string
}

type Point = { x: number; y: number }

/** Reads the live accent (album theming changes it) as a hex colour. */
function currentAccent(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#a3b7c9'
}

export function Visualizer({ height = 120, bars = 48, className }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isPlaying = useStore((state) => state.isPlaying)
  const enabled = useStore((state) => state.settings.visualizer)
  const style = useStore((state) => state.settings.visualizerStyle)

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let frame = 0
    let accent = currentAccent()
    let accentCheck = 0
    const data = new Uint8Array(1024)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const smoothed = Array.from({ length: bars }, () => 0)
    let energy = 0

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const draw = (now: number): void => {
      frame = requestAnimationFrame(draw)
      if (now - accentCheck > 500) {
        accent = currentAccent()
        accentCheck = now
      }
      const analyser = engine.getAnalyser()
      const width = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, width, h)

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(data)
        // Logarithmic bands so the bass does not take up half the picture.
        const usable = data.length * 0.75
        for (let i = 0; i < bars; i += 1) {
          const start = Math.floor(Math.pow(usable, i / bars))
          const end = Math.max(start + 1, Math.floor(Math.pow(usable, (i + 1) / bars)))
          let sum = 0
          for (let j = start; j < end && j < data.length; j += 1) sum += data[j]
          const value = Math.min(1, (sum / (end - start) / 255) ** 1.4)
          smoothed[i] = smoothed[i] * 0.6 + value * 0.4
        }
      } else {
        for (let i = 0; i < bars; i += 1) smoothed[i] *= 0.92
      }
      const level = smoothed.reduce((sum, value) => sum + value, 0) / bars
      energy = energy * 0.9 + level * 0.1
      const t = now / 1000

      if (style === 'bars') drawBars(ctx, width, h, dpr, smoothed, accent)
      else if (style === 'ribbon') drawRibbon(ctx, width, h, dpr, smoothed, t)
      else if (style === 'aurora') drawAurora(ctx, width, h, dpr, smoothed, accent, t)
      else drawFilament(ctx, width, h, dpr, smoothed, accent, t, energy)
    }

    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [bars, enabled, isPlaying, style])

  if (!enabled) return null
  return <canvas ref={canvasRef} className={`visualizer ${className ?? ''}`} style={{ height }} aria-hidden="true" />
}

/* ------------------------------- helpers ------------------------------- */

/** Samples the spectrum into a smooth envelope across the width. */
function envelopeAt(values: number[], t: number): number {
  const position = Math.max(0, Math.min(values.length - 1, t * (values.length - 1)))
  const index = Math.floor(position)
  const next = Math.min(values.length - 1, index + 1)
  const mix = position - index
  const raw = values[index] * (1 - mix) + values[next] * mix
  return raw
}

/** Fades both ends to zero, like a wave rising out of a flat line. */
const taper = (t: number, power = 0.6): number => Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** power

function smoothPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
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

/* -------------------------------- bars -------------------------------- */

function drawBars(ctx: CanvasRenderingContext2D, width: number, h: number, dpr: number, values: number[], accent: string): void {
  const count = values.length
  const gap = Math.max(2 * dpr, (width / count) * 0.4)
  const barWidth = Math.max(1.5, (width - gap * (count - 1)) / count)
  const radius = Math.min(barWidth / 2, 4 * dpr)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  values.forEach((level, index) => {
    const barHeight = Math.max(2.5 * dpr, level * h * 0.94)
    const x = index * (barWidth + gap)
    const y = h - barHeight
    const gradient = ctx.createLinearGradient(0, y, 0, h)
    gradient.addColorStop(0, hexToRgba(accent, 0.9))
    gradient.addColorStop(1, hexToRgba(accent, 0.08))
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barHeight, radius)
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, Math.min(2.2 * dpr, barHeight), radius)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fill()
  })
  ctx.restore()
}

/* ------------------------------- ribbon ------------------------------- */

/** Two bright curves crossing each other, one thick and one thin. */
function drawRibbon(ctx: CanvasRenderingContext2D, width: number, h: number, dpr: number, values: number[], t: number): void {
  const centre = h * 0.5
  const samples = 110
  const top: Point[] = []
  const bottom: Point[] = []
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples
    const amp = (envelopeAt(values, u) * 0.45 + 0.03) * h * taper(u, 0.55)
    const angle = u * Math.PI * 6 + t * 1.4
    top.push({ x: u * width, y: centre - Math.sin(angle) * amp })
    bottom.push({ x: u * width, y: centre + Math.sin(angle + 0.6) * amp * 0.7 })
  }
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  smoothPath(ctx, bottom)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1.4 * dpr
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
  ctx.shadowBlur = 14 * dpr
  ctx.stroke()
  smoothPath(ctx, top)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = 2.4 * dpr
  ctx.shadowBlur = 22 * dpr
  ctx.stroke()
  ctx.restore()
}

/* ------------------------------- aurora ------------------------------- */

/** A veil of accent-tinted curves around a hot core line. */
function drawAurora(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  dpr: number,
  values: number[],
  accent: string,
  t: number,
): void {
  const centre = h * 0.5
  const samples = 100
  const layers = 18
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let layer = 0; layer < layers; layer += 1) {
    const spread = layer / (layers - 1) - 0.5
    const points: Point[] = []
    for (let i = 0; i <= samples; i += 1) {
      const u = i / samples
      const amp = envelopeAt(values, u) * h * 0.42 * taper(u, 0.5) + h * 0.01
      const y = centre + spread * h * 0.3 + Math.sin(u * Math.PI * 4.2 + t * 0.9 + spread * 2.4) * amp
      points.push({ x: u * width, y })
    }
    smoothPath(ctx, points)
    ctx.strokeStyle = hexToRgba(accent, Math.max(0.05, 0.42 - Math.abs(spread) * 0.7))
    ctx.lineWidth = 1.1 * dpr
    ctx.stroke()
  }
  const core: Point[] = []
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples
    const amp = envelopeAt(values, u) * h * 0.38 * taper(u, 0.5)
    core.push({ x: u * width, y: centre + Math.sin(u * Math.PI * 4.2 + t * 0.9) * amp })
  }
  smoothPath(ctx, core)
  ctx.strokeStyle = 'rgba(245, 248, 255, 0.9)'
  ctx.lineWidth = 1.8 * dpr
  ctx.shadowColor = hexToRgba(accent, 0.9)
  ctx.shadowBlur = 24 * dpr
  ctx.stroke()
  ctx.restore()
}

/* ------------------------------ filament ------------------------------ */

/**
 * Dozens of hair-thin strands braided into a travelling wave. Each strand is
 * the same wave shifted slightly in phase and depth, so together they read as
 * a translucent ribbon of light that twists as the music moves it.
 */
function drawFilament(
  ctx: CanvasRenderingContext2D,
  width: number,
  h: number,
  dpr: number,
  values: number[],
  accent: string,
  t: number,
  energy: number,
): void {
  const centre = h * 0.5
  const samples = 140
  const strands = 28
  const lift = 0.02 + energy * 0.25

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (let strand = 0; strand < strands; strand += 1) {
    const s = strand / (strands - 1)
    const twist = (s - 0.5) * 2 // -1 .. 1
    const points: Point[] = []
    for (let i = 0; i <= samples; i += 1) {
      const u = i / samples
      const env = (envelopeAt(values, u) * 0.85 + lift) * taper(u, 0.7)
      // Two travelling waves at different speeds give the braid its motion.
      const a = Math.sin(u * Math.PI * 5.2 - t * 1.6 + twist * 0.9)
      const b = Math.sin(u * Math.PI * 2.3 + t * 0.7 - twist * 1.4) * 0.45
      const depth = Math.cos(u * Math.PI * 3 + t * 0.5 + twist * Math.PI * 0.5)
      const y = centre + (a + b) * env * h * 0.42 * (0.55 + 0.45 * depth * twist)
      points.push({ x: u * width, y })
    }

    const brightness = 1 - Math.abs(twist)
    smoothPath(ctx, points)
    ctx.strokeStyle = hexToRgba(accent, 0.12 + brightness * 0.42)
    ctx.lineWidth = (0.7 + brightness * 0.6) * dpr
    ctx.stroke()

    // A white core on the middle strands, with glow, for the bright crest.
    if (Math.abs(twist) < 0.12) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.lineWidth = 1.3 * dpr
      ctx.shadowColor = hexToRgba(accent, 0.95)
      ctx.shadowBlur = 18 * dpr
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }

  // Soft centre-line glow, like light leaking along the axis.
  const glow = ctx.createLinearGradient(0, 0, width, 0)
  glow.addColorStop(0, 'rgba(255,255,255,0)')
  glow.addColorStop(0.5, hexToRgba(accent, 0.18 + energy * 0.3))
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, centre - 1 * dpr, width, 2 * dpr)

  ctx.restore()
}
