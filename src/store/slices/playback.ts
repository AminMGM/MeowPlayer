import { api } from '../../api'
import { engine } from '../../audio/engine'
import type { RepeatMode, Settings, Track } from '../../types'
import { shuffleArray } from '../../utils'
import { persist, sessionOf } from '../persist'
import * as Q from '../queue'
import type { AppState, PlaybackSlice, Slice } from '../state'

/** The loudness correction for a track under the current normalisation mode. */
export function gainFor(track: Track, mode: Settings['normalize']): number | null {
  if (mode === 'off') return null
  if (mode === 'album') return track.albumGain ?? track.trackGain ?? null
  return track.trackGain ?? track.albumGain ?? null
}

const trackById = (s: AppState, id: string | undefined): Track | undefined =>
  id ? s.tracks.find((track) => track.id === id) : undefined

export const createPlaybackSlice: Slice<PlaybackSlice> = (set, get) => {
  /** Loads and starts a track that is already at `queueIndex`. */
  const start = (track: Track, opts: { fade?: number } = {}): void => {
    set({
      playingTrack: track,
      isPlaying: true,
      time: 0,
      duration: track.duration || 0,
      contextMenu: null,
    })
    void engine.play(track.url, {
      autoplay: true,
      fade: opts.fade ?? 0,
      gainDb: gainFor(track, get().settings.normalize),
    })
    void get().fetchLyrics(track)
    get().recordPlay(track)
    persist('session')
  }

  return {
    queue: [],
    queueIndex: -1,
    originalQueue: [],
    playingTrack: null,
    isPlaying: false,
    time: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    shuffle: false,
    repeat: 'off',
    rate: 1,
    sleepMode: 'off',
    sleepUntil: null,
    devices: [],

    playTracks: (ids, index) => {
      const list = ids.filter(Boolean)
      const target = list[index]
      if (!target) return
      if (get().shuffle) {
        // Start with the chosen track, then everything else in shuffled order.
        const rest = shuffleArray(list.filter((_, i) => i !== index))
        set({ queue: [target, ...rest], queueIndex: 0, originalQueue: list })
      } else {
        set({ queue: list, queueIndex: index, originalQueue: list })
      }
      get().jump(get().queueIndex)
    },

    jump: (index, opts) => {
      const s = get()
      const track = trackById(s, s.queue[index])
      if (!track) {
        s.showToast('That track is no longer in your library', { kind: 'error' })
        return
      }
      set({ queueIndex: index })
      start(track, opts)
    },

    togglePlay: () => {
      const { isPlaying, playingTrack, queue, queueIndex, tracks } = get()
      if (!playingTrack) {
        if (queue.length) get().jump(Math.max(0, queueIndex))
        else if (tracks.length) get().playTracks(tracks.map((track) => track.id), 0)
        return
      }
      if (isPlaying) get().pause()
      else get().resume()
    },

    pause: () => engine.pause(),

    resume: () => {
      const { playingTrack, sleepUntil } = get()
      if (!playingTrack) {
        get().togglePlay()
        return
      }
      // Pressing play during the sleep fade cancels the timer.
      if (sleepUntil && sleepUntil - Date.now() < 16_000) {
        engine.cancelFade()
        set({ sleepMode: 'off', sleepUntil: null })
      }
      void engine.resume()
    },

    next: (auto = false) => {
      const s = get()
      if (!s.queue.length) return

      if (auto && s.sleepMode === 'track') {
        engine.pause()
        set({ sleepMode: 'off', sleepUntil: null, isPlaying: false })
        s.showToast('Sleep timer stopped playback', { kind: 'info' })
        return
      }

      const index = Q.nextIndex(s.queue.length, s.queueIndex, s.repeat, auto)
      if (index === null) {
        // End of the queue with repeat off: stop on the last track.
        set({ isPlaying: false })
        return
      }
      if (index === s.queueIndex && auto) {
        // Repeat one: replay without counting a skip.
        engine.seek(0)
        void engine.resume()
        if (s.playingTrack) s.recordPlay(s.playingTrack)
        return
      }
      get().jump(index, { fade: auto ? s.settings.crossfade : 0 })
    },

    prev: () => {
      const { queue, queueIndex, time } = get()
      if (!queue.length) return
      if (time > 3) {
        get().seek(0)
        return
      }
      const index = Q.prevIndex(queue.length, queueIndex)
      if (index !== null) get().jump(index)
    },

    seek: (seconds) => {
      const duration = get().duration
      const target = Math.max(0, duration > 0 ? Math.min(seconds, duration - 0.25) : seconds)
      engine.seek(target)
      set({ time: target })
    },

    setVolume: (volume) => {
      const max = get().settings.amplify ? 1.5 : 1
      const clamped = Math.min(max, Math.max(0, volume))
      const muted = clamped > 0 ? false : get().muted
      engine.setVolume(clamped, muted)
      set({ volume: clamped, muted, settings: { ...get().settings, volume: clamped, muted } })
      persist('settings')
    },

    toggleMute: () => {
      const muted = !get().muted
      engine.setVolume(get().volume, muted)
      set({ muted, settings: { ...get().settings, muted } })
      persist('settings')
    },

    setRate: (rate) => {
      engine.setRate(rate)
      set({ rate, settings: { ...get().settings, rate } })
      persist('settings')
    },

    toggleShuffle: () => {
      const s = get()
      if (!s.shuffle) {
        const next = Q.shuffleUpcoming({ queue: s.queue, index: s.queueIndex })
        set({ shuffle: true, originalQueue: s.queue, queue: next.queue, queueIndex: next.index })
      } else {
        const next = Q.unshuffle({ queue: s.queue, index: s.queueIndex }, s.originalQueue)
        set({ shuffle: false, queue: next.queue, queueIndex: next.index })
      }
      persist('session')
    },

    cycleRepeat: () => {
      const order: RepeatMode[] = ['off', 'all', 'one']
      set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] })
    },

    saveSession: () => {
      void api.store.save({ session: sessionOf(get()) })
    },

    playNext: (ids) => {
      const s = get()
      if (!s.playingTrack) {
        s.playTracks(ids, 0)
        return
      }
      const next = Q.insertNext({ queue: s.queue, index: s.queueIndex }, ids)
      set({ queue: next.queue, originalQueue: [...s.originalQueue, ...ids.filter((id) => !s.originalQueue.includes(id))] })
      persist('session')
      s.showToast(ids.length > 1 ? `${ids.length} tracks play next` : 'Playing next')
    },

    addToQueue: (ids) => {
      const s = get()
      const next = Q.append({ queue: s.queue, index: s.queueIndex }, ids)
      set({ queue: next.queue, originalQueue: [...s.originalQueue, ...ids] })
      persist('session')
      if (!s.playingTrack) {
        get().jump(s.queue.length)
        return
      }
      s.showToast(ids.length > 1 ? `${ids.length} tracks added to the queue` : 'Added to the queue')
    },

    removeFromQueue: (index) => {
      const s = get()
      const next = Q.removeAt({ queue: s.queue, index: s.queueIndex }, index)
      set({ queue: next.queue, queueIndex: next.index })
      persist('session')
    },

    reorderQueue: (from, to) => {
      const s = get()
      const next = Q.move({ queue: s.queue, index: s.queueIndex }, from, to)
      set({ queue: next.queue, queueIndex: next.index })
      persist('session')
    },

    clearQueue: () => {
      const { playingTrack, queue, queueIndex } = get()
      const removed = Math.max(0, queue.length - queueIndex - 1)
      if (!playingTrack) {
        set({ queue: [], queueIndex: -1, originalQueue: [] })
      } else {
        set({ queue: [playingTrack.id], queueIndex: 0, originalQueue: [playingTrack.id] })
        get().showToast(removed ? `Cleared ${removed} upcoming tracks` : 'Nothing was queued', { kind: 'info' })
      }
      persist('session')
    },

    smartQueue: () => {
      const { queue, queueIndex, playingTrack, tracks, history } = get()
      if (!playingTrack) {
        get().showToast('Play a track first', { kind: 'info' })
        return
      }
      const recent = new Set(history.slice(0, 20).map((entry) => entry.id))
      const taken = new Set(queue)
      const lower = (value: string): string => value.trim().toLowerCase()
      const candidates = tracks.filter((track) => track.id !== playingTrack.id && !taken.has(track.id))
      const sameGenre = playingTrack.genre
        ? candidates.filter((track) => lower(track.genre) === lower(playingTrack.genre))
        : []
      const sameArtist = candidates.filter(
        (track) => !sameGenre.includes(track) && lower(track.artist) === lower(playingTrack.artist),
      )
      const albumMates = candidates.filter(
        (track) =>
          !sameGenre.includes(track) && !sameArtist.includes(track) && lower(track.album) === lower(playingTrack.album),
      )
      const pick = (pool: Track[], limit: number): Track[] =>
        shuffleArray(pool.filter((track) => !recent.has(track.id))).slice(0, limit)
      const additions = [...pick(sameGenre, 8), ...pick(sameArtist, 4), ...pick(albumMates, 3)]

      if (!additions.length) {
        get().showToast('No similar tracks found in the library', { kind: 'info' })
        return
      }
      const ids = additions.map((track) => track.id)
      const head = queue.slice(0, queueIndex + 1)
      const rest = queue.slice(queueIndex + 1)
      set({ queue: [...head, ...ids, ...rest], originalQueue: [...get().originalQueue, ...ids] })
      persist('session')
      get().showToast(`Smart queue added ${additions.length} tracks`)
    },

    setSleep: (mode, minutes) => {
      engine.cancelFade()
      if (mode === 'off') {
        set({ sleepMode: 'off', sleepUntil: null })
        return
      }
      if (mode === 'track') {
        set({ sleepMode: 'track', sleepUntil: null })
        get().showToast('Playback will stop after this track', { kind: 'info' })
        return
      }
      const length = Math.max(1, minutes ?? 30)
      set({ sleepMode: 'time', sleepUntil: Date.now() + length * 60_000 })
      get().showToast(`Sleep timer set for ${length} minutes`, { kind: 'info' })
    },

    refreshDevices: async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices()
        const outputs = all
          .filter((device) => device.kind === 'audiooutput' && device.deviceId !== 'default')
          .map((device) => ({ id: device.deviceId, label: device.label || 'Output device' }))
        set({ devices: outputs })
      } catch {
        set({ devices: [] })
      }
    },

    setSink: async (deviceId) => {
      set({ settings: { ...get().settings, sinkId: deviceId } })
      persist('settings')
      await engine.setSink(deviceId)
      get().showToast(deviceId ? 'Output device changed' : 'Using the default output')
    },

    preloadNext: () => {
      const s = get()
      if (!s.settings.gapless && s.settings.crossfade <= 0) return
      const index = Q.nextIndex(s.queue.length, s.queueIndex, s.repeat, true)
      if (index === null || index === s.queueIndex) return
      const track = trackById(s, s.queue[index])
      if (track) engine.preload(track.url)
    },
  }
}
