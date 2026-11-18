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
import { registerMediaProtocol } from './media.js'
import { scanFolders, scanPaths, probeFile, pickFolders, importM3u, exportM3u, isAudioFile } from './library.js'
import { getLyrics } from './lyrics.js'
import * as updater from './updater.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEV_URL = process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let normalBounds: Electron.Rectangle | null = null

let pendingFiles: string[] = []
let closeChoice: 'ask' | 'tray' | 'quit' = 'ask'
let closeDialogOpen = false
let quitting = false
let lastMiniState: unknown = null
let thumbIcons: Record<string, Electron.NativeImage> = {}
let thumbPlaying = false

// The Windows media overlay (Action Center / Quick Settings) is driven by the
// renderer's MediaSession; this keeps that Chromium service available.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-features', 'MediaSessionService')
  // Chromium's own media-key listener claims Play/Pause and Next/Previous
  // before globalShortcut can, which made the hardware keys a no-op on
  // Windows. Turning it off hands the keys to the shortcuts below; the media
  // overlay keeps working through the renderer's MediaSession handlers.
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

/**
 * Local, opt-out-free crash log so a user can send us something useful when
 * the app misbehaves. Nothing leaves the machine.
 */
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

function appIconPath(): string | undefined {
  const candidates = [
    path.join(app.getAppPath(), 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

/* --------------------------- default apps --------------------------- */

/**
 * Audio extensions MeowPlayer offers to open. Registering a ProgID for each one
 * (plus a Capabilities block under HKEY_CURRENT_USER) is what makes the app
 * appear in Windows Settings → Apps → Default apps, instead of only in the
 * "Open with" context menu.
 */
const HANDLED_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.wma', '.aiff', '.aif', '.alac']
const PROG_ID = 'MeowPlayer.AudioFile'

function registerDefaultApps(): void {
  if (process.platform !== 'win32') return

  const command = process.defaultApp
    ? `"${process.execPath}" "${app.getAppPath()}" "%1"`
    : `"${process.execPath}" "%1"`
  const iconSource = path.join(app.getAppPath(), 'assets', 'icon.ico')
  const icon = fs.existsSync(iconSource) ? `"${iconSource}",0` : `"${process.execPath}",0`
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

  for (const args of entries) {
    execFile('reg', args, { windowsHide: true }, (error, _stdout, stderr) => {
      if (error) console.warn('[default-apps] could not register MeowPlayer', stderr || error.message)
    })
  }
}

/* ------------------------------ close choice ----------------------------- */

function readCloseChoice(): 'ask' | 'tray' | 'quit' {
  const state = getState() as Record<string, any>
  const value = state?.settings?.closeBehavior
  if (value === 'ask' || value === 'tray' || value === 'quit') return value
  if (typeof state?.settings?.closeToTray === 'boolean') return state.settings.closeToTray ? 'tray' : 'quit'
  return 'ask'
}

async function askCloseChoice(win: BrowserWindow): Promise<void> {
  if (closeDialogOpen || win.isDestroyed()) return
  closeDialogOpen = true
  try {
    const { response, checkboxChecked } = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Close MeowPlayer',
      message: 'Close MeowPlayer or keep the music running?',
      detail:
        'Choosing the system tray hides the window and keeps playback going from the tray icon.\nYou can change this later in Settings → Playback.',
      buttons: ['Minimize to tray', 'Quit MeowPlayer', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      checkboxLabel: 'Remember my choice',
      checkboxChecked: false,
    })

    if (response !== 0 && response !== 1) return
    const choice: 'tray' | 'quit' = response === 0 ? 'tray' : 'quit'

    if (checkboxChecked) {
      closeChoice = choice
      const state = getState() as Record<string, any>
      patchState({ settings: { ...(state?.settings ?? {}), closeBehavior: choice } })
      flush()
    }

    if (choice === 'tray') win.hide()
    else {
      quitting = true
      app.quit()
    }
  } finally {
    closeDialogOpen = false
  }
}

/* ----------------------------- windows ----------------------------- */

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    frame: false,
    title: 'MeowPlayer',
    icon: appIconPath(),
    backgroundColor: '#0a0c10',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })

  if (process.platform === 'win32') {
    try {
      win.setBackgroundMaterial('acrylic')
    } catch {
      /* older Windows builds */
    }
  }

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
    void askCloseChoice(win)
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

function ensureMini(): BrowserWindow {
  if (miniWindow && !miniWindow.isDestroyed()) return miniWindow

  const display = screen.getPrimaryDisplay()
  const width = 404
  const height = 176

  const win = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + display.workArea.width - width - 16,
    y: display.workArea.y + display.workArea.height - height - 16,
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
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  if (DEV_URL) void win.loadURL(`${DEV_URL}#mini`)
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'mini' })

  win.once('ready-to-show', () => {
    win.setAlwaysOnTop(true, 'floating')
    win.showInactive()
    if (lastMiniState) win.webContents.send('mini:state', lastMiniState)
  })
  win.on('closed', () => {
    if (miniWindow === win) miniWindow = null
  })

  miniWindow = win
  return win
}

function showMini(): void {
  const win = ensureMini()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
  // ensureMini() only shows the window the first time it is created, so the
  // second trip into mini mode used to leave an invisible window behind.
  if (win && !win.isDestroyed() && !win.isVisible()) win.showInactive()
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
  const candidates = [
    path.join(app.getAppPath(), 'assets', 'tray.png'),
    path.join(__dirname, '..', 'assets', 'tray.png'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate)
      if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
    }
  }

  // Native image loading cannot always read from inside app.asar — copy it out once.
  try {
    const source = path.join(app.getAppPath(), 'assets', 'tray.png')
    if (fs.existsSync(source)) {
      const target = path.join(app.getPath('userData'), 'tray-icon.png')
      fs.copyFileSync(source, target)
      const image = nativeImage.createFromPath(target)
      if (!image.isEmpty()) return image.resize({ width: 16, height: 16 })
    }
  } catch (err) {
    console.warn('[tray] could not extract the tray icon', err)
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

  const menu = Menu.buildFromTemplate([
    { label: 'Open MeowPlayer', click: () => showMain() },
    { type: 'separator' },
    { label: 'Play / Pause', click: () => sendToRenderer('player:cmd', 'playpause') },
    { label: 'Next track', click: () => sendToRenderer('player:cmd', 'next') },
    { label: 'Previous track', click: () => sendToRenderer('player:cmd', 'prev') },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit() } },
  ])
  tray.setContextMenu(menu)

  // Left click opens the full player, right click opens the menu attached with
  // setContextMenu above. Nothing on the tray opens the mini player.
  tray.on('click', () => showMain())
}

/* --------------------------- taskbar thumbar --------------------------- */

function updateThumbar(playing: boolean): void {
  thumbPlaying = playing
  const win = mainWindow
  if (!win || win.isDestroyed()) return

  const prev = thumbIcons.prev
  const next = thumbIcons.next
  const main = playing ? thumbIcons.pause : thumbIcons.play
  if (!prev || !next || !main) return

  const buttons: Electron.ThumbarButton[] = [
    { tooltip: 'Previous', icon: prev, click: () => sendToRenderer('player:cmd', 'prev') },
    { tooltip: playing ? 'Pause' : 'Play', icon: main, click: () => sendToRenderer('player:cmd', 'playpause') },
    { tooltip: 'Next', icon: next, click: () => sendToRenderer('player:cmd', 'next') },
  ]

  try {
    win.setThumbarButtons(buttons)
    win.setThumbnailToolTip('MeowPlayer')
  } catch (err) {
    console.warn('[thumbar] could not set the thumbnail buttons', err)
  }
}

/* ---------------------------- shortcuts ---------------------------- */

function registerShortcuts(): void {
  const fire = (action: string): void => sendToRenderer('player:cmd', action)
  const keys: [string, string][] = [
    ['MediaPlayPause', 'playpause'],
    ['MediaStop', 'stop'],
    ['MediaNextTrack', 'next'],
    ['MediaPreviousTrack', 'prev'],
  ]
  // register() reports failure by returning false (it does not throw) when the
  // key is already taken, so the old try/catch hid every failure. Retry a few
  // times, because Windows sometimes still holds the key while the window is
  // being created, and log whatever stayed unbound.
  const bind = (): string[] => {
    const failed: string[] = []
    for (const [accelerator, action] of keys) {
      if (globalShortcut.isRegistered(accelerator)) continue
      let ok = false
      try {
        ok = globalShortcut.register(accelerator, () => fire(action))
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
    if (failed.length > 0) {
      console.warn('[shortcuts] media keys held by another app:', failed.join(', '))
    }
  }
  attempt()
}

/* -------------------------------- ipc ------------------------------- */

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
  ipcMain.handle('library:scan', async (_e, folders: string[]) => {
    const win = mainWindow
    return scanFolders(folders ?? [], (done, total) => {
      win?.webContents.send('library:progress', { done, total })
    })
  })
  ipcMain.handle('library:ingest', async (_e, paths: string[]) => scanPaths(paths ?? []))
  ipcMain.handle('library:probe', (_e, file: string) => probeFile(file))
  ipcMain.handle('library:pickImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined as unknown as BrowserWindow, {
      title: 'Choose a cover image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
      buttonLabel: 'Use image',
    })
    const file = result.canceled ? null : result.filePaths[0]
    if (!file) return null
    try {
      const stat = await fs.promises.stat(file)
      if (!stat.isFile() || stat.size > 6 * 1024 * 1024) return null
      const ext = path.extname(file).toLowerCase()
      const mime =
        ext === '.png' ? 'image/png'
          : ext === '.webp' ? 'image/webp'
            : ext === '.gif' ? 'image/gif'
              : ext === '.bmp' ? 'image/bmp'
                : 'image/jpeg'
      // Shrink large artwork before it lands in the settings file.
      const image = nativeImage.createFromPath(file)
      if (!image.isEmpty()) {
        const { width } = image.getSize()
        const resized = width > 512 ? image.resize({ width: 512, quality: 'good' }) : image
        return resized.toDataURL()
      }
      const data = await fs.promises.readFile(file)
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (err) {
      console.warn('[covers] could not read the chosen image', err)
      return null
    }
  })
  ipcMain.handle('library:importM3u', () => importM3u(mainWindow))
  ipcMain.handle('library:exportM3u', (_e, name: string, entries: any[]) => exportM3u(mainWindow, name, entries))

  ipcMain.handle('store:load', () => getState())
  ipcMain.handle('store:save', (_e, patch: Record<string, unknown>) => {
    patchState(patch ?? {})
    return true
  })

  ipcMain.handle('lyrics:get', (_e, query: any) => getLyrics(query ?? {}))

  ipcMain.handle('app:openExternal', async (_e, url: string) => {
    if (/^https?:/i.test(url)) await shell.openExternal(url)
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:revealFile', (_e, file: string) => {
    if (file) shell.showItemInFolder(file)
    return true
  })
  ipcMain.handle('app:openDefaultApps', () => {
    void shell.openExternal('ms-settings:defaultapps')
    return true
  })
  ipcMain.handle('app:exportSettings', async (_e, json: string) => {
    const result = await dialog.showSaveDialog(mainWindow ?? undefined as unknown as BrowserWindow, {
      title: 'Export MeowPlayer settings',
      defaultPath: 'meowplayer-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      buttonLabel: 'Export',
    })
    if (result.canceled || !result.filePath) return false
    try {
      await fs.promises.writeFile(result.filePath, json, 'utf8')
      return true
    } catch (err) {
      console.warn('[settings] export failed', err)
      return false
    }
  })
  ipcMain.handle('app:importSettings', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined as unknown as BrowserWindow, {
      title: 'Import MeowPlayer settings',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      buttonLabel: 'Import',
    })
    const file = result.canceled ? null : result.filePaths[0]
    if (!file) return null
    try {
      const text = await fs.promises.readFile(file, 'utf8')
      const parsed = JSON.parse(text)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch (err) {
      console.warn('[settings] import failed', err)
      return null
    }
  })
  ipcMain.handle('app:notify', (_e, payload: { title?: string; body?: string }) => {
    if (!Notification.isSupported()) return false
    new Notification({ title: payload?.title ?? 'MeowPlayer', body: payload?.body ?? '' }).show()
    return true
  })
  ipcMain.on('log:error', (_e, message: string) => logCrash('renderer', message))
  ipcMain.handle('log:path', () => crashLogPath())

  ipcMain.handle('update:check', (_e, force: boolean) => updater.check(Boolean(force)))
  ipcMain.handle('update:snooze', (_e, days: number) => updater.snooze(Number(days) || 7))
  ipcMain.handle('update:install', (_e, info: any) => updater.install(info))
  ipcMain.handle('update:open', (_e, url: string) => updater.openReleasePage(url))

  ipcMain.on('ui:trayPrefs', (_e, prefs: { closeBehavior?: string }) => {
    if (prefs?.closeBehavior === 'ask' || prefs?.closeBehavior === 'tray' || prefs?.closeBehavior === 'quit') {
      closeChoice = prefs.closeBehavior
    }
  })

  ipcMain.on('ui:thumbar', (_e, icons: Record<string, string>) => {
    thumbIcons = {
      play: nativeImage.createFromDataURL(icons.play),
      pause: nativeImage.createFromDataURL(icons.pause),
      prev: nativeImage.createFromDataURL(icons.prev),
      next: nativeImage.createFromDataURL(icons.next),
    }
    updateThumbar(thumbPlaying)
  })
  ipcMain.on('ui:thumbarState', (_e, playing: boolean) => updateThumbar(Boolean(playing)))

  ipcMain.on('mini:show', () => showMini())
  ipcMain.on('mini:hide', () => showMain())
  ipcMain.handle('mini:state', () => lastMiniState)
  ipcMain.on('mini:broadcast', (_e, state: unknown) => {
    lastMiniState = state
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.webContents.send('mini:state', state)
  })
  ipcMain.on('mini:cmd', (_e, command: string) => {
    if (command === 'expand') {
      showMain()
      return
    }
    if (command === 'hideMini') {
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

  const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
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

  void app.whenReady().then(async () => {
    initStore()
    registerMediaProtocol()
    registerIpc()
    registerDefaultApps()

    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(true))
    session.defaultSession.setPermissionCheckHandler(() => true)

    mainWindow = createWindow()
    createTray()
    registerShortcuts()

    // Pause rather than keep playing to an empty room when the PC sleeps or locks.
    powerMonitor.on('suspend', () => sendToRenderer('system:pause'))
    powerMonitor.on('lock-screen', () => sendToRenderer('system:pause'))

    // Quiet background check shortly after launch, respecting the user's choices.
    setTimeout(() => {
      void updater.check().then((info) => {
        if (info?.available) sendToRenderer('update:available', info)
      })
    }, 6000)

    closeChoice = readCloseChoice()

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
