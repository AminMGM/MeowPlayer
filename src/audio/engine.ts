import { EQ_BANDS } from './eq'

export { EQ_BANDS, EQ_PRESETS } from './eq'

/** How long before the end the next track is buffered for gapless playback. */
const PRELOAD_LEAD = 12

interface Callbacks {
  time?: (seconds: number, duration: number) => void
  duration?: (seconds: number) => void
  ended?: () => void
  play?: () => void
  pause?: () => void
  error?: (message: string) => void
  /** Fired once per track when the remaining time drops below `transitionLead`. */
  transition?: () => void
  /** Fired once per track shortly before the end, to buffer the next track. */
  preload?: () => void
}

interface Deck {
  el: HTMLAudioElement
  gain: GainNode | null
  /** Loudness correction for the track on this deck, as a linear factor. */
  level: number
  /** URL buffered ahead of time for gapless playback, if any. */
  preloaded: string | null
}

export interface PlayOptions {
  autoplay?: boolean
  startAt?: number
  /** Crossfade length in seconds; 0 switches instantly. */
  fade?: number
  /** Loudness correction in dB from ReplayGain tags. */
  gainDb?: number | null
}

const dbToLevel = (db: number | null | undefined): number =>
  typeof db === 'number' && Number.isFinite(db) ? Math.min(2, Math.max(0.1, 10 ** (db / 20))) : 1

/**
 * Two audio decks feeding one Web Audio graph, so tracks can crossfade and the
 * next track can be buffered ahead of time:
 *
 *   deck A/B -> deck gain -> preamp -> 10-band EQ -> master (volume)
 *            -> fader (sleep timer) -> analyser -> output
 */
class AudioEngine {
  private decks: Deck[]
  private active = 0
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private fader: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private filters: BiquadFilterNode[] = []
  private eqGains: number[] = EQ_BANDS.map(() => 0)
  private volume = 0.8
  private muted = false
  private rate = 1
  private sinkId = ''
  private transitionFired = false
  private preloadFired = false
  private fadeTimer: number | null = null
  /** Bumped by every play() so a slow, stale request can never win a race. */
  private token = 0

  /** Seconds before the end at which `transition` fires (the crossfade length). */
  transitionLead = 0
  callbacks: Callbacks = {}

  constructor() {
    this.decks = [this.createDeck(), this.createDeck()]
  }

  private get current(): Deck {
    return this.decks[this.active]
  }

  private get idle(): Deck {
    return this.decks[1 - this.active]
  }

  private createDeck(): Deck {
    const el = new Audio()
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    const deck: Deck = { el, gain: null, level: 1, preloaded: null }
    const isActive = (): boolean => this.current === deck

    el.addEventListener('timeupdate', () => {
      if (!isActive()) return
      const duration = Number.isFinite(el.duration) ? el.duration : 0
      this.callbacks.time?.(el.currentTime, duration)
      if (duration <= 0 || el.paused) return
      const remaining = duration - el.currentTime
      if (!this.preloadFired && remaining <= PRELOAD_LEAD) {
        this.preloadFired = true
        this.callbacks.preload?.()
      }
      if (!this.transitionFired && this.transitionLead > 0.4 && remaining <= this.transitionLead && remaining > 0.2) {
        this.transitionFired = true
        this.callbacks.transition?.()
      }
    })
    el.addEventListener('durationchange', () => {
      if (isActive() && Number.isFinite(el.duration)) this.callbacks.duration?.(el.duration)
    })
    el.addEventListener('ended', () => {
      if (isActive()) this.callbacks.ended?.()
    })
    el.addEventListener('play', () => {
      if (isActive()) this.callbacks.play?.()
    })
    el.addEventListener('pause', () => {
      // An element also pauses itself when it reaches the end; that is not a user pause.
      if (isActive() && !el.ended) this.callbacks.pause?.()
    })
    el.addEventListener('error', () => {
      if (!isActive() || !el.getAttribute('src')) return
      const messages: Record<number, string> = {
        1: 'Playback was aborted',
        2: 'Network error while loading the track',
        3: 'This file cannot be decoded',
        4: 'Unsupported audio format or missing file',
      }
      const code = el.error?.code
      this.callbacks.error?.((code && messages[code]) || 'Unable to play this track')
    })
    return deck
  }

  private ensureGraph(): void {
    if (this.ctx) return
    try {
      const ctx = new AudioContext({ latencyHint: 'playback' })

      const preamp = ctx.createGain()
      preamp.gain.value = 0.85
      const master = ctx.createGain()
      master.gain.value = this.gainTarget()
      const fader = ctx.createGain()
      fader.gain.value = 1

      let node: AudioNode = preamp
      this.filters = EQ_BANDS.map((frequency, index) => {
        const filter = ctx.createBiquadFilter()
        filter.type = index === 0 ? 'lowshelf' : index === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
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
      master.connect(fader)
      fader.connect(analyser)
      analyser.connect(ctx.destination)

      for (const deck of this.decks) {
        const source = ctx.createMediaElementSource(deck.el)
        const gain = ctx.createGain()
        gain.gain.value = deck === this.current ? deck.level : 0
        source.connect(gain)
        gain.connect(preamp)
        deck.gain = gain
        deck.el.volume = 1
      }

      this.ctx = ctx
      this.master = master
      this.fader = fader
      this.analyser = analyser
      void this.applySink()
    } catch (err) {
      console.warn('[audio] could not build the audio graph', err)
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

  private async wake(): Promise<void> {
    this.ensureGraph()
    if (this.ctx?.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* resumes on the next user gesture */
      }
    }
  }

  private async safePlay(el: HTMLAudioElement): Promise<void> {
    try {
      await el.play()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to play this track'
      if (!/interrupted|aborted|removed from the document|new load request/i.test(message)) {
        this.callbacks.error?.(message)
      }
    }
  }

  private setDeckGain(deck: Deck, value: number): void {
    if (deck.gain && this.ctx) {
      deck.gain.gain.cancelScheduledValues(this.ctx.currentTime)
      deck.gain.gain.setValueAtTime(value, this.ctx.currentTime)
    } else {
      deck.el.volume = Math.min(1, value * Math.min(1, this.gainTarget()))
    }
  }

  private load(deck: Deck, url: string, startAt: number): void {
    if (deck.preloaded !== url) {
      deck.el.src = url
      deck.el.load()
    }
    deck.preloaded = null
    deck.el.playbackRate = this.rate
    deck.el.preservesPitch = true
    if (startAt > 0) {
      const seek = (): void => {
        try {
          deck.el.currentTime = startAt
        } catch {
          /* not seekable */
        }
      }
      if (deck.el.readyState >= 1) seek()
      else deck.el.addEventListener('loadedmetadata', seek, { once: true })
    } else if (deck.el.currentTime > 0) {
      try {
        deck.el.currentTime = 0
      } catch {
        /* not seekable */
      }
    }
  }

  private resetMarkers(): void {
    this.transitionFired = false
    this.preloadFired = false
  }

  async play(url: string, opts: PlayOptions = {}): Promise<void> {
    const token = ++this.token
    await this.wake()
    if (token !== this.token) return

    const fade = opts.fade ?? 0
    const startAt = opts.startAt ?? 0
    const level = dbToLevel(opts.gainDb)
    const from = this.current
    const canCrossfade = fade > 0.4 && Boolean(from.el.getAttribute('src')) && !from.el.paused && Boolean(this.ctx)

    // Crossfades and preloaded (gapless) tracks start on the idle deck.
    if (canCrossfade || this.idle.preloaded === url) {
      const to = this.idle
      to.level = level
      this.load(to, url, startAt)
      this.setDeckGain(to, canCrossfade ? 0.0001 : level)
      this.active = 1 - this.active
      this.resetMarkers()
      if (opts.autoplay !== false) await this.safePlay(to.el)
      if (token !== this.token) return

      if (canCrossfade && this.ctx && to.gain && from.gain) {
        const now = this.ctx.currentTime
        const span = Math.max(0.4, fade)
        to.gain.gain.cancelScheduledValues(now)
        to.gain.gain.setValueAtTime(0.0001, now)
        to.gain.gain.linearRampToValueAtTime(level, now + span)
        from.gain.gain.cancelScheduledValues(now)
        from.gain.gain.setValueAtTime(Math.max(0.0001, from.gain.gain.value), now)
        from.gain.gain.linearRampToValueAtTime(0.0001, now + span)
        window.setTimeout(() => {
          if (this.current !== from) from.el.pause()
        }, span * 1000 + 150)
      } else {
        from.el.pause()
        this.setDeckGain(from, 0)
      }
      return
    }

    // Plain switch on the current deck; silence the other one in case it was mid-crossfade.
    this.idle.el.pause()
    this.idle.preloaded = null
    this.setDeckGain(this.idle, 0)
    from.level = level
    this.setDeckGain(from, level)
    this.load(from, url, startAt)
    this.resetMarkers()
    if (opts.autoplay !== false) await this.safePlay(from.el)
  }

  /** Buffers the next track on the idle deck so it can start without a gap. */
  preload(url: string): void {
    const deck = this.idle
    if (deck.preloaded === url || !deck.el.paused) return
    deck.preloaded = url
    deck.el.src = url
    deck.el.load()
    this.setDeckGain(deck, 0)
  }

  async resume(): Promise<void> {
    await this.wake()
    await this.safePlay(this.current.el)
  }

  pause(): void {
    this.current.el.pause()
  }

  /**
   * Fades the output to silence over `seconds`, then pauses. The fade runs on
   * its own gain stage, so changing the volume meanwhile does not cancel it.
   */
  fadeOut(seconds: number, onDone?: () => void): void {
    const span = Math.max(0.3, seconds)
    if (this.fadeTimer) window.clearTimeout(this.fadeTimer)
    if (!this.ctx || !this.fader) {
      this.pause()
      onDone?.()
      return
    }
    const now = this.ctx.currentTime
    const gain = this.fader.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(0.0001, gain.value), now)
    gain.linearRampToValueAtTime(0.0001, now + span)
    this.fadeTimer = window.setTimeout(() => {
      this.fadeTimer = null
      this.pause()
      this.cancelFade()
      onDone?.()
    }, span * 1000 + 80)
  }

  /** Stops a running sleep fade and restores full output. */
  cancelFade(): void {
    if (this.fadeTimer) {
      window.clearTimeout(this.fadeTimer)
      this.fadeTimer = null
    }
    if (this.ctx && this.fader) {
      this.fader.gain.cancelScheduledValues(this.ctx.currentTime)
      this.fader.gain.setValueAtTime(1, this.ctx.currentTime)
    }
  }

  stop(): void {
    this.token += 1
    for (const deck of this.decks) {
      deck.el.pause()
      deck.el.removeAttribute('src')
      deck.el.load()
      deck.preloaded = null
    }
    this.resetMarkers()
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return
    try {
      this.current.el.currentTime = Math.max(0, seconds)
      this.resetMarkers()
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
      this.current.el.volume = Math.min(1, target)
    }
  }

  setRate(rate: number): void {
    this.rate = rate
    for (const deck of this.decks) {
      deck.el.playbackRate = rate
      deck.el.preservesPitch = true
    }
  }

  /** Changes the loudness correction of the playing track. */
  setTrackGain(db: number | null | undefined): void {
    const deck = this.current
    deck.level = dbToLevel(db)
    if (deck.gain && this.ctx) deck.gain.gain.setTargetAtTime(deck.level, this.ctx.currentTime, 0.05)
  }

  setEqGains(gains: number[]): void {
    this.eqGains = gains
    if (!this.ctx) return
    const now = this.ctx.currentTime
    gains.forEach((gain, index) => this.filters[index]?.gain.setTargetAtTime(gain, now, 0.05))
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

  /** The exact playback position, for things that animate every frame (lyrics). */
  get currentTime(): number {
    return this.current.el.currentTime
  }

  get paused(): boolean {
    return this.current.el.paused
  }
}

export const engine = new AudioEngine()
