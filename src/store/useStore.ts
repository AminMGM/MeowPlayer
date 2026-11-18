import { create } from 'zustand'
import { api } from '../api'
import { engine, EQ_BANDS, EQ_PRESETS } from '../audio/engine'
import type {
  AudioDevice,
  DockTab,
  ExternalTrack,
  HistoryEntry,
  LyricsState,
  Playlist,
  RepeatMode,
  SessionState,
  Settings,
  SleepMode,
  StatsEntry,
  Track,
  UpdateInfo,
  View,
} from '../types'
import { activeLyricIndex, parseLrc, shuffleArray, uid } from '../utils'

export const DEFAULT_SETTINGS: Settings = {
  accent: '#a3b7c9',
  gradient: 'mono',
  blur: 38,
  animations: true,
  volume: 0.8,
  muted: false,
  rate: 1,
  folders: [],
  folderAliases: {},
  eqGains: EQ_BANDS.map(() => 0),
  eqPreset: 'Flat',
  eqPresets: [],
  visualizer: true,
  visualizerStyle: 'bars',
  hideDuplicates: false,
  uiScale: 1,
  notifications: false,
  albumTheming: false,
  updateCheck: true,
  updateSnoozedUntil: null,
  crossfade: 0,
  amplify: false,
  lyrics: true,
  autoLyrics: true,
  miniLyrics: true,
  collapsedSidebar: false,
  closeBehavior: 'ask',
  sinkId: '',
  firstOpenedAt: null,
  lastOpenedAt: null,
  lastGreetingId: null,
}

const EMPTY_LYRICS: LyricsState = { trackId: null, loading: false, synced: [], plain: null, error: null }

interface AppState {
  ready: boolean
  tracks: Track[]
  playlists: Playlist[]
  favorites: string[]
  stats: Record<string, StatsEntry>
  history: HistoryEntry[]
  settings: Settings

  queue: string[]
  queueIndex: number
  currentId: string | null
  playingTrack: Track | null
  external: ExternalTrack | null
  isPlaying: boolean
  time: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  rate: number

  view: View
  search: string
  dockTab: DockTab
  dockOpen: boolean
  settingsOpen: boolean
  contextMenu: { x: number; y: number; trackId: string } | null
  toast: string | null
  scanning: boolean
  scanProgress: { done: number; total: number }
  sleepMode: SleepMode
  sleepUntil: number | null
  tagEditId: string | null

  lyrics: LyricsState
  /** Progress of the library-wide lyrics download. */
  lyricsDownload: { running: boolean; done: number; total: number; failed: number }
  devices: AudioDevice[]
  version: string
  update: UpdateInfo | null
  checkingUpdate: boolean
  /** Greeting flags resolved at startup, before the timestamps are updated. */
  firstLaunchSession: boolean
  returningSession: boolean

  init: () => Promise<void>
  setView: (view: View) => void
  setSearch: (value: string) => void
  setDockTab: (tab: DockTab) => void
  toggleDock: (tab?: DockTab) => void
  setSettingsOpen: (open: boolean) => void
  showMiniPlayer: () => void
  setContextMenu: (menu: AppState['contextMenu']) => void
  showToast: (message: string) => void

  updateSettings: (patch: Partial<Settings>) => void
  addFolders: () => Promise<void>
  rescan: () => Promise<void>
  removeFolder: (folder: string) => Promise<void>
  clearLibrary: () => void
  importPlaylistFile: () => Promise<void>
  exportPlaylistFile: (playlistId: string) => Promise<void>
  ingestPaths: (paths: string[]) => Promise<void>
  openFiles: (paths: string[]) => Promise<void>
  addExternalToLibrary: () => void

  playTracks: (ids: string[], index: number, opts?: { fade?: number }) => void
  togglePlay: () => void
  next: (auto?: boolean) => void
  prev: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setRate: (rate: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  saveSession: () => void

  playNext: (ids: string[]) => void
  addToQueue: (ids: string[]) => void
  removeFromQueue: (index: number) => void
  reorderQueue: (from: number, to: number) => void
  clearQueue: () => void

  toggleLike: (id: string) => void
  createPlaylist: (name: string, trackIds?: string[]) => string
  renamePlaylist: (id: string, name: string) => void
  setPlaylistCover: (id: string, cover: string | null) => void
  renameFolder: (path: string, name: string) => void
  deletePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, ids: string[]) => void
  removeFromPlaylist: (playlistId: string, trackId: string) => void
  reorderPlaylist: (playlistId: string, from: number, to: number) => void

  setEqGain: (index: number, value: number) => void
  applyEqPreset: (name: string) => void
  saveEqPreset: (name: string) => void
  deleteEqPreset: (name: string) => void
  setSleep: (mode: SleepMode, minutes?: number) => void
  checkUpdates: (force?: boolean) => Promise<void>
  installUpdate: () => Promise<void>
  snoozeUpdate: (days?: number) => Promise<void>
  setTagEdit: (id: string | null) => void
  updateTrack: (id: string, patch: Partial<Track>) => void
  smartQueue: () => void

  fetchLyrics: (track: Track | null, force?: boolean) => Promise<void>
  downloadAllLyrics: () => Promise<void>
  cancelLyricsDownload: () => void
  refreshDevices: () => Promise<void>
  setSink: (deviceId: string) => Promise<void>
  activeLyric: () => number
}

let saveTimer: number | null = null
const persist = (): void => {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const s = useStore.getState()
    void api.store.save({
      tracks: s.tracks,
      playlists: s.playlists,
      favorites: s.favorites,
      stats: s.stats,
      settings: s.settings,
      history: s.history,
      session: {
        trackId: s.playingTrack?.id ?? s.currentId,
        queue: s.queue,
        queueIndex: s.queueIndex,
        position: s.time,
      } satisfies SessionState,
    })
  }, 500)
}

const dedupe = (ids: string[]): string[] => [...new Set(ids)]

export const useStore = create<AppState>()((set, get) => ({
  ready: false,
  tracks: [],
  playlists: [],
  favorites: [],
  stats: {},
  history: [],
  settings: DEFAULT_SETTINGS,

  queue: [],
  queueIndex: -1,
  currentId: null,
  playingTrack: null,
  external: null,
  isPlaying: false,
  time: 0,
  duration: 0,
  volume: DEFAULT_SETTINGS.volume,
  muted: false,
  shuffle: false,
  repeat: 'off',
  rate: 1,

  view: { kind: 'home' },
  search: '',
  dockTab: 'lyrics',
  dockOpen: true,
  settingsOpen: false,
  contextMenu: null,
  toast: null,
  scanning: false,
  scanProgress: { done: 0, total: 0 },
  sleepMode: 'off',
  sleepUntil: null,
  tagEditId: null,

  lyrics: EMPTY_LYRICS,
  lyricsDownload: { running: false, done: 0, total: 0, failed: 0 },
  devices: [],
  version: '1.0.0',
  update: null,
  checkingUpdate: false,
  firstLaunchSession: false,
  returningSession: false,

  init: async () => {
    let raw: Record<string, unknown> = {}
    try {
      raw = await api.store.load()
    } catch (err) {
      console.error('Failed to read saved state', err)
    }

    const savedSettings = (raw.settings as Partial<Settings> | undefined) ?? {}
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      eqGains:
        Array.isArray(savedSettings.eqGains) && savedSettings.eqGains.length === EQ_BANDS.length
          ? savedSettings.eqGains
          : DEFAULT_SETTINGS.eqGains,
      folderAliases:
        savedSettings.folderAliases && typeof savedSettings.folderAliases === 'object'
          ? savedSettings.folderAliases
          : {},
      eqPresets: Array.isArray(savedSettings.eqPresets)
        ? savedSettings.eqPresets.filter(
            (preset) => Array.isArray(preset?.gains) && preset.gains.length === EQ_BANDS.length,
          )
        : [],
      // Older builds only had a close-to-tray switch; carry that choice over once.
      closeBehavior:
        savedSettings.closeBehavior ??
        (typeof savedSettings.closeToTray === 'boolean' ? (savedSettings.closeToTray ? 'tray' : 'quit') : 'ask'),
    }
    delete settings.closeToTray

    // Read the greeting flags before stamping this launch over the old one.
    const openedNow = Date.now()
    const firstLaunchSession = !settings.firstOpenedAt
    const returningSession =
      typeof settings.lastOpenedAt === 'number' && openedNow - settings.lastOpenedAt > 7 * 24 * 60 * 60 * 1000
    settings.firstOpenedAt = settings.firstOpenedAt ?? openedNow
    settings.lastOpenedAt = openedNow

    const tracks = Array.isArray(raw.tracks) ? (raw.tracks as Track[]) : []
    const session = (raw.session as SessionState | undefined) ?? null
    const liked = Array.isArray(raw.favorites) ? (raw.favorites as string[]) : []

    let restore: { track: Track; position: number } | null = null
    if (session?.trackId) {
      const found = tracks.find((track) => track.id === session.trackId)
      if (found) restore = { track: found, position: Math.max(0, session.position ?? 0) }
    }
    if (!restore && tracks.length) restore = { track: tracks[0], position: 0 }

    let queue = session?.queue?.length ? session.queue.filter((id) => tracks.some((t) => t.id === id)) : []
    let queueIndex = session?.queueIndex ?? 0
    if (!queue.length && restore) {
      queue = [restore.track.id]
      queueIndex = 0
    }

    set({
      tracks,
      playlists: Array.isArray(raw.playlists) ? (raw.playlists as Playlist[]) : [],
      favorites: liked,
      stats: (raw.stats as Record<string, StatsEntry>) ?? {},
      history: Array.isArray(raw.history) ? (raw.history as HistoryEntry[]) : [],
      settings,
      volume: settings.volume,
      muted: settings.muted,
      rate: settings.rate,
      queue,
      queueIndex: Math.max(0, queueIndex),
      currentId: restore?.track.id ?? null,
      playingTrack: restore?.track ?? null,
      time: restore?.position ?? 0,
      duration: restore?.track.duration ?? 0,
      view: { kind: 'home' },
      ready: true,
      firstLaunchSession,
      returningSession,
    })

    engine.setVolume(settings.volume, settings.muted)
    engine.setEqGains(settings.eqGains)
    engine.setRate(settings.rate)
    if (settings.sinkId) void engine.setSink(settings.sinkId)

    void get().refreshDevices()
    api.library.onProgress((progress) => set({ scanProgress: progress }))
    void api.ui.version().then((version) => set({ version })).catch(() => undefined)

    if (restore) {
      void engine.play(restore.track.url, { autoplay: false, startAt: restore.position })
      void get().fetchLyrics(restore.track)
    }
  },

  setView: (view) => set({ view, contextMenu: null }),
  setSearch: (search) => set({ search }),
  setDockTab: (tab) => set({ dockTab: tab, dockOpen: true }),
  toggleDock: (tab) => {
    const { dockOpen, dockTab } = get()
    if (tab && tab !== dockTab) set({ dockOpen: true, dockTab: tab })
    else if (tab) set({ dockOpen: !dockOpen, dockTab: tab })
    else set({ dockOpen: !dockOpen })
  },
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  showMiniPlayer: () => api.mini.show(),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  showToast: (message) => {
    set({ toast: message })
    window.setTimeout(() => {
      if (get().toast === message) set({ toast: null })
    }, 3200)
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    set({ settings })
    if (patch.volume !== undefined) set({ volume: patch.volume })
    if (patch.blur !== undefined) document.documentElement.style.setProperty('--blur', `${patch.blur}px`)
    if (patch.accent) document.documentElement.style.setProperty('--accent', patch.accent)
    if (patch.closeBehavior !== undefined) api.ui.trayPrefs({ closeBehavior: patch.closeBehavior })
    persist()
  },

  addFolders: async () => {
    const folders = await api.library.pickFolders()
    if (!folders.length) return
    const settings = { ...get().settings, folders: dedupe([...get().settings.folders, ...folders]) }
    set({ settings })
    persist()
    await get().rescan()
  },

  rescan: async () => {
    const folders = get().settings.folders
    if (!folders.length) {
      get().showToast('Add a music folder first')
      return
    }
    set({ scanning: true, scanProgress: { done: 0, total: 0 } })
    try {
      const result = (await api.library.scan(folders)) as Track[]
      const previous = new Map(get().tracks.map((track) => [track.path, track]))
      const tracks = result.map((track) => {
        const old = previous.get(track.path)
        return old ? { ...track, addedAt: old.addedAt } : track
      })
      set({ tracks, scanning: false })
      persist()
      get().showToast(`Library updated — ${tracks.length} tracks`)
    } catch (err) {
      set({ scanning: false })
      get().showToast(err instanceof Error ? err.message : 'Scan failed')
    }
  },

  removeFolder: async (folder) => {
    const folders = get().settings.folders.filter((item) => item !== folder)
    const settings = { ...get().settings, folders }
    set({ settings })
    persist()
    if (folders.length) await get().rescan()
    else get().clearLibrary()
  },

  clearLibrary: () => {
    set({ tracks: [], queue: [], queueIndex: -1, currentId: null, playingTrack: null, isPlaying: false })
    engine.stop()
    persist()
  },

  importPlaylistFile: async () => {
    const result = await api.library.importM3u()
    if (!result) return
    const byPath = new Map(get().tracks.map((track) => [track.path.toLowerCase(), track]))
    const ids: string[] = []
    for (const file of result.paths) {
      const track = byPath.get(file.toLowerCase())
      if (track) ids.push(track.id)
    }
    if (!ids.length) {
      get().showToast('No tracks from that playlist are in your library')
      return
    }
    const id = get().createPlaylist(result.name, ids)
    get().setView({ kind: 'playlist', id })
    get().showToast(`Imported ${ids.length} tracks`)
  },

  exportPlaylistFile: async (playlistId) => {
    const playlist = get().playlists.find((item) => item.id === playlistId)
    if (!playlist) return
    const entries = playlist.trackIds
      .map((id) => get().tracks.find((track) => track.id === id))
      .filter((track): track is Track => Boolean(track))
      .map((track) => ({ path: track.path, duration: track.duration, title: track.title, artist: track.artist }))
    const ok = await api.library.exportM3u(playlist.name, entries)
    if (ok) get().showToast('Playlist exported')
  },

  ingestPaths: async (paths) => {
    const clean = paths.filter(Boolean)
    if (!clean.length) return
    try {
      const found = (await api.library.ingest(clean)) as Track[]
      if (!found.length) {
        get().showToast('No playable audio in that drop')
        return
      }
      // Dropping files plays them, but does not add them to the library —
      // they only live in this session's track list and are not persisted.
      const known = new Map(get().tracks.map((track) => [track.path, track]))
      const additions = found.filter((track) => !known.has(track.path))
      if (additions.length) set({ tracks: [...get().tracks, ...additions] })
      get().playTracks(found.map((track) => track.id), 0)
      get().showToast(
        additions.length
          ? `Playing ${additions.length} dropped track${additions.length > 1 ? 's' : ''} (not added to your library)`
          : 'Playing dropped track',
      )
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : 'Could not read those files')
    }
  },

  openFiles: async (paths) => {
    const target = paths.find(Boolean)
    if (!target) return
    try {
      const probed = (await api.library.probe(target)) as Track | null
      if (!probed) {
        get().showToast('That file cannot be played')
        return
      }
      const inLibrary = get().tracks.find((track) => track.path === probed.path)
      set({
        external: inLibrary ? null : { track: probed },
        playingTrack: probed,
        currentId: inLibrary?.id ?? null,
        queue: inLibrary ? [inLibrary.id] : [],
        queueIndex: inLibrary ? 0 : -1,
        isPlaying: true,
        time: 0,
        duration: probed.duration,
      })
      void engine.play(probed.url, { autoplay: true })
      void get().fetchLyrics(probed)
      api.mini.show()
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : 'Could not open that file')
    }
  },

  addExternalToLibrary: () => {
    const external = get().external
    if (!external) return
    const exists = get().tracks.some((track) => track.path === external.track.path)
    if (!exists) set({ tracks: [...get().tracks, external.track] })
    set({
      external: null,
      currentId: external.track.id,
      queue: [external.track.id],
      queueIndex: 0,
    })
    persist()
    get().showToast('Added to library')
  },

  playTracks: (ids, index, opts) => {
    const list = ids.filter(Boolean)
    const targetId = list[index]
    if (!targetId) return
    const pool = [...get().tracks, get().playingTrack].filter((track): track is Track => Boolean(track))
    const track = pool.find((item) => item.id === targetId)
    if (!track) return

    const fade = opts?.fade ?? 0
    set({
      queue: list,
      queueIndex: index,
      currentId: get().tracks.some((item) => item.id === track.id) ? track.id : null,
      playingTrack: track,
      external: get().tracks.some((item) => item.id === track.id) ? null : get().external,
      isPlaying: true,
      time: 0,
      duration: track.duration || 0,
      contextMenu: null,
    })

    void engine.play(track.url, { autoplay: true, fade })
    engine.setRate(get().rate)
    void get().fetchLyrics(track)

    const stats = { ...get().stats }
    const entry = stats[track.id] ?? { plays: 0, lastPlayed: 0 }
    stats[track.id] = { plays: entry.plays + 1, lastPlayed: Date.now() }
    const history = [
      { id: track.id, at: Date.now() },
      ...get().history.filter((item) => item.id !== track.id),
    ].slice(0, 250)
    set({ stats, history })
    persist()
  },

  togglePlay: () => {
    const { isPlaying, playingTrack, queue, queueIndex, tracks } = get()
    if (!playingTrack) {
      if (queue.length) {
        get().playTracks(queue, Math.max(0, queueIndex))
        return
      }
      if (tracks.length) {
        get().playTracks(tracks.map((track) => track.id), 0)
        return
      }
      return
    }
    if (isPlaying) engine.pause()
    else void engine.resume()
  },

  next: (auto = false) => {
    const { queue, queueIndex, repeat, shuffle, playingTrack, sleepMode, settings } = get()
    if (!queue.length) return

    if (auto && sleepMode === 'track') {
      engine.pause()
      set({ sleepMode: 'off', sleepUntil: null })
      get().showToast('Sleep timer stopped playback')
      return
    }

    if (repeat === 'one' && auto) {
      engine.seek(0)
      void engine.resume()
      return
    }

    const fade = auto ? settings.crossfade : 0

    if (shuffle && queue.length > 1) {
      let index = queueIndex
      while (index === queueIndex) index = Math.floor(Math.random() * queue.length)
      get().playTracks(queue, index, { fade })
      return
    }

    let index = queueIndex + 1
    if (index >= queue.length) {
      if (repeat === 'all' || !auto) index = 0
      else {
        engine.pause()
        set({ isPlaying: false, time: 0 })
        return
      }
    }
    if (queue[index] === playingTrack?.id && queue.length === 1) {
      engine.seek(0)
      void engine.resume()
      return
    }
    get().playTracks(queue, index, { fade })
  },

  prev: () => {
    const { queue, queueIndex, time } = get()
    if (!queue.length) return
    if (time > 3) {
      engine.seek(0)
      set({ time: 0 })
      return
    }
    const index = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1
    get().playTracks(queue, index)
  },

  seek: (seconds) => {
    engine.seek(seconds)
    set({ time: seconds })
    get().saveSession()
  },

  setVolume: (volume) => {
    const max = get().settings.amplify ? 1.5 : 1
    const clamped = Math.min(max, Math.max(0, volume))
    engine.setVolume(clamped, get().muted)
    const settings = { ...get().settings, volume: clamped }
    set({ volume: clamped, settings })
    persist()
  },

  toggleMute: () => {
    const muted = !get().muted
    engine.setVolume(get().volume, muted)
    const settings = { ...get().settings, muted }
    set({ muted, settings })
    persist()
  },

  setRate: (rate) => {
    engine.setRate(rate)
    const settings = { ...get().settings, rate }
    set({ rate, settings })
    persist()
  },

  toggleShuffle: () => set({ shuffle: !get().shuffle }),

  cycleRepeat: () => {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const index = order.indexOf(get().repeat)
    set({ repeat: order[(index + 1) % order.length] })
  },

  saveSession: () => {
    const s = get()
    void api.store.save({
      session: {
        trackId: s.playingTrack?.id ?? s.currentId,
        queue: s.queue,
        queueIndex: s.queueIndex,
        position: s.time,
      } satisfies SessionState,
    })
  },

  playNext: (ids) => {
    const { queue, queueIndex } = get()
    const insertAt = Math.max(0, queueIndex + 1)
    const nextQueue = [...queue.slice(0, insertAt), ...dedupe(ids), ...queue.slice(insertAt)]
    set({ queue: nextQueue })
    get().showToast(ids.length > 1 ? `${ids.length} tracks play next` : 'Playing next')
  },

  addToQueue: (ids) => {
    const { queue, playingTrack } = get()
    const nextQueue = [...queue, ...dedupe(ids)]
    set({ queue: nextQueue })
    if (!playingTrack && nextQueue.length) {
      get().playTracks(nextQueue, 0)
      return
    }
    get().showToast(ids.length > 1 ? `${ids.length} tracks added to queue` : 'Added to queue')
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get()
    const nextQueue = queue.filter((_, i) => i !== index)
    let nextIndex = queueIndex
    if (index < queueIndex) nextIndex -= 1
    set({ queue: nextQueue, queueIndex: Math.max(-1, Math.min(nextIndex, nextQueue.length - 1)) })
  },

  reorderQueue: (from, to) => {
    const { queue, queueIndex, playingTrack } = get()
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return
    const nextQueue = [...queue]
    const [moved] = nextQueue.splice(from, 1)
    nextQueue.splice(to, 0, moved)
    set({ queue: nextQueue, queueIndex: playingTrack ? nextQueue.indexOf(playingTrack.id) : queueIndex })
  },

  clearQueue: () => {
    const { playingTrack, queue } = get()
    if (!playingTrack) {
      set({ queue: [], queueIndex: -1 })
      return
    }
    set({ queue: [playingTrack.id], queueIndex: 0, shuffle: false })
    get().showToast(`Cleared ${Math.max(0, queue.length - 1)} tracks from the queue`)
  },

  toggleLike: (id) => {
    const favorites = get().favorites.includes(id)
      ? get().favorites.filter((item) => item !== id)
      : [...get().favorites, id]
    set({ favorites })
    persist()
  },

  createPlaylist: (name, trackIds = []) => {
    const playlist: Playlist = {
      id: uid(),
      name: name.trim() || 'New playlist',
      cover: null,
      trackIds: dedupe(trackIds),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set({ playlists: [...get().playlists, playlist] })
    persist()
    return playlist.id
  },

  renamePlaylist: (id, name) => {
    set({
      playlists: get().playlists.map((playlist) =>
        playlist.id === id ? { ...playlist, name: name.trim() || playlist.name, updatedAt: Date.now() } : playlist,
      ),
    })
    persist()
  },

  setPlaylistCover: (id, cover) => {
    set({
      playlists: get().playlists.map((playlist) =>
        playlist.id === id ? { ...playlist, cover, updatedAt: Date.now() } : playlist,
      ),
    })
    persist()
  },

  renameFolder: (folderPath, name) => {
    const trimmed = name.trim()
    const aliases = { ...(get().settings.folderAliases ?? {}) }
    if (trimmed) aliases[folderPath] = trimmed
    else delete aliases[folderPath]
    get().updateSettings({ folderAliases: aliases })
  },

  deletePlaylist: (id) => {
    set({ playlists: get().playlists.filter((playlist) => playlist.id !== id) })
    const view = get().view
    if (view.kind === 'playlist' && view.id === id) set({ view: { kind: 'playlists' } })
    persist()
  },

  addToPlaylist: (playlistId, ids) => {
    set({
      playlists: get().playlists.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, trackIds: dedupe([...playlist.trackIds, ...ids]), updatedAt: Date.now() }
          : playlist,
      ),
    })
    persist()
    const playlist = get().playlists.find((item) => item.id === playlistId)
    get().showToast(`Added to ${playlist?.name ?? 'playlist'}`)
  },

  removeFromPlaylist: (playlistId, trackId) => {
    set({
      playlists: get().playlists.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId), updatedAt: Date.now() }
          : playlist,
      ),
    })
    persist()
  },

  reorderPlaylist: (playlistId, from, to) => {
    set({
      playlists: get().playlists.map((playlist) => {
        if (playlist.id !== playlistId) return playlist
        if (from === to || from < 0 || to < 0 || from >= playlist.trackIds.length || to >= playlist.trackIds.length) {
          return playlist
        }
        const ids = [...playlist.trackIds]
        const [moved] = ids.splice(from, 1)
        ids.splice(to, 0, moved)
        return { ...playlist, trackIds: ids, updatedAt: Date.now() }
      }),
    })
    persist()
  },

  setEqGain: (index, value) => {
    const gains = [...get().settings.eqGains]
    gains[index] = value
    engine.setEqGains(gains)
    const settings = { ...get().settings, eqGains: gains, eqPreset: 'Custom' }
    set({ settings })
    persist()
  },

  applyEqPreset: (name) => {
    const preset =
      get().settings.eqPresets.find((item) => item.name === name) ??
      EQ_PRESETS.find((item) => item.name === name)
    if (!preset) return
    const gains = [...preset.gains]
    engine.setEqGains(gains)
    const settings = { ...get().settings, eqGains: gains, eqPreset: preset.name }
    set({ settings })
    persist()
  },

  // Saves the current curve as a named preset so a hand-tuned EQ survives a restart.
  saveEqPreset: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const gains = [...get().settings.eqGains]
    const custom = get().settings.eqPresets.filter((preset) => preset.name !== trimmed)
    const settings = { ...get().settings, eqPresets: [...custom, { name: trimmed, gains }], eqPreset: trimmed }
    set({ settings })
    persist()
    get().showToast(`Saved preset "${trimmed}"`)
  },

  deleteEqPreset: (name) => {
    const settings = {
      ...get().settings,
      eqPresets: get().settings.eqPresets.filter((preset) => preset.name !== name),
    }
    set({ settings })
    persist()
  },

  setSleep: (mode, minutes) => {
    if (mode === 'off') {
      set({ sleepMode: 'off', sleepUntil: null })
      return
    }
    if (mode === 'track') {
      set({ sleepMode: 'track', sleepUntil: null })
      get().showToast('Playback will stop after this track')
      return
    }
    const until = Date.now() + (minutes ?? 30) * 60_000
    set({ sleepMode: 'time', sleepUntil: until })
    get().showToast(`Sleep timer set for ${minutes ?? 30} minutes`)
  },

  checkUpdates: async (force = true) => {
    set({ checkingUpdate: true })
    try {
      const info = (await api.updates.check(force)) as UpdateInfo | null
      set({ update: info })
      if (info?.available) get().showToast(`MeowPlayer ${info.version} is available`)
      else if (force) get().showToast('MeowPlayer is up to date')
    } catch (err) {
      if (force) get().showToast(err instanceof Error ? err.message : 'Could not check for updates')
    } finally {
      set({ checkingUpdate: false })
    }
  },

  installUpdate: async () => {
    const info = get().update
    if (!info) return
    const result = await api.updates.install(info)
    if (!result.ok) get().showToast(result.error ?? 'Could not start the update')
  },

  snoozeUpdate: async (days = 7) => {
    const until = await api.updates.snooze(days)
    get().updateSettings({ updateSnoozedUntil: until || null })
    set({ update: null })
    get().showToast(`Update hidden for ${days} days`)
  },

  setTagEdit: (id) => set({ tagEditId: id }),

  updateTrack: (id, patch) => {
    const allowed: Partial<Track> = {}
    for (const key of ['title', 'artist', 'album', 'albumArtist', 'genre', 'year'] as const) {
      if (patch[key] !== undefined) (allowed as Record<string, unknown>)[key] = patch[key]
    }
    const tracks = get().tracks.map((track) => (track.id === id ? { ...track, ...allowed } : track))
    const current = get().playingTrack
    set({
      tracks,
      playingTrack: current && current.id === id ? { ...current, ...allowed } : current,
    })
    persist()
    get().showToast('Track details saved')
  },

  smartQueue: () => {
    const { queue, queueIndex, playingTrack, tracks, history } = get()
    if (!playingTrack) {
      get().showToast('Play a track first')
      return
    }
    const recent = new Set(history.slice(0, 20).map((entry) => entry.id))
    const inQueue = new Set(queue)
    const sameGenre = tracks.filter(
      (track) =>
        track.id !== playingTrack.id &&
        !inQueue.has(track.id) &&
        playingTrack.genre &&
        track.genre.toLowerCase() === playingTrack.genre.toLowerCase(),
    )
    const sameArtist = tracks.filter(
      (track) =>
        track.id !== playingTrack.id &&
        !inQueue.has(track.id) &&
        !sameGenre.includes(track) &&
        track.artist &&
        track.artist.toLowerCase() === playingTrack.artist.toLowerCase(),
    )
    const albumMates = tracks.filter(
      (track) =>
        track.id !== playingTrack.id &&
        !inQueue.has(track.id) &&
        !sameGenre.includes(track) &&
        !sameArtist.includes(track) &&
        track.album &&
        track.album.toLowerCase() === playingTrack.album.toLowerCase(),
    )

    const pick = (pool: Track[], limit: number): Track[] =>
      shuffleArray(pool.filter((track) => !recent.has(track.id))).slice(0, limit)

    const additions = [
      ...pick(sameGenre, 8),
      ...pick(sameArtist, 4),
      ...pick(albumMates, 3),
    ]

    if (!additions.length) {
      get().showToast('No similar tracks found in the library')
      return
    }

    const rest = queue.slice(Math.max(0, queueIndex + 1))
    set({ queue: [queue[queueIndex] ?? playingTrack.id, ...additions.map((track) => track.id), ...rest] })
    persist()
    get().showToast(`Smart queue added ${additions.length} tracks`)
  },

  /**
   * Walks the whole library and fills the on-disk lyrics cache. The main process
   * caches each hit, so a second run only fetches what is still missing.
   */
  downloadAllLyrics: async () => {
    if (get().lyricsDownload.running) return
    if (!get().settings.lyrics) get().updateSettings({ lyrics: true })

    const seen = new Set<string>()
    const targets = get().tracks.filter((track) => {
      if (!track.title.trim()) return false
      const key = `${track.title}|${track.artist}|${track.album}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (!targets.length) {
      get().showToast('No tracks to download lyrics for')
      return
    }

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
      done >= total
        ? `Lyrics ready for ${total - failed} of ${total} tracks`
        : `Stopped after ${done} of ${total} tracks`,
    )
  },

  cancelLyricsDownload: () => {
    if (!get().lyricsDownload.running) return
    set((state) => ({ lyricsDownload: { ...state.lyricsDownload, running: false } }))
  },

  fetchLyrics: async (track, force = false) => {
    if (!track) {
      set({ lyrics: EMPTY_LYRICS })
      return
    }
    if (!get().settings.lyrics) {
      set({ lyrics: EMPTY_LYRICS })
      return
    }
    if (!force && !get().settings.autoLyrics) {
      set({ lyrics: EMPTY_LYRICS })
      return
    }
    if (get().lyrics.trackId === track.id) return
    set({ lyrics: { trackId: track.id, loading: true, synced: [], plain: null, error: null } })
    try {
      const raw = await api.lyrics.get({
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
      })
      if (get().lyrics.trackId !== track.id) return
      if (!raw) {
        set({ lyrics: { trackId: track.id, loading: false, synced: [], plain: null, error: 'No lyrics found' } })
        return
      }
      const synced = raw.synced ? parseLrc(raw.synced) : []
      set({
        lyrics: {
          trackId: track.id,
          loading: false,
          synced,
          plain: raw.plain,
          error: synced.length || raw.plain ? null : 'No lyrics found',
        },
      })
    } catch {
      if (get().lyrics.trackId !== track.id) return
      set({ lyrics: { trackId: track.id, loading: false, synced: [], plain: null, error: 'Lyrics unavailable' } })
    }
  },

  refreshDevices: async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const outputs = all
        .filter((device) => device.kind === 'audiooutput')
        .map((device) => ({ id: device.deviceId, label: device.label || 'Output device' }))
      set({ devices: outputs })
    } catch {
      set({ devices: [] })
    }
  },

  setSink: async (deviceId) => {
    const settings = { ...get().settings, sinkId: deviceId }
    set({ settings })
    persist()
    await engine.setSink(deviceId)
    get().showToast(deviceId ? 'Output device changed' : 'Using the default output')
  },

  activeLyric: () => activeLyricIndex(get().lyrics.synced, get().time),
}))

engine.callbacks = {
  time: (time, duration) => {
    useStore.setState((state) => (state.duration === duration ? { time } : { time, duration }))
  },
  duration: (duration) => useStore.setState({ duration }),
  ended: () => useStore.getState().next(true),
  play: () => useStore.setState({ isPlaying: true }),
  pause: () => {
    useStore.setState({ isPlaying: false })
    useStore.getState().saveSession()
  },
  error: (message) => {
    useStore.setState({ isPlaying: false })
    useStore.getState().showToast(message)
  },
}

/** Convenience selectors */
export const selectCurrentTrack = (state: AppState): Track | null => state.playingTrack

export const selectFavorites = (state: AppState): Track[] =>
  state.favorites
    .map((id) => state.tracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track))
