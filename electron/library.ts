import { app, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseFile } from 'music-metadata'
import { File as TagFile } from 'node-taglib-sharp'
import { grantDirectory, grantFile } from './media.js'

const AUDIO_EXT = new Set([
  '.mp3', '.m4a', '.m4b', '.aac', '.flac', '.wav', '.ogg', '.oga', '.opus',
  '.wma', '.aif', '.aiff', '.alac', '.mp4', '.webm',
])
const FOLDER_ART = ['cover.jpg', 'folder.jpg', 'front.jpg', 'album.jpg', 'artwork.jpg', 'cover.png', 'folder.png']

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
  /** File modification time, used to skip unchanged files on a rescan. */
  mtime: number
  /** ReplayGain track and album gain in dB, when the file is tagged. */
  trackGain: number | null
  albumGain: number | null
  addedAt: number
}

export interface TagEdit {
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  genre?: string
  year?: number | null
}

export function toMediaUrl(filePath: string): string {
  return `mp-media://local/${encodeURIComponent(filePath)}`
}

export function isAudioFile(filePath: string): boolean {
  return AUDIO_EXT.has(path.extname(filePath).toLowerCase())
}

function hash(value: string | Uint8Array, algo: 'sha1' | 'md5' = 'sha1'): string {
  return crypto.createHash(algo).update(value).digest('hex')
}

/** Track ids are the hash of the path, stable across rescans and app versions. */
function trackId(filePath: string): string {
  return hash(filePath)
}

function coversDir(): string {
  const dir = path.join(app.getPath('userData'), 'covers')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

async function walk(dir: string, out: string[], depth = 0): Promise<void> {
  if (depth > 12) return
  let entries: fs.Dirent[]
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'System Volume Information' || entry.name === '$RECYCLE.BIN') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, out, depth + 1)
    else if (entry.isFile() && isAudioFile(entry.name)) out.push(full)
  }
}

const folderArtCache = new Map<string, string | null>()

async function findFolderArt(dir: string): Promise<string | null> {
  if (folderArtCache.has(dir)) return folderArtCache.get(dir) ?? null
  let found: string | null = null
  for (const name of FOLDER_ART) {
    const candidate = path.join(dir, name)
    if (await exists(candidate)) {
      found = candidate
      break
    }
  }
  folderArtCache.set(dir, found)
  return found
}

/**
 * Embedded artwork is cached once per distinct image (keyed by its bytes), so
 * untagged tracks that happen to share "Unknown Album" no longer share a cover.
 */
async function resolveCover(
  albumDir: string,
  picture: { data: Uint8Array; format: string } | undefined,
): Promise<string | null> {
  if (picture?.data && picture.data.length > 0) {
    const ext = picture.format.includes('png') ? '.png' : picture.format.includes('webp') ? '.webp' : '.jpg'
    const target = path.join(coversDir(), hash(picture.data, 'md5') + ext)
    try {
      if (!(await exists(target))) await fsp.writeFile(target, Buffer.from(picture.data))
      return toMediaUrl(target)
    } catch {
      /* fall back to folder art */
    }
  }
  const art = await findFolderArt(albumDir)
  if (!art) return null
  grantFile(art)
  return toMediaUrl(art)
}

const gainOf = (value: { dB?: number } | undefined): number | null =>
  value && typeof value.dB === 'number' && Number.isFinite(value.dB) ? value.dB : null

export async function readTrack(filePath: string): Promise<Track | null> {
  let stat: fs.Stats
  try {
    stat = await fsp.stat(filePath)
  } catch {
    return null
  }
  const dir = path.dirname(filePath)
  const base = {
    id: trackId(filePath),
    path: filePath,
    url: toMediaUrl(filePath),
    size: stat.size,
    mtime: Math.round(stat.mtimeMs),
    addedAt: Date.now(),
  }

  let md: Awaited<ReturnType<typeof parseFile>>
  try {
    md = await parseFile(filePath, { duration: true, skipCovers: false })
  } catch {
    return {
      ...base,
      title: path.basename(filePath, path.extname(filePath)),
      artist: 'Unknown Artist',
      albumArtist: 'Unknown Artist',
      album: 'Unknown Album',
      genre: '',
      year: null,
      duration: 0,
      bitrate: 0,
      sampleRate: 0,
      trackNo: null,
      discNo: null,
      cover: await resolveCover(dir, undefined),
      trackGain: null,
      albumGain: null,
    }
  }

  const common = md.common
  const artist = common.artist || common.albumartist || common.artists?.[0] || 'Unknown Artist'
  return {
    ...base,
    title: common.title || path.basename(filePath, path.extname(filePath)),
    artist,
    albumArtist: common.albumartist || artist,
    album: common.album || 'Unknown Album',
    genre: Array.isArray(common.genre) ? common.genre[0] ?? '' : '',
    year: common.year ?? null,
    duration: md.format.duration ?? 0,
    bitrate: Math.round((md.format.bitrate ?? 0) / 1000),
    sampleRate: md.format.sampleRate ?? 0,
    trackNo: common.track?.no ?? null,
    discNo: common.disk?.no ?? null,
    cover: await resolveCover(dir, common.picture?.[0]),
    trackGain: gainOf(common.replaygain_track_gain),
    albumGain: gainOf(common.replaygain_album_gain),
  }
}

async function collectFiles(folders: string[]): Promise<string[]> {
  const files: string[] = []
  for (const folder of folders) {
    if (folder && (await exists(folder))) await walk(folder, files)
  }
  return files
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, worker))
  return results
}

export interface ScanResult {
  /** New or changed files, fully read. */
  tracks: Track[]
  /** Paths whose file is unchanged since the renderer last saw it. */
  kept: string[]
}

let scanInFlight: Promise<ScanResult> | null = null

/**
 * Walks the library folders. Files whose modification time matches `known`
 * are reported as kept instead of being parsed again, so a rescan of a large,
 * mostly unchanged library takes seconds instead of minutes.
 */
export function scanFolders(
  folders: string[],
  known: Record<string, number>,
  onProgress: (done: number, total: number) => void,
): Promise<ScanResult> {
  // A second request while one is running joins the running scan.
  if (scanInFlight) return scanInFlight
  scanInFlight = (async () => {
    const files = await collectFiles(folders)
    folderArtCache.clear()
    const total = files.length
    let done = 0
    const kept: string[] = []

    const parsed = await mapPool(files, 8, async (file) => {
      let track: Track | null = null
      try {
        const mtime = known[file]
        if (mtime !== undefined) {
          const stat = await fsp.stat(file)
          if (Math.round(stat.mtimeMs) === mtime) kept.push(file)
          else track = await readTrack(file)
        } else {
          track = await readTrack(file)
        }
      } catch {
        track = null
      }
      done += 1
      if (done % 25 === 0 || done === total) onProgress(done, total)
      return track
    })

    onProgress(done, total)
    return { tracks: parsed.filter((track): track is Track => Boolean(track)), kept }
  })().finally(() => {
    scanInFlight = null
  })
  return scanInFlight
}

/** Reads dropped paths (files and/or folders) and grants them to the media protocol. */
export async function scanPaths(paths: string[]): Promise<Track[]> {
  const files: string[] = []
  for (const target of paths) {
    try {
      const stat = await fsp.stat(target)
      if (stat.isDirectory()) {
        grantDirectory(target)
        await walk(target, files)
      } else if (stat.isFile() && isAudioFile(target)) {
        grantFile(target)
        files.push(target)
      }
    } catch {
      /* unreadable path */
    }
  }
  const parsed = await mapPool(files, 6, (file) => readTrack(file).catch(() => null))
  return parsed.filter((track): track is Track => Boolean(track))
}

export async function probeFile(filePath: string): Promise<Track | null> {
  if (!isAudioFile(filePath)) return null
  grantFile(filePath)
  try {
    return await readTrack(filePath)
  } catch {
    return null
  }
}

/**
 * Writes edited tags into the audio file itself. Returns the re-read track, or
 * an error message when the file is read-only or the format cannot be tagged.
 */
export async function writeTags(filePath: string, edit: TagEdit): Promise<{ track?: Track; error?: string }> {
  let file: TagFile | null = null
  try {
    file = TagFile.createFromPath(filePath)
    const tag = file.tag
    if (edit.title !== undefined) tag.title = edit.title
    if (edit.artist !== undefined) tag.performers = edit.artist ? [edit.artist] : []
    if (edit.albumArtist !== undefined) tag.albumArtists = edit.albumArtist ? [edit.albumArtist] : []
    if (edit.album !== undefined) tag.album = edit.album
    if (edit.genre !== undefined) tag.genres = edit.genre ? [edit.genre] : []
    if (edit.year !== undefined) tag.year = edit.year && edit.year > 0 ? edit.year : 0
    file.save()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'This file could not be tagged' }
  } finally {
    file?.dispose()
  }
  const track = await readTrack(filePath)
  return track ? { track } : { error: 'The file could not be read back after saving' }
}

/** Deletes cached artwork that no track points at any more. */
export async function pruneCovers(usedUrls: string[]): Promise<number> {
  const dir = coversDir()
  const used = new Set(usedUrls)
  let removed = 0
  for (const name of await fsp.readdir(dir)) {
    const full = path.join(dir, name)
    if (used.has(toMediaUrl(full))) continue
    try {
      await fsp.unlink(full)
      removed += 1
    } catch {
      /* in use or already gone */
    }
  }
  return removed
}

/* ------------------------------- watching ------------------------------- */

let watchers: fs.FSWatcher[] = []
let watchTimer: NodeJS.Timeout | null = null

/**
 * Watches the library folders and calls `onChange` (debounced) when audio files
 * are added, removed or changed, so the library refreshes on its own.
 */
export function watchFolders(folders: string[], onChange: () => void): void {
  for (const watcher of watchers) watcher.close()
  watchers = []
  for (const folder of folders) {
    try {
      const watcher = fs.watch(folder, { recursive: true }, (_event, name) => {
        if (!name || !isAudioFile(String(name))) return
        if (watchTimer) clearTimeout(watchTimer)
        watchTimer = setTimeout(onChange, 2500)
      })
      watcher.on('error', () => watcher.close())
      watchers.push(watcher)
    } catch (err) {
      console.warn('[library] cannot watch', folder, err)
    }
  }
}

/* -------------------------------- dialogs -------------------------------- */

export async function pickFolders(win: BrowserWindow | null): Promise<string[]> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose music folders',
    properties: ['openDirectory', 'multiSelections'],
    buttonLabel: 'Add folders',
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled ? [] : result.filePaths
}

export async function importM3u(win: BrowserWindow | null): Promise<{ name: string; paths: string[] } | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Import playlist',
    filters: [{ name: 'Playlists', extensions: ['m3u', 'm3u8'] }],
    properties: ['openFile'],
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) return null
  const file = result.filePaths[0]
  const raw = await fsp.readFile(file, 'utf8')
  const baseDir = path.dirname(file)
  const paths = raw
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => (path.isAbsolute(line) ? line : path.resolve(baseDir, line)))
  return { name: path.basename(file, path.extname(file)), paths }
}

export async function exportM3u(
  win: BrowserWindow | null,
  name: string,
  entries: { path: string; duration: number; title: string; artist: string }[],
): Promise<boolean> {
  const options: Electron.SaveDialogOptions = {
    title: 'Export playlist',
    defaultPath: `${name.replace(/[\\/:*?"<>|]/g, '')}.m3u8`,
    filters: [{ name: 'M3U playlist', extensions: ['m3u8'] }],
  }
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return false
  const lines = ['#EXTM3U']
  for (const entry of entries) {
    lines.push(`#EXTINF:${Math.round(entry.duration)},${entry.artist} - ${entry.title}`)
    lines.push(entry.path)
  }
  await fsp.writeFile(result.filePath, lines.join('\n'), 'utf8')
  return true
}
