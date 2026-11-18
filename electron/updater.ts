import { app, net, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { getState } from './store.js'

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

const parts = (value: string): number[] =>
  value
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((piece) => parseInt(piece, 10) || 0)

function isNewer(candidate: string, current: string): boolean {
  const a = parts(candidate)
  const b = parts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

function settingsOf(): Record<string, any> {
  return ((getState() as Record<string, any>)?.settings ?? {}) as Record<string, any>
}

// The renderer persists the snooze in settings; this keeps it honest for the
// current run even before that write lands.
let sessionSnooze = 0

/** Checks GitHub for a newer release. `force` skips the auto-check and snooze gates. */
export async function check(force = false): Promise<UpdateInfo | null> {
  const settings = settingsOf()
  if (!force) {
    if (settings.updateCheck === false) return null
    const snoozedUntil = Math.max(
      sessionSnooze,
      typeof settings.updateSnoozedUntil === 'number' ? settings.updateSnoozedUntil : 0,
    )
    if (snoozedUntil > Date.now()) return null
  }

  try {
    const response = await net.fetch(API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MeowPlayer' },
    })
    if (!response.ok) {
      console.warn('[update] GitHub answered', response.status)
      return null
    }
    const data = (await response.json()) as Record<string, any>
    const version = String(data.tag_name ?? data.name ?? '').replace(/^v/i, '')
    if (!version) return null

    const assets = Array.isArray(data.assets) ? data.assets : []
    const installer = assets.find((asset: any) => /\.exe$/i.test(String(asset?.name ?? ''))) as
      | { browser_download_url?: string }
      | undefined

    return {
      current: app.getVersion(),
      version,
      available: isNewer(version, app.getVersion()),
      notes: String(data.body ?? '').slice(0, 4000),
      pageUrl: String(data.html_url ?? RELEASES),
      assetUrl: installer?.browser_download_url ?? null,
    }
  } catch (err) {
    console.warn('[update] check failed', err)
    return null
  }
}

/**
 * Hidden for the next `days` days. Returns the timestamp so the renderer can
 * persist it with the rest of settings instead of writing the file twice.
 */
export function snooze(days: number): number {
  sessionSnooze = Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000
  return sessionSnooze
}

export function openReleasePage(url?: string): void {
  void shell.openExternal(url && /^https?:/i.test(url) ? url : RELEASES)
}

/**
 * Downloads the installer next to the app and starts it, then quits so the
 * installer is free to replace the running binary.
 */
export async function install(info: UpdateInfo): Promise<{ ok: boolean; file?: string; error?: string }> {
  const url = info.assetUrl ?? info.pageUrl
  if (!/\.exe($|\?)/i.test(url)) {
    openReleasePage(info.pageUrl)
    return { ok: false, error: 'Opened the release page in your browser' }
  }

  try {
    const response = await net.fetch(url, { headers: { 'User-Agent': 'MeowPlayer' } })
    if (!response.ok) return { ok: false, error: `Download failed (HTTP ${response.status})` }
    const buffer = Buffer.from(await response.arrayBuffer())
    const file = path.join(app.getPath('temp'), `MeowPlayer-Setup-${info.version}.exe`)
    await fs.promises.writeFile(file, buffer)
    const child = spawn(file, [], { detached: true, stdio: 'ignore' })
    child.unref()
    setTimeout(() => app.quit(), 800)
    return { ok: true, file }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Download failed' }
  }
}
