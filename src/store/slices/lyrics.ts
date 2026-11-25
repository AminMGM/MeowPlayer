import { api } from '../../api'
import type { LyricsState } from '../../types'
import { parseLrc } from '../../utils'
import type { LyricsSlice, Slice } from '../state'

export const EMPTY_LYRICS: LyricsState = { trackId: null, loading: false, synced: [], plain: null, error: null }

export const createLyricsSlice: Slice<LyricsSlice> = (set, get) => ({
  lyrics: EMPTY_LYRICS,
  lyricsDownload: { running: false, done: 0, total: 0, failed: 0 },

  fetchLyrics: async (track, force = false) => {
    const { settings, lyrics } = get()
    if (!track || !settings.lyrics || (!force && !settings.autoLyrics)) {
      set({ lyrics: EMPTY_LYRICS })
      return
    }
    // Already showing (or loading) this track's lyrics, unless a retry was asked for.
    if (!force && lyrics.trackId === track.id && !lyrics.error) return

    set({ lyrics: { trackId: track.id, loading: true, synced: [], plain: null, error: null } })
    try {
      const raw = await api.lyrics.get({
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        force,
      })
      if (get().lyrics.trackId !== track.id) return
      const synced = raw?.synced ? parseLrc(raw.synced) : []
      const plain = raw?.plain ?? null
      const instrumental = Boolean(raw?.instrumental) && !synced.length && !plain
      set({
        lyrics: {
          trackId: track.id,
          loading: false,
          synced,
          plain,
          instrumental,
          error: synced.length || plain || instrumental ? null : 'No lyrics found for this track',
        },
      })
    } catch {
      if (get().lyrics.trackId !== track.id) return
      set({
        lyrics: { trackId: track.id, loading: false, synced: [], plain: null, error: 'Lyrics are unavailable right now' },
      })
    }
  },

  /**
   * Fills the on-disk lyrics cache for the whole library. The main process
   * caches every hit, so a second run only asks for what is still missing.
   */
  downloadAllLyrics: async () => {
    if (get().lyricsDownload.running) return
    if (!get().settings.lyrics) get().updateSettings({ lyrics: true })

    const seen = new Set<string>()
    const transient = new Set(get().transientIds)
    const targets = get().tracks.filter((track) => {
      if (transient.has(track.id) || !track.title.trim()) return false
      const key = `${track.title}|${track.artist}|${track.album}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (!targets.length) {
      get().showToast('No tracks to download lyrics for', { kind: 'info' })
      return
    }

    // Songs that already have lyrics saved (or that LRCLIB recently had nothing for) are skipped.
    const saved = await api.lyrics.cached(targets.map(({ title, artist, album }) => ({ title, artist, album })))
    const alreadySaved = saved.filter(Boolean).length
    const missing = targets.filter((_, index) => !saved[index])
    if (!missing.length) {
      get().showToast(`Lyrics are already saved for all ${targets.length} songs`, { kind: 'info' })
      return
    }
    targets.splice(0, targets.length, ...missing)
    if (alreadySaved) get().showToast(`Skipping ${alreadySaved} songs that already have lyrics`, { kind: 'info' })

    set({ lyricsDownload: { running: true, done: 0, total: targets.length, failed: 0 } })
    let cursor = 0
    let failed = 0

    const worker = async (): Promise<void> => {
      while (get().lyricsDownload.running) {
        const index = cursor++
        if (index >= targets.length) return
        const track = targets[index]
        try {
          const raw = await api.lyrics.get({
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
          })
          if (!raw) failed += 1
        } catch {
          failed += 1
        }
        set((state) => ({
          lyricsDownload: {
            ...state.lyricsDownload,
            done: Math.min(state.lyricsDownload.total, state.lyricsDownload.done + 1),
            failed,
          },
        }))
      }
    }

    // Three at a time keeps LRCLIB happy without making a big library crawl.
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, () => worker()))

    const { done, total } = get().lyricsDownload
    set({ lyricsDownload: { running: false, done, total, failed } })
    get().showToast(
      done >= total ? `Lyrics ready for ${total - failed} of ${total} tracks` : `Stopped after ${done} of ${total} tracks`,
      { kind: 'info' },
    )
  },

  cancelLyricsDownload: () => {
    if (!get().lyricsDownload.running) return
    set((state) => ({ lyricsDownload: { ...state.lyricsDownload, running: false } }))
  },
})
