export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const

export const EQ_PRESETS: { name: string; gains: number[] }[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', gains: [8, 7, 5.5, 3, 0.5, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 1.5, 3, 5, 7, 8] },
  { name: 'Vocal', gains: [-2, -1, 0.5, 3, 5, 5, 3, 1, 0, -1] },
  { name: 'Rock', gains: [5, 4, 2, -1, -2, 0, 2.5, 4.5, 5.5, 5] },
  { name: 'Pop', gains: [-1, 0, 2, 4, 4.5, 2, -1, -1, 1, 2] },
  { name: 'Jazz', gains: [3, 2, 1, 2, -1, -1, 0, 1, 2.5, 3.5] },
  { name: 'Electronic', gains: [6, 5, 1, 0, -2, 1.5, 1, 2, 5, 6] },
  { name: 'Classical', gains: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
  { name: 'Lo-Fi', gains: [3, 2, 1, 0, -3, -5, -6, -8, -9, -10] },
]

interface Callbacks {
  time?: (seconds: number, duration: number) => void
  duration?: (seconds: number) => void
  ended?: () => void
  play?: () => void
  pause?: () => void
  error?: (message: string) => void
  nearEnd?: (remaining: number) => void
}

interface Deck {
  el: HTMLAudioElement
  gain: GainNode | null
  source: MediaElementAudioSourceNode | null
}

interface PlayOptions {
  autoplay?: boolean
  startAt?: number
  fade?: number
}

/**
 * Two audio decks feeding one Web Audio graph, so tracks can crossfade:
 *   deck A/B -> deck gain -> preamp -> 10 band EQ -> master -> analyser -> output
 */
class AudioEngine {
  private decks: Deck[] = []
  private active = 0
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private filters: BiquadFilterNode[] = []
  private eqGains: number[] = EQ_BANDS.map(() => 0)
  private volume = 0.8
  private muted = false
  private rate = 1
  private sinkId = ''
  private nearEndFired = false
  callbacks: Callbacks = {}

  constructor() {
    this.decks = [this.createDeck(), this.createDeck()]
  }

  private createDeck(): Deck {
    const el = new Audio()
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    const deck: Deck = { el, gain: null, source: null }
    const isActive = (): boolean => this.decks[this.active] === deck

    el.addEventListener('timeupdate', () => {
      if (!isActive()) return
      const duration = Number.isFinite(el.duration) ? el.duration : 0
      this.callbacks.time?.(el.currentTime, duration)
      if (!this.nearEndFired && duration > 0) {
        const remaining = duration - el.currentTime
        if (remaining > 0.05 && remaining <= 0.35) this.nearEndFired = true
      }
    })
    el.addEventListener('durationchange', () => {
      if (isActive() && Number.isFinite(el.duration)) this.callbacks.duration?.(el.duration)
    })
    el.addEventListener('ended', () => {
      if (!isActive()) return
      this.nearEndFired = false
      this.callbacks.ended?.()
    })
    el.addEventListener('play', () => {
      if (isActive()) this.callbacks.play?.()
    })
    el.addEventListener('pause', () => {
      if (isActive()) this.callbacks.pause?.()
    })
    el.addEventListener('error', () => {
      if (!isActive()) return
      const code = el.error?.code
      const messages: Record<number, string> = {
        1: 'Playback was aborted',
        2: 'Network error while loading the track',
        3: 'This file cannot be decoded',
        4: 'Unsupported audio format or missing file',
      }
      this.callbacks.error?.(code ? messages[code] ?? 'Unable to play this track' : 'Unable to play this track')
    })
    return deck
  }

  private ensureGraph(): void {
    if (this.ctx) return
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()

      const preamp = ctx.createGain()
      preamp.gain.value = 0.85
      const master = ctx.createGain()
      master.gain.value = this.gainTarget()

      let node: AudioNode = preamp
      this.filters = EQ_BANDS.map((frequency, index) => {
        const filter = ctx.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = frequency
        filter.Q.value = 1.1
        filter.gain.value = this.eqGains[index] ?? 0
        node.connect(filter)
        node = filter
        return filter
      })

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.82
      node.connect(master)
      master.connect(analyser)
      analyser.connect(ctx.destination)

      for (const deck of this.decks) {
        const source = ctx.createMediaElementSource(deck.el)
        const gain = ctx.createGain()
        gain.gain.value = 1
        source.connect(gain)
        gain.connect(preamp)
        deck.source = source
        deck.gain = gain
        deck.el.volume = 1
      }

      this.ctx = ctx
      this.master = master
      this.analyser = analyser
      void this.applySink()
    } catch (err) {
      console.warn('[audio] could not build the equalizer graph', err)
    }
  }

  private gainTarget(): number {
    return this.muted ? 0 : Math.max(0, this.volume)
  }

  private async applySink(): Promise<void> {
    const ctx = this.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null
    if (!ctx?.setSinkId) return
    try {
      await ctx.setSinkId(this.sinkId)
    } catch (err) {
      console.warn('[audio] could not switch output device', err)
    }
  }

  private async safePlay(el: HTMLAudioElement): Promise<void> {
    try {
      await el.play()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to play this track'
      if (!message.toLowerCase().includes('interrupted')) this.callbacks.error?.(message)
    }
  }

  async play(url: string, opts: PlayOptions = {}): Promise<void> {
    this.ensureGraph()
    if (this.ctx?.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* ignore */
      }
    }

    const fade = opts.fade ?? 0
    const current = this.decks[this.active]
    const canCrossfade = fade > 0.4 && Boolean(current.el.src) && !current.el.paused

    if (canCrossfade) {
      await this.crossfadeTo(url, fade, opts.startAt ?? 0)
      return
    }

    const deck = this.decks[this.active]
    if (deck.gain && this.ctx) {
      deck.gain.gain.cancelScheduledValues(this.ctx.currentTime)
      deck.gain.gain.setValueAtTime(1, this.ctx.currentTime)
    }
    deck.el.src = url
    if (opts.startAt && opts.startAt > 0) {
      const startAt = opts.startAt
      deck.el.addEventListener(
        'loadedmetadata',
        () => {
          try {
            deck.el.currentTime = startAt
          } catch {
            /* ignore */
          }
        },
        { once: true },
      )
    }
    deck.el.load()
    deck.el.playbackRate = this.rate
    this.nearEndFired = false
    if (opts.autoplay !== false) await this.safePlay(deck.el)
  }

  private async crossfadeTo(url: string, seconds: number, startAt: number): Promise<void> {
    const ctx = this.ctx
    const current = this.decks[this.active]
    const nextIndex = 1 - this.active
    const next = this.decks[nextIndex]
    if (!ctx) return

    next.el.src = url
    next.el.load()
    if (startAt > 0) {
      next.el.addEventListener(
        'loadedmetadata',
        () => {
          try {
            next.el.currentTime = startAt
          } catch {
            /* ignore */
          }
        },
        { once: true },
      )
    }
    next.el.playbackRate = this.rate
    if (next.gain) next.gain.gain.setValueAtTime(0.0001, ctx.currentTime)

    await this.safePlay(next.el)

    const now = ctx.currentTime
    const span = Math.max(0.4, seconds)
    if (next.gain) {
      next.gain.gain.cancelScheduledValues(now)
      next.gain.gain.setValueAtTime(0.0001, now)
      next.gain.gain.linearRampToValueAtTime(1, now + span)
    }
    if (current.gain) {
      current.gain.gain.cancelScheduledValues(now)
      current.gain.gain.setValueAtTime(Math.max(0.0001, current.gain.gain.value), now)
      current.gain.gain.linearRampToValueAtTime(0.0001, now + span)
    }

    this.active = nextIndex
    this.nearEndFired = false

    window.setTimeout(() => {
      if (this.decks[this.active] !== next) return
      current.el.pause()
      if (current.gain && this.ctx) current.gain.gain.setValueAtTime(1, this.ctx.currentTime)
    }, span * 1000 + 150)
  }

  async resume(): Promise<void> {
    this.ensureGraph()
    if (this.ctx?.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* ignore */
      }
    }
    await this.safePlay(this.decks[this.active].el)
  }

  pause(): void {
    this.decks[this.active].el.pause()
  }

  /**
   * Ramps the master output down to silence over `seconds`, then pauses. The
   * gain is restored afterwards so the next play is at normal volume again.
   */
  fadeOut(seconds: number, onDone?: () => void): void {
    const el = this.decks[this.active].el
    const span = Math.max(0.3, seconds)
    if (!this.ctx || !this.master) {
      el.pause()
      onDone?.()
      return
    }
    const now = this.ctx.currentTime
    const gain = this.master.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(0.0001, gain.value), now)
    gain.linearRampToValueAtTime(0.0001, now + span)
    window.setTimeout(() => {
      el.pause()
      if (this.ctx && this.master) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime)
        this.master.gain.setValueAtTime(this.gainTarget(), this.ctx.currentTime)
      }
      onDone?.()
    }, span * 1000 + 80)
  }

  stop(): void {
    for (const deck of this.decks) {
      deck.el.pause()
      deck.el.removeAttribute('src')
      deck.el.load()
    }
    this.nearEndFired = false
  }

  seek(seconds: number): void {
    const deck = this.decks[this.active]
    if (!Number.isFinite(seconds)) return
    try {
      deck.el.currentTime = Math.max(0, seconds)
      this.nearEndFired = false
    } catch {
      /* not seekable yet */
    }
  }

  setVolume(volume: number, muted: boolean): void {
    this.volume = volume
    this.muted = muted
    const target = this.gainTarget()
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setTargetAtTime(target, now, 0.02)
    } else {
      this.decks[this.active].el.volume = Math.min(1, target)
    }
  }

  setRate(rate: number): void {
    this.rate = rate
    for (const deck of this.decks) {
      deck.el.playbackRate = rate
      deck.el.preservesPitch = true
    }
  }

  setEqGains(gains: number[]): void {
    this.eqGains = gains
    if (!this.ctx) return
    const now = this.ctx.currentTime
    gains.forEach((gain, index) => {
      const filter = this.filters[index]
      if (filter) filter.gain.setTargetAtTime(gain, now, 0.05)
    })
  }

  async setSink(id: string): Promise<void> {
    this.sinkId = id
    this.ensureGraph()
    await this.applySink()
  }

  getAnalyser(): AnalyserNode | null {
    if (!this.ctx) this.ensureGraph()
    return this.analyser
  }

  getElement(): HTMLAudioElement {
    return this.decks[this.active].el
  }
}

export const engine = new AudioEngine()
