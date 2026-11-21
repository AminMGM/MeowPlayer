import { app, net, shell } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getState } from './store.js'
import { isNewer } from './version.js'

const REPO = 'AminMGM/MeowPlayer'
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES = `https://github.com/${REPO}/releases/latest`

export interface UpdateInfo {
  current: string
  version: string
  available: boolean
  notes: string
  pageUrl: string
  assetUrl: string | null
}

interface ReleaseAsset {
  name?: string
  browser_download_url?: string
  digest?: string | null
}

/**
 * The last release this process fetched from GitHub. Installs only ever use
 * this copy, never anything the renderer sends back, so the renderer cannot
 * make the main process download and run an arbitrary executable.
 */
let latest: { info: UpdateInfo; sha256: string | null } | null = null

function settingsOf(): Record<string, unknown> {
  return (getState().settings ?? {}) as Record<string, unknown>
}

// The renderer persists the snooze in settings; this keeps it honest for the
// current run even before that write lands.
let sessionSnooze = 0

const isGitHubUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'github.com' || url.hostname.endsWith('.githubusercontent.com'))
  } catch {
    return false
  }
}

/** Checks GitHub for a newer release. `force` skips the auto-check and snooze gates. */
export async function check(force = false): Promise<UpdateInfo | null> {
  const settings = settingsOf()
  if (!force) {
    if (settings.updateCheck === false) return null
    const saved = typeof settings.updateSnoozedUntil === 'number' ? settings.updateSnoozedUntil : 0
    if (Math.max(sessionSnooze, saved) > Date.now()) return null
  }

  try {
    const response = await net.fetch(API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MeowPlayer' },
    })
    if (!response.ok) {
      console.warn('[update] GitHub answered', response.status)
      return null
    }
    const data = (await response.json()) as Record<string, unknown>
    if (data.draft || data.prerelease) return null
    const version = String(data.tag_name ?? data.name ?? '').replace(/^v\.?/i, '')
    if (!version) return null

    const assets = (Array.isArray(data.assets) ? data.assets : []) as ReleaseAsset[]
    const installer = assets.find((asset) => /\.exe$/i.test(String(asset?.name ?? '')))
    const assetUrl = installer?.browser_download_url && isGitHubUrl(installer.browser_download_url)
      ? installer.browser_download_url
      : null
    const digest = typeof installer?.digest === 'string' && installer.digest.startsWith('sha256:')
      ? installer.digest.slice('sha256:'.length).toLowerCase()
      : null

    const info: UpdateInfo = {
      current: app.getVersion(),
      version,
      available: isNewer(version, app.getVersion()),
      notes: String(data.body ?? '').slice(0, 4000),
      pageUrl: typeof data.html_url === 'string' && isGitHubUrl(data.html_url) ? data.html_url : RELEASES,
      assetUrl,
    }
    latest = { info, sha256: digest }
    return info
  } catch (err) {
    console.warn('[update] check failed', err)
    return null
  }
}

/**
 * Hidden for the next `days` days. Returns the timestamp so the renderer can
 * persist it with the rest of the settings.
 */
export function snooze(days: number): number {
  sessionSnooze = Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000
  return sessionSnooze
}

export function openReleasePage(url?: string): void {
  void shell.openExternal(url && isGitHubUrl(url) ? url : RELEASES)
}

/**
 * Downloads the installer from the release found by the last check, verifies
 * its SHA-256 against the digest GitHub publishes, opens it (Windows asks for
 * permission, since MeowPlayer installs into Program Files) and quits so the
 * installer can replace the running files.
 */
export async function install(): Promise<{ ok: boolean; file?: string; error?: string }> {
  const release = latest
  if (!release?.info.available) return { ok: false, error: 'Check for updates first' }
  if (!release.info.assetUrl) {
    openReleasePage(release.info.pageUrl)
    return { ok: false, error: 'Opened the release page in your browser' }
  }

  try {
    const response = await net.fetch(release.info.assetUrl, { headers: { 'User-Agent': 'MeowPlayer' } })
    if (!response.ok) return { ok: false, error: `Download failed (HTTP ${response.status})` }
    const buffer = Buffer.from(await response.arrayBuffer())

    if (release.sha256) {
      const actual = crypto.createHash('sha256').update(buffer).digest('hex')
      if (actual !== release.sha256) return { ok: false, error: 'The download was corrupted, please try again' }
    }

    const safeVersion = release.info.version.replace(/[^0-9a-z.-]/gi, '')
    const file = path.join(app.getPath('temp'), `MeowPlayer-Setup-${safeVersion}.exe`)
    await fs.promises.writeFile(file, buffer)
    const error = await shell.openPath(file)
    if (error) return { ok: false, error }
    setTimeout(() => app.quit(), 800)
    return { ok: true, file }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Download failed' }
  }
}
