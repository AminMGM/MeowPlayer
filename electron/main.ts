import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  protocol,
  screen,
  session,
  shell,
  Tray,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { initStore, getState, patchState, flush } from './store.js'
import { grantDirectory, registerMediaProtocol } from './media.js'
import {
  exportM3u,
  importM3u,
  pickPlaylistExports,
  isAudioFile,
  pickFolders,
  probeFile,
  pruneCovers,
  scanFolders,
  scanPaths,
  watchFolders,
  writeTags,
  type TagEdit,
} from './library.js'
import { fetchCover, lookupFix, type MetaChanges, type MetaInput } from './metadata.js'
import { cacheStats, cachedStatus, clearCache, getLyrics } from './lyrics.js'
import * as updater from './updater.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEV_URL = process.env.VITE_DEV_SERVER_URL

// A separate profile (used for screenshots and testing) keeps a real library untouched.
if (process.env.MEOWPLAYER_PROFILE) {
  app.setPath('userData', path.resolve(process.env.MEOWPLAYER_PROFILE))
}

type CloseBehavior = 'ask' | 'tray' | 'quit'

let mainWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null

let pendingFiles: string[] = []
let closeChoice: CloseBehavior = 'ask'
let quitting = false
let lastMiniState: unknown = null
let thumbIcons: Record<string, Electron.NativeImage> = {}
let thumbPlaying = false

// The Windows media overlay is driven by the renderer's MediaSession; this
// keeps that Chromium service available. Chromium's own media-key listener
// would otherwise claim the hardware keys before globalShortcut can.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-features', 'MediaSessionService')
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mp-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true },
  },
])

const preloadPath = (): string => path.join(__dirname, 'preload.cjs')

/* --------------------------- crash logging --------------------------- */

/** Local crash log so a user can send something useful. Nothing leaves the machine. */
function crashLogPath(): string {
  return path.join(app.getPath('userData'), 'logs', 'crash.log')
}

function logCrash(kind: string, detail: unknown): void {
  try {
    const file = crashLogPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const text = detail instanceof Error ? `${detail.message}\n${detail.stack ?? ''}` : String(detail)
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${kind}: ${text}\n`)
  } catch {
    /* logging must never take the app down */
  }
}

process.on('uncaughtException', (error) => {
  logCrash('uncaughtException', error)
  console.error('[crash]', error)
})

process.on('unhandledRejection', (reason) => {
  logCrash('unhandledRejection', reason)
  console.error('[crash]', reason)
})

function assetPath(name: string): string | undefined {
  const candidates = [path.join(app.getAppPath(), 'assets', name), path.join(__dirname, '..', 'assets', name)]
  return candidates.find((candidate) => fs.existsSync(candidate))
}

/* --------------------------- default apps --------------------------- */

/**
 * Registers a ProgID per audio extension plus a Capabilities block under
 * HKEY_CURRENT_USER, which is what lists MeowPlayer in Settings → Apps →
 * Default apps. It only runs once per installed version, and never from a
 * development build (which would register the dev Electron binary).
 */
const HANDLED_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.wma', '.aiff', '.aif', '.alac']
const PROG_ID = 'MeowPlayer.AudioFile'

function registerDefaultApps(): void {
  if (process.platform !== 'win32' || process.defaultApp || !app.isPackaged) return

  const marker = path.join(app.getPath('userData'), 'registered-version')
  try {
    if (fs.readFileSync(marker, 'utf8').trim() === `${app.getVersion()}|${process.execPath}`) return
  } catch {
    /* first run */
  }

  const command = `"${process.execPath}" "%1"`
  const iconSource = assetPath('icon.ico')
  const icon = iconSource ? `"${iconSource}",0` : `"${process.execPath}",0`
  const capabilities = 'Software\\MeowPlayer\\Capabilities'

  const entries: string[][] = [
    ['add', `HKCU\\Software\\Classes\\${PROG_ID}`, '/ve', '/d', 'MeowPlayer audio file', '/f'],
    ['add', `HKCU\\Software\\Classes\\${PROG_ID}\\DefaultIcon`, '/ve', '/d', icon, '/f'],
    ['add', `HKCU\\Software\\Classes\\${PROG_ID}\\shell\\open\\command`, '/ve', '/d', command, '/f'],
    ['add', `HKCU\\${capabilities}`, '/v', 'ApplicationName', '/d', 'MeowPlayer', '/f'],
    ['add', `HKCU\\${capabilities}`, '/v', 'ApplicationDescription', '/d', 'MeowPlayer local music player', '/f'],
    ['add', `HKCU\\${capabilities}`, '/v', 'ApplicationIcon', '/d', icon, '/f'],
    ['add', 'HKCU\\Software\\RegisteredApplications', '/v', 'MeowPlayer', '/d', capabilities, '/f'],
  ]
  for (const extension of HANDLED_EXTENSIONS) {
    entries.push(['add', `HKCU\\${capabilities}\\FileAssociations`, '/v', extension, '/d', PROG_ID, '/f'])
    entries.push(['add', `HKCU\\Software\\Classes\\${extension}\\OpenWithProgids`, '/v', PROG_ID, '/d', '', '/f'])
  }

  let failed = false
  let pending = entries.length
  for (const args of entries) {
    execFile('reg', args, { windowsHide: true }, (error, _stdout, stderr) => {
      if (error) {
        failed = true
        console.warn('[default-apps] could not register MeowPlayer', stderr || error.message)
      }
      pending -= 1
      if (pending === 0 && !failed) {
        try {
          fs.writeFileSync(marker, `${app.getVersion()}|${process.execPath}`)
        } catch {
          /* try again next launch */
        }
      }
    })
  }
}

/* ------------------------------ close choice ----------------------------- */

const isCloseBehavior = (value: unknown): value is CloseBehavior =>
  value === 'ask' || value === 'tray' || value === 'quit'

function readCloseChoice(): CloseBehavior {
  const settings = (getState().settings ?? {}) as Record<string, unknown>
  if (isCloseBehavior(settings.closeBehavior)) return settings.closeBehavior
  if (typeof settings.closeToTray === 'boolean') return settings.closeToTray ? 'tray' : 'quit'
  return 'ask'
}

/**
 * Asks the renderer to show its own close dialog, so the question matches the
 * app's theme instead of being a plain Windows message box. The answer comes
 * back on 'app:closeChoice'.
 */
function askCloseChoice(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (!win.isVisible()) win.show()
  win.focus()
  win.webContents.send('app:closeRequest')
}

function applyCloseChoice(choice: CloseBehavior, remember: boolean): void {
  const win = mainWindow
  if (remember && choice !== 'ask') {
    closeChoice = choice
    // The renderer owns the settings object; it saves this choice itself.
    sendToRenderer('settings:closeBehavior', choice)
    const settings = (getState().settings ?? {}) as Record<string, unknown>
    patchState({ settings: { ...settings, closeBehavior: choice } })
    flush()
  }
  if (choice === 'tray') win?.hide()
  else if (choice === 'quit') {
    quitting = true
    app.quit()
  }
}

/* ----------------------------- windows ----------------------------- */

/** Windows 11 frosted glass behind the page; older Windows builds just stay opaque. */
function applyAcrylic(win: BrowserWindow): void {
  if (process.platform !== 'win32') return
  try {
    win.setBackgroundMaterial('acrylic')
  } catch {
    /* not supported on this Windows build */
  }
}

const secureWebPreferences = (): Electron.WebPreferences => ({
  preload: preloadPath(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
  backgroundThrottling: false,
})

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 640,
    minHeight: 480,
    show: false,
    frame: false,
    title: 'MeowPlayer',
    icon: assetPath('icon.png'),
    backgroundColor: '#0a0c10',
    backgroundMaterial: 'acrylic',
    webPreferences: secureWebPreferences(),
  })
  applyAcrylic(win)

  win.once('ready-to-show', () => {
    win.show()
    const files = pendingFiles.splice(0)
    if (files.length) {
      win.webContents.send('open-files', files)
      showMini()
    }
  })

  // Windows can drop the thumbnail toolbar while the window is hidden, so it is
  // re-applied every time the window comes back into view.
  win.on('show', () => updateThumbar(thumbPlaying))
  win.on('focus', () => updateThumbar(thumbPlaying))

  if (DEV_URL) void win.loadURL(DEV_URL)
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  win.on('maximize', () => win.webContents.send('win:maximized', true))
  win.on('unmaximize', () => win.webContents.send('win:maximized', false))

  win.on('close', (event) => {
    if (quitting) return
    if (closeChoice === 'tray') {
      event.preventDefault()
      win.hide()
      return
    }
    if (closeChoice === 'quit') return
    event.preventDefault()
    askCloseChoice(win)
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (DEV_URL && url.startsWith(DEV_URL)) return
    event.preventDefault()
  })

  return win
}

function ensureMini(): BrowserWindow {
  if (miniWindow && !miniWindow.isDestroyed()) return miniWindow

  const display = screen.getPrimaryDisplay()
  const width = 340
  const height = 196

  // A see-through window: the card inside is translucent, so the desktop
  // shows through it. (Acrylic is not used here because Windows turns it
  // solid whenever the window is not focused, and the mini player rarely is.)
  const win = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + display.workArea.width - width - 12,
    y: display.workArea.y + display.workArea.height - height - 12,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    roundedCorners: false,
    webPreferences: secureWebPreferences(),
  })

  if (DEV_URL) void win.loadURL(`${DEV_URL}#mini`)
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'mini' })

  win.once('ready-to-show', () => {
    win.setAlwaysOnTop(true, 'floating')
    win.showInactive()
    if (lastMiniState) win.webContents.send('mini:state', lastMiniState)
  })
  win.on('show', () => sendToRenderer('mini:visible', true))
  win.on('hide', () => sendToRenderer('mini:visible', false))
  win.on('closed', () => {
    if (miniWindow === win) miniWindow = null
    sendToRenderer('mini:visible', false)
  })

  miniWindow = win
  return win
}

function showMini(): void {
  const win = ensureMini()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
  if (!win.isDestroyed() && !win.isVisible()) win.showInactive()
}

function showMain(): void {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.hide()
  if (!mainWindow) mainWindow = createWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function sendToRenderer(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

/* ------------------------------ tray ------------------------------ */

function trayImage(): Electron.NativeImage {
  const source = assetPath('tray.png')
  if (source) {
    const image = nativeImage.createFromPath(source)
    if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
    // Native image loading cannot always read from inside app.asar, so copy it out once.
    try {
      const target = path.join(app.getPath('userData'), 'tray-icon.png')
      fs.copyFileSync(source, target)
      const copy = nativeImage.createFromPath(target)
      if (!copy.isEmpty()) return copy.resize({ width: 16, height: 16 })
    } catch (err) {
      console.warn('[tray] could not extract the tray icon', err)
    }
  }
  return nativeImage.createEmpty()
}

function createTray(): void {
  if (tray) return
  const image = trayImage()
  if (image.isEmpty()) {
    console.warn('[tray] icon unavailable, tray disabled')
    return
  }
  try {
    tray = new Tray(image)
  } catch (err) {
    console.error('[tray] failed to create the tray icon', err)
    return
  }
  tray.setToolTip('MeowPlayer')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open MeowPlayer', click: () => showMain() },
      { label: 'Mini player', click: () => showMini() },
      { type: 'separator' },
      { label: 'Play / Pause', click: () => sendToRenderer('player:cmd', 'playpause') },
      { label: 'Next track', click: () => sendToRenderer('player:cmd', 'next') },
      { label: 'Previous track', click: () => sendToRenderer('player:cmd', 'prev') },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => showMain())
}

/* --------------------------- taskbar thumbar --------------------------- */

function updateThumbar(playing: boolean): void {
  thumbPlaying = playing
  const win = mainWindow
  if (!win || win.isDestroyed()) return

  const { prev, next } = thumbIcons
  const main = playing ? thumbIcons.pause : thumbIcons.play
  if (!prev || !next || !main) return

  try {
    win.setThumbarButtons([
      { tooltip: 'Previous', icon: prev, click: () => sendToRenderer('player:cmd', 'prev') },
      { tooltip: playing ? 'Pause' : 'Play', icon: main, click: () => sendToRenderer('player:cmd', 'playpause') },
      { tooltip: 'Next', icon: next, click: () => sendToRenderer('player:cmd', 'next') },
    ])
    win.setThumbnailToolTip('MeowPlayer')
  } catch (err) {
    console.warn('[thumbar] could not set the thumbnail buttons', err)
  }
}

/* ---------------------------- shortcuts ---------------------------- */

function registerShortcuts(): void {
  const keys: [string, string][] = [
    ['MediaPlayPause', 'playpause'],
    ['MediaStop', 'stop'],
    ['MediaNextTrack', 'next'],
    ['MediaPreviousTrack', 'prev'],
  ]
  // register() returns false (it does not throw) when another app holds the
  // key. Windows sometimes still holds it while the window is being created,
  // so retry a few times before giving up.
  const bind = (): string[] => {
    const failed: string[] = []
    for (const [accelerator, action] of keys) {
      if (globalShortcut.isRegistered(accelerator)) continue
      let ok = false
      try {
        ok = globalShortcut.register(accelerator, () => sendToRenderer('player:cmd', action))
      } catch {
        ok = false
      }
      if (!ok) failed.push(accelerator)
    }
    return failed
  }

  let attempts = 0
  const attempt = (): void => {
    const failed = bind()
    if (failed.length > 0 && attempts < 4) {
      attempts += 1
      setTimeout(attempt, 1200)
      return
    }
    if (failed.length > 0) console.warn('[shortcuts] media keys held by another app:', failed.join(', '))
  }
  attempt()
}

/* -------------------------------- ipc ------------------------------- */

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

async function showOpen(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  return mainWindow ? dialog.showOpenDialog(mainWindow, options) : dialog.showOpenDialog(options)
}

function registerIpc(): void {
  ipcMain.on('win:minimize', () => mainWindow?.minimize())
  ipcMain.on('win:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('win:close', () => mainWindow?.close())
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false)

  ipcMain.handle('library:pickFolders', () => pickFolders(mainWindow))
  ipcMain.handle('library:scan', async (_e, folders: unknown, known: unknown) => {
    const list = Array.isArray(folders) ? folders.filter((item): item is string => typeof item === 'string') : []
    for (const folder of list) grantDirectory(folder)
    const knownMap = known && typeof known === 'object' ? (known as Record<string, number>) : {}
    return scanFolders(list, knownMap, (done, total) => sendToRenderer('library:progress', { done, total }))
  })
  ipcMain.handle('library:ingest', async (_e, paths: unknown) =>
    scanPaths(Array.isArray(paths) ? paths.filter((item): item is string => typeof item === 'string') : []),
  )
  ipcMain.handle('library:probe', (_e, file: unknown) => (typeof file === 'string' ? probeFile(file) : null))
  ipcMain.handle('library:writeTags', (_e, file: unknown, edit: unknown) => {
    if (typeof file !== 'string' || !edit || typeof edit !== 'object') return { error: 'Invalid request' }
    return writeTags(file, edit as TagEdit)
  })
  ipcMain.handle('meta:lookup', (_e, item: unknown, online: unknown, replaceArt: unknown) => {
    if (!item || typeof item !== 'object') return null
    const input = item as MetaInput
    if (typeof input.path !== 'string' || typeof input.title !== 'string') return null
    return lookupFix(
      {
        id: String(input.id),
        path: input.path,
        title: input.title,
        artist: String(input.artist ?? ''),
        album: String(input.album ?? ''),
        albumArtist: String(input.albumArtist ?? ''),
        year: typeof input.year === 'number' ? input.year : null,
        trackNo: typeof input.trackNo === 'number' ? input.trackNo : null,
        duration: Number(input.duration) || 0,
        hasCover: Boolean(input.hasCover),
      },
      Boolean(online),
      Boolean(replaceArt),
    )
  })
  ipcMain.handle('meta:apply', async (_e, file: unknown, changes: unknown, coverUrl: unknown) => {
    if (typeof file !== 'string' || !changes || typeof changes !== 'object') return { error: 'Invalid request' }
    const c = changes as MetaChanges
    const edit: TagEdit = {}
    for (const key of ['title', 'artist', 'album', 'albumArtist'] as const) {
      if (typeof c[key] === 'string') edit[key] = c[key]
    }
    if (typeof c.year === 'number') edit.year = c.year
    if (typeof c.trackNo === 'number') edit.trackNo = c.trackNo
    if (typeof coverUrl === 'string') {
      const cover = await fetchCover(coverUrl)
      if (cover) edit.cover = cover
    }
    return writeTags(file, edit)
  })
  ipcMain.handle('library:pruneCovers', (_e, used: unknown) =>
    pruneCovers(Array.isArray(used) ? used.filter((item): item is string => typeof item === 'string') : []),
  )
  ipcMain.on('library:watch', (_e, folders: unknown) => {
    const list = Array.isArray(folders) ? folders.filter((item): item is string => typeof item === 'string') : []
    watchFolders(list, () => sendToRenderer('library:changed'))
  })
  ipcMain.handle('library:pickImage', async () => {
    const result = await showOpen({
      title: 'Choose a cover image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
      buttonLabel: 'Use image',
    })
    const file = result.canceled ? null : result.filePaths[0]
    if (!file) return null
    try {
      const stat = await fs.promises.stat(file)
      if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return null
      // Shrink large artwork before it lands in the settings file.
      const image = nativeImage.createFromPath(file)
      if (!image.isEmpty()) {
        const { width } = image.getSize()
        return (width > 512 ? image.resize({ width: 512, quality: 'good' }) : image).toDataURL()
      }
      const mime = IMAGE_MIME[path.extname(file).toLowerCase()] ?? 'image/jpeg'
      const data = await fs.promises.readFile(file)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (err) {
      console.warn('[covers] could not read the chosen image', err)
      return null
    }
  })
  ipcMain.handle('library:importM3u', () => importM3u(mainWindow))
  ipcMain.handle('library:pickPlaylistExports', () => pickPlaylistExports(mainWindow))
  ipcMain.handle('library:exportM3u', (_e, name: unknown, entries: unknown) =>
    exportM3u(mainWindow, String(name ?? 'Playlist'), Array.isArray(entries) ? entries : []),
  )

  ipcMain.handle('store:load', () => getState())
  ipcMain.handle('store:save', (_e, patch: unknown) => {
    if (patch && typeof patch === 'object' && !Array.isArray(patch)) patchState(patch as Record<string, unknown>)
    return true
  })

  ipcMain.handle('lyrics:cached', (_e, queries: unknown) =>
    cachedStatus(Array.isArray(queries) ? (queries as Parameters<typeof cachedStatus>[0]) : []),
  )
  ipcMain.handle('lyrics:stats', () => cacheStats())
  ipcMain.handle('lyrics:clear', () => clearCache())
  ipcMain.handle('lyrics:get', (_e, query: unknown) =>
    getLyrics((query && typeof query === 'object' ? query : {}) as Parameters<typeof getLyrics>[0]),
  )

  ipcMain.handle('app:openExternal', async (_e, url: unknown) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) await shell.openExternal(url)
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:revealFile', (_e, file: unknown) => {
    if (typeof file === 'string' && file) shell.showItemInFolder(file)
    return true
  })
  ipcMain.handle('app:openDefaultApps', () => {
    void shell.openExternal('ms-settings:defaultapps')
    return true
  })
  ipcMain.handle('app:exportSettings', async (_e, json: unknown) => {
    const options: Electron.SaveDialogOptions = {
      title: 'Export MeowPlayer settings',
      defaultPath: 'meowplayer-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      buttonLabel: 'Export',
    }
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    try {
      await fs.promises.writeFile(result.filePath, String(json ?? '{}'), 'utf8')
      return true
    } catch (err) {
      console.warn('[settings] export failed', err)
      return false
    }
  })
  ipcMain.handle('app:importSettings', async () => {
    const result = await showOpen({
      title: 'Import MeowPlayer settings',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      buttonLabel: 'Import',
    })
    const file = result.canceled ? null : result.filePaths[0]
    if (!file) return null
    try {
      const parsed = JSON.parse(await fs.promises.readFile(file, 'utf8'))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch (err) {
      console.warn('[settings] import failed', err)
      return null
    }
  })
  ipcMain.handle('app:notify', (_e, payload: { title?: unknown; body?: unknown }) => {
    if (!Notification.isSupported()) return false
    new Notification({ title: String(payload?.title ?? 'MeowPlayer'), body: String(payload?.body ?? '') }).show()
    return true
  })
  ipcMain.on('log:error', (_e, message: unknown) => logCrash('renderer', String(message)))
  ipcMain.handle('log:path', () => crashLogPath())

  ipcMain.handle('update:check', (_e, force: unknown) => updater.check(Boolean(force)))
  ipcMain.handle('update:snooze', (_e, days: unknown) => updater.snooze(Number(days) || 7))
  ipcMain.handle('update:download', () => updater.download())
  ipcMain.handle('update:install', () => updater.install())
  ipcMain.handle('update:open', (_e, url: unknown) => updater.openReleasePage(typeof url === 'string' ? url : undefined))

  ipcMain.on('app:closeChoice', (_e, payload: { choice?: unknown; remember?: unknown }) => {
    if (payload?.choice === 'tray' || payload?.choice === 'quit') applyCloseChoice(payload.choice, Boolean(payload.remember))
  })

  ipcMain.on('ui:trayPrefs', (_e, prefs: { closeBehavior?: unknown }) => {
    if (isCloseBehavior(prefs?.closeBehavior)) closeChoice = prefs.closeBehavior
  })

  ipcMain.on('ui:thumbar', (_e, icons: Record<string, string>) => {
    const load = (value: unknown): Electron.NativeImage =>
      typeof value === 'string' && value.startsWith('data:image/png') ? nativeImage.createFromDataURL(value) : nativeImage.createEmpty()
    thumbIcons = { play: load(icons?.play), pause: load(icons?.pause), prev: load(icons?.prev), next: load(icons?.next) }
    updateThumbar(thumbPlaying)
  })
  ipcMain.on('ui:thumbarState', (_e, playing: unknown) => updateThumbar(Boolean(playing)))

  ipcMain.on('mini:show', () => showMini())
  ipcMain.on('mini:hide', () => showMain())
  ipcMain.handle('mini:state', () => lastMiniState)
  ipcMain.handle('mini:isVisible', () => Boolean(miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible()))
  ipcMain.on('mini:broadcast', (_e, state: unknown) => {
    lastMiniState = state
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.webContents.send('mini:state', state)
  })
  ipcMain.on('mini:cmd', (_e, command: unknown) => {
    if (typeof command !== 'string') return
    if (command === 'expand' || command === 'hideMini') {
      showMain()
      return
    }
    sendToRenderer('player:cmd', command)
  })
}

/* ------------------------------ startup ----------------------------- */

function filesFromArgv(argv: string[]): string[] {
  return argv.slice(1).filter((arg) => !arg.startsWith('-') && isAudioFile(arg))
}

const ALLOWED_PERMISSIONS = new Set(['media', 'speaker-selection', 'notifications', 'fullscreen', 'clipboard-sanitized-write'])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const files = filesFromArgv(argv)
    if (files.length) {
      sendToRenderer('open-files', files)
      showMini()
      return
    }
    showMain()
  })

  app.setAppUserModelId('com.meowplayer.app')
  pendingFiles = filesFromArgv(process.argv)

  void app.whenReady().then(() => {
    initStore()
    closeChoice = readCloseChoice()
    registerMediaProtocol()
    registerIpc()
    registerDefaultApps()
    updater.initUpdater(
      (info) => sendToRenderer('update:status', info),
      // Restarting into an update closes every window first; close-to-tray must not stop it.
      () => {
        quitting = true
        flush()
      },
    )

    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(ALLOWED_PERMISSIONS.has(permission)),
    )
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))

    mainWindow = createWindow()
    createTray()
    registerShortcuts()

    // Pause rather than keep playing to an empty room when the PC sleeps or locks.
    powerMonitor.on('suspend', () => sendToRenderer('system:pause'))
    powerMonitor.on('lock-screen', () => sendToRenderer('system:pause'))

    // Quiet background check shortly after launch, respecting the user's choices.
    setTimeout(() => {
      updater
        .check()
        .then((info) => {
          if (info?.available) sendToRenderer('update:available', info)
        })
        .catch(() => {
          /* offline: try again next launch */
        })
    }, 6000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
      else showMain()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    quitting = true
    flush()
    globalShortcut.unregisterAll()
  })
}
