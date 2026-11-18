import type { AudioDevice, LyricsLine, UpdateInfo } from './types'

export interface ScanProgress {
  done: number
  total: number
}

export interface RawLyrics {
  synced: string | null
  plain: string | null
  source: string
}

export interface AppApi {
  platform: string
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizeChange: (cb: (value: boolean) => void) => () => void
  }
  mini: {
    show: () => void
    hide: () => void
    command: (command: string) => void
    broadcast: (state: unknown) => void
    requestState: () => Promise<unknown>
    onState: (cb: (state: unknown) => void) => () => void
  }
  library: {
    pickFolders: () => Promise<string[]>
    scan: (folders: string[]) => Promise<unknown[]>
    ingest: (paths: string[]) => Promise<unknown[]>
    probe: (file: string) => Promise<unknown>
    pickImage: () => Promise<string | null>
    onProgress: (cb: (value: ScanProgress) => void) => () => void
    importM3u: () => Promise<{ name: string; paths: string[] } | null>
    exportM3u: (
      name: string,
      entries: { path: string; duration: number; title: string; artist: string }[],
    ) => Promise<boolean>
  }
  store: {
    load: () => Promise<Record<string, unknown>>
    save: (patch: Record<string, unknown>) => Promise<boolean>
  }
  lyrics: {
    get: (query: { title: string; artist: string; album?: string; duration?: number }) => Promise<RawLyrics | null>
  }
  files: {
    paths: (files: File[]) => string[]
  }
  ui: {
    thumbar: (icons: Record<string, string>) => void
    thumbarState: (playing: boolean) => void
    trayPrefs: (prefs: { closeBehavior: string }) => void
    openDefaultApps: () => Promise<boolean>
    version: () => Promise<string>
    exportSettings: (json: string) => Promise<boolean>
    importSettings: () => Promise<Record<string, unknown> | null>
    notify: (payload: { title: string; body: string }) => Promise<boolean>
    reportError: (message: string) => void
    logPath: () => Promise<string>
  }
  onSystemPause: (cb: () => void) => () => void
  updates: {
    check: (force: boolean) => Promise<UpdateInfo | null>
    snooze: (days: number) => Promise<number>
    install: (info: UpdateInfo) => Promise<{ ok: boolean; file?: string; error?: string }>
    openRelease: (url: string) => Promise<void>
    onAvailable: (cb: (info: UpdateInfo) => void) => () => void
  }
  onMediaKey: (cb: (action: string) => void) => () => void
  onPlayerCommand: (cb: (command: string) => void) => () => void
  onOpenFiles: (cb: (paths: string[]) => void) => () => void
  openExternal: (url: string) => Promise<void>
  revealFile: (file: string) => Promise<boolean>
}

const noop = (): void => undefined
const resolved = <T>(value: T) => async (): Promise<T> => value

const stub: AppApi = {
  platform: 'browser',
  window: {
    minimize: noop,
    toggleMaximize: noop,
    close: noop,
    isMaximized: resolved(false),
    onMaximizeChange: () => noop,
  },
  mini: {
    show: noop,
    hide: noop,
    command: noop,
    broadcast: noop,
    requestState: resolved(null),
    onState: () => noop,
  },
  library: {
    pickFolders: resolved<string[]>([]),
    scan: resolved<unknown[]>([]),
    ingest: resolved<unknown[]>([]),
    probe: resolved(null),
    pickImage: resolved<string | null>(null),
    onProgress: () => noop,
    importM3u: resolved(null),
    exportM3u: resolved(false),
  },
  store: {
    load: resolved<Record<string, unknown>>({}),
    save: resolved(true),
  },
  lyrics: {
    get: resolved<RawLyrics | null>(null),
  },
  files: { paths: () => [] },
  ui: {
    thumbar: noop,
    thumbarState: noop,
    trayPrefs: noop,
    openDefaultApps: resolved(true),
    version: resolved('1.0.0'),
    exportSettings: resolved(false),
    importSettings: resolved<Record<string, unknown> | null>(null),
    notify: resolved(false),
    reportError: noop,
    logPath: resolved(''),
  },
  onSystemPause: () => noop,
  updates: {
    check: resolved<UpdateInfo | null>(null),
    snooze: resolved(0),
    install: async () => ({ ok: false, error: 'Updates are only available in the desktop app' }),
    openRelease: resolved(undefined),
    onAvailable: () => noop,
  },
  onMediaKey: () => noop,
  onPlayerCommand: () => noop,
  onOpenFiles: () => noop,
  openExternal: resolved(undefined),
  revealFile: resolved(true),
}

export const api: AppApi = (window as unknown as { api?: AppApi }).api ?? stub
export type { AudioDevice, LyricsLine }
