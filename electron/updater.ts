import { app, net, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { getState } from './store.js'
import { isNewer } from './version.js'

const { autoUpdater } = electronUpdater

const REPO = 'AminMGM/MeowPlayer'
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES = `https://github.com/${REPO}/releases/latest`

export type UpdateStatus = 'available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateInfo {
  current: string
  version: string
  available: boolean
  notes: string
  pageUrl: string
  assetUrl: string | null
  status: UpdateStatus
  progress: UpdateProgress | null
  error: string | null
  /** True when the app can download and install the update itself. */
  canSelfUpdate: boolean
}

/**
 * Updates use electron-updater. Each release carries a `latest.yml` and a
 * `.blockmap` next to the installer; the blockmap lists the installer's chunks,
 * so an update only downloads the chunks that changed since the installed
 * version (usually a fraction of the full installer). The download is checked
 * against the SHA-512 in `latest.yml` before it can run, and it is installed on
 * "Restart to update" or the next time the app quits.
 *
 * Development builds cannot update themselves, so they only report what GitHub
 * offers and open the release page.
 */

let send: (info: UpdateInfo) => void = () => undefined
let beforeInstall: () => void = () => undefined
let current: UpdateInfo | null = null
let wired = false
// The renderer persists the snooze in settings; this keeps it for the current run.
let sessionSnooze = 0

const canSelfUpdate = (): boolean => app.isPackaged || Boolean(process.env.MEOWPLAYER_UPDATE_FEED)

function settingsOf(): Record<string, unknown> {
  return (getState().settings ?? {}) as Record<string, unknown>
}

function publish(patch: Partial<UpdateInfo>): void {
  if (!current) return
  current = { ...current, ...patch }
  send(current)
}

const notesText = (notes: unknown): string => {
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) return notes.map((entry) => String(entry?.note ?? '')).join('\n\n')
  return ''
}

const errorText = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err)
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|net::/i.test(message)) return 'Could not reach GitHub. Check your connection and try again.'
  if (/sha512|checksum/i.test(message)) return 'The download did not match the release and was discarded. Try again.'
  return message.split('\n')[0].slice(0, 200)
}

/** Connects electron-updater to the renderer once. */
export function initUpdater(notify: (info: UpdateInfo) => void, onBeforeInstall: () => void): void {
  send = notify
  beforeInstall = onBeforeInstall
  if (wired || !canSelfUpdate()) return
  wired = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.logger = null
  // For testing against a local server: MEOWPLAYER_UPDATE_FEED=http://localhost:8080/
  if (process.env.MEOWPLAYER_UPDATE_FEED) {
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.setFeedURL({ provider: 'generic', url: process.env.MEOWPLAYER_UPDATE_FEED })
  }

  autoUpdater.on('download-progress', (progress) => {
    publish({
      status: 'downloading',
      progress: {
        percent: Math.max(0, Math.min(100, progress.percent)),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      },
    })
  })
  autoUpdater.on('update-downloaded', () => publish({ status: 'downloaded', progress: null, error: null }))
  autoUpdater.on('error', (err) => {
    if (current?.status === 'downloading') publish({ status: 'error', error: errorText(err), progress: null })
  })
}

/** The GitHub API check, used by development builds that cannot self-update. */
async function checkGitHub(): Promise<UpdateInfo | null> {
  const response = await net.fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MeowPlayer' } })
  if (!response.ok) return null
  const data = (await response.json()) as Record<string, unknown>
  if (data.draft || data.prerelease) return null
  const version = String(data.tag_name ?? '').replace(/^v\.?/i, '')
  if (!version) return null
  return {
    current: app.getVersion(),
    version,
    available: isNewer(version, app.getVersion()),
    notes: String(data.body ?? '').slice(0, 4000),
    pageUrl: typeof data.html_url === 'string' ? data.html_url : RELEASES,
    assetUrl: null,
    status: 'available',
    progress: null,
    error: null,
    canSelfUpdate: false,
  }
}

/** Checks for a newer release. `force` skips the auto-check and snooze gates. */
export async function check(force = false): Promise<UpdateInfo | null> {
  const settings = settingsOf()
  if (!force) {
    if (settings.updateCheck === false) return null
    const saved = typeof settings.updateSnoozedUntil === 'number' ? settings.updateSnoozedUntil : 0
    if (Math.max(sessionSnooze, saved) > Date.now()) return null
  }
  // A download in progress or ready to install is the answer to any check.
  if (current && (current.status === 'downloading' || current.status === 'downloaded')) return current

  try {
    if (!canSelfUpdate()) {
      current = await checkGitHub()
      return current
    }
    const result = await autoUpdater.checkForUpdates()
    if (!result) return null
    const info = result.updateInfo
    current = {
      current: app.getVersion(),
      version: info.version,
      available: result.isUpdateAvailable,
      notes: notesText(info.releaseNotes).slice(0, 4000),
      pageUrl: `https://github.com/${REPO}/releases/tag/v${info.version}`,
      assetUrl: null,
      status: 'available',
      progress: null,
      error: null,
      canSelfUpdate: true,
    }
    return current
  } catch (err) {
    console.warn('[update] check failed', err)
    // Never report "up to date" when GitHub could not be asked (offline, or a release still being built).
    throw new Error('check failed', { cause: err })
  }
}

/** Starts downloading the update found by the last check. */
export async function download(): Promise<{ ok: boolean; error?: string }> {
  if (!current?.available) return { ok: false, error: 'Check for updates first' }
  if (!current.canSelfUpdate) {
    openReleasePage(current.pageUrl)
    return { ok: false, error: 'Opened the release page in your browser' }
  }
  if (current.status === 'downloading' || current.status === 'downloaded') return { ok: true }
  publish({ status: 'downloading', progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }, error: null })
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    const error = errorText(err)
    publish({ status: 'error', error, progress: null })
    return { ok: false, error }
  }
}

/**
 * Restarts into the downloaded update. Windows asks for permission, since
 * MeowPlayer is installed in Program Files; the app reopens afterwards.
 */
export function install(): { ok: boolean; error?: string } {
  if (current?.status !== 'downloaded') return { ok: false, error: 'The update has not finished downloading' }
  beforeInstall()
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
  return { ok: true }
}

/** Hidden for the next `days` days; returns the timestamp for the renderer to save. */
export function snooze(days: number): number {
  sessionSnooze = Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000
  return sessionSnooze
}

export function openReleasePage(url?: string): void {
  void shell.openExternal(url?.startsWith('https://github.com/') ? url : RELEASES)
}
