import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

type Unsubscribe = () => void

function on<T = unknown>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_event: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  window: {
    minimize: (): void => ipcRenderer.send('win:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('win:maximize'),
    close: (): void => ipcRenderer.send('win:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
    onMaximizeChange: (cb: (value: boolean) => void): Unsubscribe => on('win:maximized', cb),
  },
  mini: {
    show: (): void => ipcRenderer.send('mini:show'),
    hide: (): void => ipcRenderer.send('mini:hide'),
    command: (command: string): void => ipcRenderer.send('mini:cmd', command),
    broadcast: (state: unknown): void => ipcRenderer.send('mini:broadcast', state),
    requestState: (): Promise<unknown> => ipcRenderer.invoke('mini:state'),
    isVisible: (): Promise<boolean> => ipcRenderer.invoke('mini:isVisible'),
    onState: (cb: (state: unknown) => void): Unsubscribe => on('mini:state', cb),
    onVisibility: (cb: (visible: boolean) => void): Unsubscribe => on('mini:visible', cb),
  },
  library: {
    pickFolders: (): Promise<string[]> => ipcRenderer.invoke('library:pickFolders'),
    scan: (folders: string[], known: Record<string, number>): Promise<unknown> =>
      ipcRenderer.invoke('library:scan', folders, known),
    ingest: (paths: string[]): Promise<unknown[]> => ipcRenderer.invoke('library:ingest', paths),
    probe: (file: string): Promise<unknown> => ipcRenderer.invoke('library:probe', file),
    writeTags: (file: string, edit: unknown): Promise<unknown> => ipcRenderer.invoke('library:writeTags', file, edit),
    pruneCovers: (used: string[]): Promise<number> => ipcRenderer.invoke('library:pruneCovers', used),
    watch: (folders: string[]): void => ipcRenderer.send('library:watch', folders),
    onChanged: (cb: () => void): Unsubscribe => on('library:changed', cb),
    pickImage: (): Promise<string | null> => ipcRenderer.invoke('library:pickImage'),
    onProgress: (cb: (value: { done: number; total: number }) => void): Unsubscribe => on('library:progress', cb),
    importM3u: (): Promise<{ name: string; paths: string[] } | null> => ipcRenderer.invoke('library:importM3u'),
    pickPlaylistExports: (): Promise<{ name: string; text: string }[]> => ipcRenderer.invoke('library:pickPlaylistExports'),
    exportM3u: (name: string, entries: unknown[]): Promise<boolean> =>
      ipcRenderer.invoke('library:exportM3u', name, entries),
  },
  store: {
    load: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:load'),
    save: (patch: Record<string, unknown>): Promise<boolean> => ipcRenderer.invoke('store:save', patch),
  },
  meta: {
    lookup: (item: unknown, online: boolean, replaceArt?: boolean): Promise<unknown> =>
      ipcRenderer.invoke('meta:lookup', item, online, replaceArt),
    apply: (file: string, changes: unknown, coverUrl?: string): Promise<unknown> =>
      ipcRenderer.invoke('meta:apply', file, changes, coverUrl),
  },
  lyrics: {
    get: (query: unknown): Promise<unknown> => ipcRenderer.invoke('lyrics:get', query),
    cached: (queries: unknown[]): Promise<boolean[]> => ipcRenderer.invoke('lyrics:cached', queries),
    stats: (): Promise<{ songs: number; bytes: number }> => ipcRenderer.invoke('lyrics:stats'),
    clear: (): Promise<void> => ipcRenderer.invoke('lyrics:clear'),
  },
  files: {
    paths: (files: File[]): string[] =>
      files
        .map((file) => {
          try {
            return webUtils.getPathForFile(file)
          } catch {
            return ''
          }
        })
        .filter(Boolean),
  },
  ui: {
    setZoom: (factor: number): void => webFrame.setZoomFactor(Math.min(1.6, Math.max(0.7, factor))),
    getZoom: (): number => webFrame.getZoomFactor(),
    thumbar: (icons: Record<string, string>): void => ipcRenderer.send('ui:thumbar', icons),
    thumbarState: (playing: boolean): void => ipcRenderer.send('ui:thumbarState', playing),
    trayPrefs: (prefs: { closeBehavior: string }): void => ipcRenderer.send('ui:trayPrefs', prefs),
    onCloseBehavior: (cb: (value: string) => void): Unsubscribe => on('settings:closeBehavior', cb),
    onCloseRequest: (cb: () => void): Unsubscribe => on('app:closeRequest', cb),
    answerClose: (choice: string, remember: boolean): void => ipcRenderer.send('app:closeChoice', { choice, remember }),
    openDefaultApps: (): Promise<boolean> => ipcRenderer.invoke('app:openDefaultApps'),
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    exportSettings: (json: string): Promise<boolean> => ipcRenderer.invoke('app:exportSettings', json),
    importSettings: (): Promise<Record<string, unknown> | null> => ipcRenderer.invoke('app:importSettings'),
    notify: (payload: { title: string; body: string }): Promise<boolean> => ipcRenderer.invoke('app:notify', payload),
    reportError: (message: string): void => ipcRenderer.send('log:error', message),
    logPath: (): Promise<string> => ipcRenderer.invoke('log:path'),
  },
  onSystemPause: (cb: () => void): Unsubscribe => on('system:pause', cb),
  updates: {
    check: (force: boolean): Promise<unknown> => ipcRenderer.invoke('update:check', force),
    snooze: (days: number): Promise<number> => ipcRenderer.invoke('update:snooze', days),
    download: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('update:download'),
    install: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('update:install'),
    openRelease: (url: string): Promise<void> => ipcRenderer.invoke('update:open', url),
    onAvailable: (cb: (info: unknown) => void): Unsubscribe => on('update:available', cb),
    onStatus: (cb: (info: unknown) => void): Unsubscribe => on('update:status', cb),
  },
  onPlayerCommand: (cb: (command: string) => void): Unsubscribe => on('player:cmd', cb),
  onOpenFiles: (cb: (paths: string[]) => void): Unsubscribe => on('open-files', cb),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
  revealFile: (file: string): Promise<boolean> => ipcRenderer.invoke('app:revealFile', file),
})
