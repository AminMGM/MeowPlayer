import { app, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseFile } from 'music-metadata'

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
  addedAt: number
}

export function toMediaUrl(filePath: string): string {
  return `mp-media://local/${encodeURIComponent(filePath)}`
}

export function isAudioFile(filePath: string): boolean {
  return AUDIO_EXT.has(path.extname(filePath).toLowerCase())
}

function hash(value: string, algo: 'sha1' | 'md5' = 'sha1'): string {
  return crypto.createHash(algo).update(value).digest('hex')
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
    if (entry.isDirectory()) {
      await walk(full, out, depth + 1)
    } else if (entry.isFile() && AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full)
    }
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

async function resolveCover(
  albumKey: string,
  albumDir: string,
  picture: { data: Uint8Array; format: string } | undefined,
): Promise<string | null> {
  const key = hash(albumKey, 'md5')
  if (picture && picture.data && picture.data.length > 0) {
    const ext = picture.format.includes('png') ? '.png' : picture.format.includes('webp') ? '.webp' : '.jpg'
    const target = path.join(coversDir(), key + ext)
    if (!(await exists(target))) {
      try {
        await fsp.writeFile(target, Buffer.from(picture.data))
      } catch {
        const art = await findFolderArt(albumDir)
        return art ? toMediaUrl(art) : null
      }
    }
    return toMediaUrl(target)
  }
  const art = await findFolderArt(albumDir)
  return art ? toMediaUrl(art) : null
}

export async function readTrack(filePath: string, dir: string): Promise<Track | null> {
  let md: Awaited<ReturnType<typeof parseFile>>
  try {
    md = await parseFile(filePath, { duration: true, skipCovers: false })
  } catch {
    try {
      const stat = await fsp.stat(filePath)
      return {
        id: hash(filePath),
        path: filePath,
        url: toMediaUrl(filePath),
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
        cover: null,
        size: stat.size,
        addedAt: Date.now(),
      }
    } catch {
      return null
    }
  }

  const common = md.common
  const stat = await fsp.stat(filePath)
  const artist = common.artist || common.albumartist || (common.artists && common.artists[0]) || 'Unknown Artist'
  const albumArtist = common.albumartist || artist
  const album = common.album || 'Unknown Album'
  const cover = await resolveCover(`${albumArtist}|${album}`, dir, common.picture?.[0])

  return {
    id: hash(filePath),
    path: filePath,
    url: toMediaUrl(filePath),
    title: common.title || path.basename(filePath, path.extname(filePath)),
    artist,
    albumArtist,
    album,
    genre: Array.isArray(common.genre) ? common.genre[0] ?? '' : common.genre ?? '',
    year: common.year ?? null,
    duration: md.format.duration ?? 0,
    bitrate: Math.round((md.format.bitrate ?? 0) / 1000),
    sampleRate: md.format.sampleRate ?? 0,
    trackNo: common.track?.no ?? null,
    discNo: common.disk?.no ?? null,
    cover,
    size: stat.size,
    addedAt: Date.now(),
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

export async function scanFolders(
  folders: string[],
  onProgress: (done: number, total: number) => void,
): Promise<Track[]> {
  const files = await collectFiles(folders)
  folderArtCache.clear()
  const total = files.length
  let done = 0

  const parsed = await mapPool(files, 8, async (file) => {
    const track = await readTrack(file, path.dirname(file)).catch(() => null)
    done += 1
    if (done % 10 === 0 || done === total) onProgress(done, total)
    return track
  })

  onProgress(done, total)
  return parsed.filter((track): track is Track => Boolean(track))
}

/** Scans arbitrary dropped paths — files and/or folders. */
export async function scanPaths(paths: string[]): Promise<Track[]> {
  const files: string[] = []
  for (const target of paths) {
    try {
      const stat = await fsp.stat(target)
      if (stat.isDirectory()) await walk(target, files)
      else if (stat.isFile() && isAudioFile(target)) files.push(target)
    } catch {
      if (isAudioFile(target)) files.push(target)
    }
  }
  const parsed = await mapPool(files, 6, (file) => readTrack(file, path.dirname(file)).catch(() => null))
  return parsed.filter((track): track is Track => Boolean(track))
}

export async function probeFile(filePath: string): Promise<Track | null> {
  try {
    return await readTrack(filePath, path.dirname(filePath))
  } catch {
    return null
  }
}

export async function pickFolders(win: BrowserWindow | null): Promise<string[]> {
  const result = await dialog.showOpenDialog(win ?? undefined as unknown as BrowserWindow, {
    title: 'Choose music folders',
    properties: ['openDirectory', 'multiSelections'],
    buttonLabel: 'Add folders',
  })
  return result.canceled ? [] : result.filePaths
}

export async function importM3u(win: BrowserWindow | null): Promise<{ name: string; paths: string[] } | null> {
  const result = await dialog.showOpenDialog(win ?? undefined as unknown as BrowserWindow, {
    title: 'Import playlist',
    filters: [{ name: 'Playlists', extensions: ['m3u', 'm3u8'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const file = result.filePaths[0]
  const raw = await fsp.readFile(file, 'utf8')
  const baseDir = path.dirname(file)
  const paths = raw
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
  const result = await dialog.showSaveDialog(win ?? undefined as unknown as BrowserWindow, {
    title: 'Export playlist',
    defaultPath: `${name.replace(/[\\/:*?"<>|]/g, '')}.m3u8`,
    filters: [{ name: 'M3U playlist', extensions: ['m3u8'] }],
  })
  if (result.canceled || !result.filePath) return false
  const lines = ['#EXTM3U']
  for (const entry of entries) {
    lines.push(`#EXTINF:${Math.round(entry.duration)},${entry.artist} - ${entry.title}`)
    lines.push(entry.path)
  }
  await fsp.writeFile(result.filePath, lines.join('\n'), 'utf8')
  return true
}
