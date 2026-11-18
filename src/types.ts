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
  addedAt: number
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

export interface Settings {
  accent: string
  gradient: string
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
  /** Interface scale, 0.85–1.25. */
  uiScale: number
  /** Windows notification when the track changes. */
  notifications: boolean
  /** Tint the interface from the current cover artwork. */
  albumTheming: boolean
  /** Check GitHub for a newer release on launch. */
  updateCheck: boolean
  updateSnoozedUntil: number | null
  crossfade: number
  amplify: boolean
  lyrics: boolean
  /** Fetch and cache lyrics in the background when a track starts. */
  autoLyrics: boolean
  miniLyrics: boolean
  collapsedSidebar: boolean
  closeBehavior: CloseBehavior
  /** First launch and previous launch, used by the Home greeting. */
  firstOpenedAt: number | null
  lastOpenedAt: number | null
  lastGreetingId: number | null
  /** legacy field kept only so older saved settings can be migrated */
  closeToTray?: boolean
  sinkId: string
}

export type CloseBehavior = 'ask' | 'tray' | 'quit'

export type VisualizerStyle = 'bars' | 'ribbon' | 'aurora' | 'filament'

export type RepeatMode = 'off' | 'all' | 'one'
export type DockTab = 'queue' | 'lyrics' | 'eq'
export type SleepMode = 'off' | 'time' | 'track'

export type View =
  | { kind: 'home' }
  | { kind: 'songs' }
  | { kind: 'albums' }
  | { kind: 'album'; id: string }
  | { kind: 'artists' }
  | { kind: 'artist'; id: string }
  | { kind: 'playlists' }
  | { kind: 'playlist'; id: string }
  | { kind: 'favorites' }
  | { kind: 'folders' }
  | { kind: 'folder'; id: string }
  | { kind: 'genres' }
  | { kind: 'genre'; id: string }
  | { kind: 'nowplaying' }
  | { kind: 'search' }

export interface LyricsLine {
  time: number
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
}

export interface UpdateInfo {
  current: string
  version: string
  available: boolean
  notes: string
  pageUrl: string
  assetUrl: string | null
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
