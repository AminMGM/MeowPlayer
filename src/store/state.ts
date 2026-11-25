import type { StateCreator } from 'zustand'
import type {
  AudioDevice,
  ContextMenuState,
  DockTab,
  HistoryEntry,
  LyricsState,
  MetaProposal,
  PlayEvent,
  Playlist,
  RepeatMode,
  Settings,
  SleepMode,
  StatsEntry,
  TagEdit,
  Toast,
  ToastKind,
  Track,
  UpdateInfo,
  View,
} from '../types'

export type SettingsTab = 'appearance' | 'playback' | 'lyrics' | 'library' | 'system' | 'about'

export interface UiSlice {
  view: View
  backStack: View[]
  forwardStack: View[]
  search: string
  dockTab: DockTab
  dockOpen: boolean
  settingsOpen: boolean
  settingsTab: SettingsTab
  contextMenu: ContextMenuState | null
  toasts: Toast[]
  tagEditId: string | null
  /** "Fix song info" dialog: the songs to check, 'all' for the library, or null when closed. */
  metaFix: string[] | 'all' | null
  spotifyImportOpen: boolean
  miniVisible: boolean

  setView: (view: View, source?: HTMLElement | null) => void
  goBack: () => void
  goForward: () => void
  setSearch: (value: string) => void
  setDockTab: (tab: DockTab) => void
  toggleDock: (tab?: DockTab) => void
  setSettingsOpen: (open: boolean, tab?: SettingsTab) => void
  showMiniPlayer: () => void
  setContextMenu: (menu: ContextMenuState | null) => void
  showToast: (message: string, opts?: { kind?: ToastKind; action?: Toast['action']; duration?: number }) => void
  dismissToast: (id: number) => void
  setTagEdit: (id: string | null) => void
  setMetaFix: (scope: string[] | 'all' | null) => void
  setSpotifyImportOpen: (open: boolean) => void
}

export interface LibrarySlice {
  ready: boolean
  tracks: Track[]
  /** Tracks played from outside the library (opened or dropped), not saved. */
  transientIds: string[]
  /** Tag edits that could not be written into the file itself, keyed by path. */
  tagOverrides: Record<string, TagEdit>
  scanning: boolean
  scanProgress: { done: number; total: number }

  addFolders: () => Promise<void>
  rescan: (opts?: { quiet?: boolean }) => Promise<void>
  removeFolder: (folder: string) => Promise<void>
  clearLibrary: () => void
  importPlaylistFile: () => Promise<void>
  exportPlaylistFile: (playlistId: string) => Promise<void>
  ingestPaths: (paths: string[]) => Promise<void>
  openFiles: (paths: string[]) => Promise<void>
  addToLibrary: (ids: string[]) => void
  /** Writes accepted "Fix song info" proposals into the files. */
  applyMetaFixes: (proposals: MetaProposal[], onProgress?: (done: number) => void) => Promise<{ fixed: number; failed: number }>
  updateTrack: (id: string, edit: TagEdit) => Promise<void>
  watchLibrary: () => void
}

export interface PlaybackSlice {
  queue: string[]
  queueIndex: number
  /** Queue order before shuffle was turned on, restored when it is turned off. */
  originalQueue: string[]
  playingTrack: Track | null
  isPlaying: boolean
  time: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  rate: number
  sleepMode: SleepMode
  sleepUntil: number | null
  devices: AudioDevice[]

  playTracks: (ids: string[], index: number) => void
  jump: (index: number, opts?: { fade?: number }) => void
  togglePlay: () => void
  pause: () => void
  resume: () => void
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
  smartQueue: () => void
  setSleep: (mode: SleepMode, minutes?: number) => void
  refreshDevices: () => Promise<void>
  setSink: (deviceId: string) => Promise<void>
  preloadNext: () => void
}

export interface CollectionSlice {
  playlists: Playlist[]
  favorites: string[]
  stats: Record<string, StatsEntry>
  history: HistoryEntry[]
  /** Seconds listened per day, keyed "YYYY-MM-DD". */
  listenLog: Record<string, number>
  /** Every counted play with its time, newest last (capped). */
  playLog: PlayEvent[]

  toggleLike: (id: string) => void
  setLiked: (ids: string[], liked: boolean) => void
  createPlaylist: (name: string, trackIds?: string[]) => string
  renamePlaylist: (id: string, name: string) => void
  setPlaylistCover: (id: string, cover: string | null) => void
  deletePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, ids: string[]) => void
  removeFromPlaylist: (playlistId: string, index: number) => void
  reorderPlaylist: (playlistId: string, from: number, to: number) => void
  recordPlay: (track: Track) => void
  recordSkip: (trackId: string) => void
  addListenTime: (seconds: number) => void
}

export interface LyricsSlice {
  lyrics: LyricsState
  lyricsDownload: { running: boolean; done: number; total: number; failed: number }
  fetchLyrics: (track: Track | null, force?: boolean) => Promise<void>
  downloadAllLyrics: () => Promise<void>
  cancelLyricsDownload: () => void
}

export interface SettingsSlice {
  settings: Settings
  version: string
  update: UpdateInfo | null
  checkingUpdate: boolean
  firstLaunchSession: boolean
  returningSession: boolean

  init: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => void
  importSettings: (data: Record<string, unknown>) => void
  renameFolder: (path: string, name: string) => void
  setEqGain: (index: number, value: number) => void
  applyEqPreset: (name: string) => void
  saveEqPreset: (name: string) => void
  deleteEqPreset: (name: string) => void
  checkUpdates: (force?: boolean) => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  snoozeUpdate: (days?: number) => Promise<void>
}

export type AppState = UiSlice & LibrarySlice & PlaybackSlice & CollectionSlice & LyricsSlice & SettingsSlice

export type Slice<T> = StateCreator<AppState, [], [], T>
