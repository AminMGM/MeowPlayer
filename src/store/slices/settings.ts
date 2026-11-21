import { api } from '../../api'
import { EQ_PRESETS, engine } from '../../audio/engine'
import type { HistoryEntry, Playlist, SessionState, Settings, StatsEntry, TagEdit, Track } from '../../types'
import { DEFAULT_SETTINGS, MACHINE_SPECIFIC, sanitizeSettings } from '../defaults'
import { persist } from '../persist'
import type { SettingsSlice, Slice } from '../state'
import { gainFor } from './playback'

const WEEK = 7 * 24 * 60 * 60 * 1000

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Drops anything in a saved track list that is not a usable track. */
function readTracks(raw: unknown): Track[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (track): track is Track =>
      isObject(track) && typeof track.id === 'string' && typeof track.path === 'string' && typeof track.url === 'string',
  )
}

export const createSettingsSlice: Slice<SettingsSlice> = (set, get) => ({
  settings: DEFAULT_SETTINGS,
  version: '',
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

    const saved = isObject(raw.settings) ? raw.settings : {}
    const settings = sanitizeSettings(saved)

    // Read the greeting flags before stamping this launch over the old one.
    const now = Date.now()
    const firstLaunchSession = !settings.firstOpenedAt
    const returningSession = typeof settings.lastOpenedAt === 'number' && now - settings.lastOpenedAt > WEEK
    settings.firstOpenedAt = settings.firstOpenedAt ?? now
    settings.lastOpenedAt = now

    const tracks = readTracks(raw.tracks)
    const byId = new Map(tracks.map((track) => [track.id, track]))
    const session = isObject(raw.session) ? (raw.session as Partial<SessionState>) : null

    // Restore the queue, then find the saved track inside it so the index is right.
    let queue = Array.isArray(session?.queue) ? session.queue.filter((id) => byId.has(id)) : []
    const restoreTrack = (session?.trackId && byId.get(session.trackId)) || null
    let queueIndex = restoreTrack ? queue.indexOf(restoreTrack.id) : -1
    if (restoreTrack && queueIndex < 0) {
      queue = [restoreTrack.id, ...queue]
      queueIndex = 0
    }
    if (!restoreTrack && queue.length) queueIndex = Math.min(Math.max(0, session?.queueIndex ?? 0), queue.length - 1)
    const position = restoreTrack ? Math.max(0, Number(session?.position) || 0) : 0

    set({
      tracks,
      tagOverrides: isObject(raw.tagOverrides) ? (raw.tagOverrides as Record<string, TagEdit>) : {},
      playlists: Array.isArray(raw.playlists) ? (raw.playlists as Playlist[]) : [],
      favorites: Array.isArray(raw.favorites) ? (raw.favorites as string[]).filter((id) => typeof id === 'string') : [],
      stats: isObject(raw.stats) ? (raw.stats as Record<string, StatsEntry>) : {},
      history: Array.isArray(raw.history) ? (raw.history as HistoryEntry[]) : [],
      listenLog: isObject(raw.listenLog) ? (raw.listenLog as Record<string, number>) : {},
      settings,
      volume: settings.volume,
      muted: settings.muted,
      rate: settings.rate,
      queue,
      originalQueue: queue,
      queueIndex,
      playingTrack: restoreTrack,
      time: position,
      duration: restoreTrack?.duration ?? 0,
      ready: true,
      firstLaunchSession,
      returningSession,
    })
    persist('settings')

    engine.setVolume(settings.volume, settings.muted)
    engine.setEqGains(settings.eqGains)
    engine.setRate(settings.rate)
    engine.transitionLead = settings.crossfade
    if (settings.sinkId) void engine.setSink(settings.sinkId)

    void get().refreshDevices()
    api.library.onProgress((progress) => set({ scanProgress: progress }))
    api.library.onChanged(() => void get().rescan({ quiet: true }))
    void api.ui.version().then((version) => set({ version })).catch(() => undefined)

    if (restoreTrack) {
      void engine.play(restoreTrack.url, {
        autoplay: false,
        startAt: position,
        gainDb: gainFor(restoreTrack, settings.normalize),
      })
      void get().fetchLyrics(restoreTrack)
    }

    // Pick up files that changed while the app was closed, then keep watching.
    if (settings.folders.length) window.setTimeout(() => void get().rescan({ quiet: true }), 1500)
    get().watchLibrary()
  },

  updateSettings: (patch) => {
    const previous = get().settings
    const settings: Settings = { ...previous, ...patch }

    if (patch.amplify === false && get().volume > 1) {
      settings.volume = 1
      set({ volume: 1 })
      engine.setVolume(1, get().muted)
    }
    if (patch.volume !== undefined) set({ volume: patch.volume })
    if (patch.crossfade !== undefined) engine.transitionLead = patch.crossfade
    if (patch.closeBehavior !== undefined) api.ui.trayPrefs({ closeBehavior: patch.closeBehavior })

    set({ settings })
    persist('settings')

    if (patch.normalize !== undefined) {
      const playing = get().playingTrack
      if (playing) engine.setTrackGain(gainFor(playing, settings.normalize))
    }
    if (patch.folders !== undefined || patch.watchFolders !== undefined) get().watchLibrary()
    if (patch.lyrics === false) void get().fetchLyrics(null)
  },

  importSettings: (data) => {
    const current = get().settings
    const incoming = { ...data }
    for (const key of MACHINE_SPECIFIC) delete incoming[key]
    const settings = sanitizeSettings({ ...current, ...incoming }, current)
    set({ settings, volume: settings.volume, muted: settings.muted, rate: settings.rate })
    engine.setVolume(settings.volume, settings.muted)
    engine.setEqGains(settings.eqGains)
    engine.setRate(settings.rate)
    engine.transitionLead = settings.crossfade
    api.ui.trayPrefs({ closeBehavior: settings.closeBehavior })
    persist('settings')
    get().showToast('Settings imported')
  },

  renameFolder: (folderPath, name) => {
    const trimmed = name.trim()
    const aliases = { ...get().settings.folderAliases }
    if (trimmed) aliases[folderPath] = trimmed
    else delete aliases[folderPath]
    get().updateSettings({ folderAliases: aliases })
  },

  setEqGain: (index, value) => {
    const gains = [...get().settings.eqGains]
    gains[index] = value
    engine.setEqGains(gains)
    set({ settings: { ...get().settings, eqGains: gains, eqPreset: 'Custom' } })
    persist('settings')
  },

  applyEqPreset: (name) => {
    const preset =
      get().settings.eqPresets.find((item) => item.name === name) ?? EQ_PRESETS.find((item) => item.name === name)
    if (!preset) return
    const gains = [...preset.gains]
    engine.setEqGains(gains)
    set({ settings: { ...get().settings, eqGains: gains, eqPreset: preset.name } })
    persist('settings')
  },

  saveEqPreset: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (EQ_PRESETS.some((preset) => preset.name.toLowerCase() === trimmed.toLowerCase())) {
      get().showToast(`"${trimmed}" is a built-in preset, pick another name`, { kind: 'error' })
      return
    }
    const gains = [...get().settings.eqGains]
    const custom = get().settings.eqPresets.filter((preset) => preset.name !== trimmed)
    set({ settings: { ...get().settings, eqPresets: [...custom, { name: trimmed, gains }], eqPreset: trimmed } })
    persist('settings')
    get().showToast(`Saved preset "${trimmed}"`)
  },

  deleteEqPreset: (name) => {
    const settings = get().settings
    set({
      settings: {
        ...settings,
        eqPresets: settings.eqPresets.filter((preset) => preset.name !== name),
        eqPreset: settings.eqPreset === name ? 'Custom' : settings.eqPreset,
      },
    })
    persist('settings')
  },

  checkUpdates: async (force = true) => {
    set({ checkingUpdate: true })
    try {
      const info = await api.updates.check(force)
      set({ update: info })
      if (info?.available) get().showToast(`MeowPlayer ${info.version} is available`, { kind: 'info' })
      else if (force) get().showToast('MeowPlayer is up to date')
    } catch (err) {
      if (force) get().showToast(err instanceof Error ? err.message : 'Could not check for updates', { kind: 'error' })
    } finally {
      set({ checkingUpdate: false })
    }
  },

  installUpdate: async () => {
    const result = await api.updates.install()
    if (!result.ok) get().showToast(result.error ?? 'Could not start the update', { kind: 'error' })
  },

  snoozeUpdate: async (days = 7) => {
    const until = await api.updates.snooze(days)
    get().updateSettings({ updateSnoozedUntil: until || null })
    set({ update: null })
    get().showToast(`Update hidden for ${days} days`, { kind: 'info' })
  },
})
