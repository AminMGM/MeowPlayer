import type { MetaChanges, MetaProposal, ScanResult, TagEdit, Track, UpdateInfo } from './types'

export interface ScanProgress {
  done: number
  total: number
}

export interface RawLyrics {
  synced: string | null
  plain: string | null
  instrumental?: boolean
  source: string
}

type Unsubscribe = () => void

/** The bridge the preload script exposes on `window.api`. */
export interface AppApi {
  platform: string
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (cb: (value: boolean) => void) => Unsubscribe
  }
  mini: {
    show: () => void
    hide: () => void
    command: (command: string) => void
    broadcast: (state: unknown) => void
    requestState: () => Promise<unknown>
    isVisible: () => Promise<boolean>
    onState: (cb: (state: unknown) => void) => Unsubscribe
    onVisibility: (cb: (visible: boolean) => void) => Unsubscribe
  }
  library: {
    pickFolders: () => Promise<string[]>
    scan: (folders: string[], known: Record<string, number>) => Promise<ScanResult>
    ingest: (paths: string[]) => Promise<Track[]>
    probe: (file: string) => Promise<Track | null>
    writeTags: (file: string, edit: TagEdit) => Promise<{ track?: Track; error?: string }>
    pruneCovers: (used: string[]) => Promise<number>
    watch: (folders: string[]) => void
    onChanged: (cb: () => void) => Unsubscribe
    pickImage: () => Promise<string | null>
    onProgress: (cb: (value: ScanProgress) => void) => Unsubscribe
    importM3u: () => Promise<{ name: string; paths: string[] } | null>
    /** CSV or text playlist exports the user picks, read as text. */
    pickPlaylistExports: () => Promise<{ name: string; text: string }[]>
    exportM3u: (
      name: string,
      entries: { path: string; duration: number; title: string; artist: string }[],
    ) => Promise<boolean>
  }
  store: {
    load: () => Promise<Record<string, unknown>>
    save: (patch: Record<string, unknown>) => Promise<boolean>
  }
  meta: {
    /** Proposed fixes for one song; `online` also asks MusicBrainz. */
    lookup: (
      item: {
        id: string
        path: string
        title: string
        artist: string
        album: string
        albumArtist: string
        year: number | null
        trackNo: number | null
        duration: number
        hasCover: boolean
      },
      online: boolean,
      /** Offer album artwork even for songs that already have some. */
      replaceArt?: boolean,
    ) => Promise<MetaProposal | null>
    apply: (file: string, changes: MetaChanges, coverUrl?: string) => Promise<{ track?: Track; error?: string }>
  }
  lyrics: {
    get: (query: { title: string; artist: string; album?: string; duration?: number; force?: boolean }) => Promise<RawLyrics | null>
    /** Which songs already have lyrics (or a recent "not found") saved. */
    cached: (queries: { title: string; artist: string; album?: string }[]) => Promise<boolean[]>
    stats: () => Promise<{ songs: number; bytes: number }>
    clear: () => Promise<void>
  }
  files: {
    paths: (files: File[]) => string[]
  }
  ui: {
    setZoom: (factor: number) => void
    /** Zoom is shared by every window of the app, so the mini window reads it to undo it. */
    getZoom: () => number
    thumbar: (icons: Record<string, string>) => void
    thumbarState: (playing: boolean) => void
    trayPrefs: (prefs: { closeBehavior: string }) => void
    onCloseBehavior: (cb: (value: string) => void) => Unsubscribe
    /** The main process asks the renderer to show the close dialog. */
    onCloseRequest: (cb: () => void) => Unsubscribe
    answerClose: (choice: 'tray' | 'quit', remember: boolean) => void
    openDefaultApps: () => Promise<boolean>
    version: () => Promise<string>
    exportSettings: (json: string) => Promise<boolean>
    importSettings: () => Promise<Record<string, unknown> | null>
    notify: (payload: { title: string; body: string }) => Promise<boolean>
    reportError: (message: string) => void
    logPath: () => Promise<string>
  }
  onSystemPause: (cb: () => void) => Unsubscribe
  updates: {
    check: (force: boolean) => Promise<UpdateInfo | null>
    snooze: (days: number) => Promise<number>
    /** Downloads the update found by the last check (only the changed parts). */
    download: () => Promise<{ ok: boolean; error?: string }>
    /** Restarts into the downloaded update. */
    install: () => Promise<{ ok: boolean; error?: string }>
    openRelease: (url: string) => Promise<void>
    onAvailable: (cb: (info: UpdateInfo) => void) => Unsubscribe
    /** Download progress and state changes. */
    onStatus: (cb: (info: UpdateInfo) => void) => Unsubscribe
  }
  onPlayerCommand: (cb: (command: string) => void) => Unsubscribe
  onOpenFiles: (cb: (paths: string[]) => void) => Unsubscribe
  openExternal: (url: string) => Promise<void>
  revealFile: (file: string) => Promise<boolean>
}

const noop = (): void => undefined
const off = (): Unsubscribe => noop
const resolved =
  <T>(value: T) =>
  async (): Promise<T> =>
    value

/** Used when the renderer runs in a plain browser (for example `vite` alone or tests). */
const browserStub: AppApi = {
  platform: 'browser',
  window: { minimize: noop, toggleMaximize: noop, close: noop, isMaximized: resolved(false), onMaximizeChange: off },
  mini: {
    show: noop,
    hide: noop,
    command: noop,
    broadcast: noop,
    requestState: resolved(null),
    isVisible: resolved(false),
    onState: off,
    onVisibility: off,
  },
  library: {
    pickFolders: resolved<string[]>([]),
    scan: resolved<ScanResult>({ tracks: [], kept: [] }),
    ingest: resolved<Track[]>([]),
    probe: resolved(null),
    writeTags: resolved({ error: 'Tag editing needs the desktop app' }),
    pruneCovers: resolved(0),
    watch: noop,
    onChanged: off,
    pickImage: resolved<string | null>(null),
    onProgress: off,
    importM3u: resolved(null),
    pickPlaylistExports: resolved<{ name: string; text: string }[]>([]),
    exportM3u: resolved(false),
  },
  store: { load: resolved<Record<string, unknown>>({}), save: resolved(true) },
  meta: {
    lookup: resolved<MetaProposal | null>(null),
    apply: resolved({ error: 'Fixing song info needs the desktop app' }),
  },
  lyrics: {
    get: resolved<RawLyrics | null>(null),
    cached: async (queries) => queries.map(() => false),
    stats: resolved({ songs: 0, bytes: 0 }),
    clear: resolved(undefined),
  },
  files: { paths: () => [] },
  ui: {
    setZoom: (factor) => {
      document.body.style.zoom = String(factor)
    },
    getZoom: () => 1,
    thumbar: noop,
    thumbarState: noop,
    trayPrefs: noop,
    onCloseBehavior: off,
    onCloseRequest: off,
    answerClose: noop,
    openDefaultApps: resolved(true),
    version: resolved('dev'),
    exportSettings: resolved(false),
    importSettings: resolved<Record<string, unknown> | null>(null),
    notify: resolved(false),
    reportError: noop,
    logPath: resolved(''),
  },
  onSystemPause: off,
  updates: {
    check: resolved<UpdateInfo | null>(null),
    snooze: resolved(0),
    download: async () => ({ ok: false, error: 'Updates are only available in the desktop app' }),
    install: async () => ({ ok: false, error: 'Updates are only available in the desktop app' }),
    openRelease: resolved(undefined),
    onAvailable: off,
    onStatus: off,
  },
  onPlayerCommand: off,
  onOpenFiles: off,
  openExternal: async (url) => {
    window.open(url, '_blank', 'noopener')
  },
  revealFile: resolved(true),
}

export const api: AppApi = (window as unknown as { api?: AppApi }).api ?? browserStub
