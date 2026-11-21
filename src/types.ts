export interface Track {
  id: string
  path: string
  url: string
  title: string
  artist: string
  albumArtist: string
  album: string
  genre: string
  year: number | null
  duration: number
  bitrate: number
  sampleRate: number
  trackNo: number | null
  discNo: number | null
  cover: string | null
  size: number
  /** File modification time in ms, used to skip unchanged files on a rescan. */
  mtime?: number
  /** ReplayGain values in dB, when the file carries them. */
  trackGain?: number | null
  albumGain?: number | null
  addedAt: number
}

/** Fields the tag editor can change. */
export interface TagEdit {
  title?: string
  artist?: string
  albumArtist?: string
  album?: string
  genre?: string
  year?: number | null
}

export interface ScanResult {
  tracks: Track[]
  kept: string[]
}

export interface Playlist {
  id: string
  name: string
  cover: string | null
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

export interface StatsEntry {
  plays: number
  lastPlayed: number
}

export interface HistoryEntry {
  id: string
  at: number
}

export type CloseBehavior = 'ask' | 'tray' | 'quit'
export type VisualizerStyle = 'bars' | 'ribbon' | 'aurora' | 'filament'
export type ThemeName = 'system' | 'graphite' | 'light' | 'cherry' | 'navy'
export type NormalizeMode = 'off' | 'track' | 'album'

export interface Settings {
  accent: string
  gradient: ThemeName
  blur: number
  animations: boolean
  volume: number
  muted: boolean
  rate: number
  folders: string[]
  /** Display names for scan folders, keyed by absolute path. */
  folderAliases: Record<string, string>
  eqGains: number[]
  eqPreset: string
  eqPresets: { name: string; gains: number[] }[]
  visualizer: boolean
  visualizerStyle: VisualizerStyle
  /** Collapse tracks that share a title and artist in the Songs view. */
  hideDuplicates: boolean
  /** Interface zoom from 0.8 to 1.4, or 0 to size the interface to the window. */
  uiScale: number
  /** Windows notification when the track changes. */
  notifications: boolean
  /** Tint the accent from the current cover artwork. */
  albumTheming: boolean
  /** Blurred cover artwork behind the whole interface. */
  ambientArt: boolean
  /** Check GitHub for a newer release on launch. */
  updateCheck: boolean
  updateSnoozedUntil: number | null
  crossfade: number
  /** Loudness normalisation from ReplayGain tags. */
  normalize: NormalizeMode
  /** Start the next track the moment the current one ends. */
  gapless: boolean
  amplify: boolean
  /** Show lyrics at all. */
  lyrics: boolean
  /** Look lyrics up as each track starts (otherwise only on request). */
  autoLyrics: boolean
  miniLyrics: boolean
  collapsedSidebar: boolean
  /** Rescan automatically when files change in a library folder. */
  watchFolders: boolean
  closeBehavior: CloseBehavior
  /** First launch and previous launch, used by the Home greeting. */
  firstOpenedAt: number | null
  lastOpenedAt: number | null
  lastGreetingId: number | null
  /** Legacy field, only read to migrate settings from 1.x. */
  closeToTray?: boolean
  sinkId: string
}

export type RepeatMode = 'off' | 'all' | 'one'
export type DockTab = 'queue' | 'lyrics' | 'eq'
export type SleepMode = 'off' | 'time' | 'track'
export type SmartList = 'recent-added' | 'most-played' | 'recent-played'

export type View =
  | { kind: 'home' }
  | { kind: 'songs' }
  | { kind: 'albums' }
  | { kind: 'album'; id: string }
  | { kind: 'artists' }
  | { kind: 'artist'; id: string }
  | { kind: 'playlists' }
  | { kind: 'playlist'; id: string }
  | { kind: 'smart'; id: SmartList }
  | { kind: 'favorites' }
  | { kind: 'folders' }
  | { kind: 'folder'; id: string }
  | { kind: 'genres' }
  | { kind: 'genre'; id: string }
  | { kind: 'nowplaying' }
  | { kind: 'stats' }
  | { kind: 'search' }

export interface LyricsLine {
  time: number
  /** Empty for an instrumental gap. */
  text: string
}

export interface LyricsState {
  trackId: string | null
  loading: boolean
  synced: LyricsLine[]
  plain: string | null
  error: string | null
}

export interface AudioDevice {
  id: string
  label: string
}

export interface SessionState {
  trackId: string | null
  queue: string[]
  queueIndex: number
  position: number
}

export interface ExternalTrack {
  track: Track
}

/** A track list the context menu was opened from, so "Play" keeps the context. */
export interface TrackContext {
  ids: string[]
  index: number
}

export interface ContextMenuState {
  x: number
  y: number
  trackIds: string[]
  context?: TrackContext
}

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  kind: ToastKind
  action?: { label: string; run: () => void }
}

export interface MiniState {
  trackId: string | null
  title: string
  artist: string
  album: string
  cover: string | null
  playing: boolean
  time: number
  duration: number
  liked: boolean
  external: boolean
  lyric: string | null
  lyricsOn: boolean
}

export type UpdateStatus = 'available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateInfo {
  current: string
  version: string
  available: boolean
  notes: string
  pageUrl: string
  assetUrl: string | null
  status: UpdateStatus
  progress: { percent: number; transferred: number; total: number; bytesPerSecond: number } | null
  error: string | null
  /** False in development builds, which only link to the release page. */
  canSelfUpdate: boolean
}

export interface AlbumGroup {
  key: string
  album: string
  albumArtist: string
  year: number | null
  cover: string | null
  tracks: Track[]
  duration: number
}
