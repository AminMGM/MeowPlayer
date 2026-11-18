import type { AlbumGroup, LyricsLine, Track } from './types'

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

export function formatTime(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatTotalDuration(seconds: number): string {
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.round((total % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  if (m > 0) return `${m} min`
  return `${total} sec`
}

export function albumKey(track: Track): string {
  return `${track.albumArtist}|||${track.album}`
}

export function splitAlbumKey(key: string): { albumArtist: string; album: string } {
  const [albumArtist, album] = key.split('|||')
  return { albumArtist: albumArtist ?? '', album: album ?? '' }
}

export function groupAlbums(tracks: Track[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>()
  for (const track of tracks) {
    const key = albumKey(track)
    const existing = map.get(key)
    if (existing) {
      existing.tracks.push(track)
      existing.duration += track.duration
      if (!existing.cover && track.cover) existing.cover = track.cover
      if (!existing.year && track.year) existing.year = track.year
    } else {
      map.set(key, {
        key,
        album: track.album,
        albumArtist: track.albumArtist,
        year: track.year,
        cover: track.cover,
        tracks: [track],
        duration: track.duration,
      })
    }
  }
  const groups = [...map.values()]
  for (const group of groups) {
    group.tracks.sort((a, b) => (a.discNo ?? 0) - (b.discNo ?? 0) || (a.trackNo ?? 0) - (b.trackNo ?? 0))
  }
  groups.sort((a, b) => a.albumArtist.localeCompare(b.albumArtist) || a.album.localeCompare(b.album))
  return groups
}

export function groupArtists(tracks: Track[]): { name: string; tracks: Track[]; albums: number }[] {
  const map = new Map<string, Track[]>()
  for (const track of tracks) {
    const list = map.get(track.artist)
    if (list) list.push(track)
    else map.set(track.artist, [track])
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      tracks: list,
      albums: new Set(list.map((t) => albumKey(t))).size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function groupGenres(tracks: Track[]): { name: string; tracks: Track[] }[] {
  const map = new Map<string, Track[]>()
  for (const track of tracks) {
    const genre = track.genre?.trim() || 'Unknown genre'
    const list = map.get(genre)
    if (list) list.push(track)
    else map.set(genre, [track])
  }
  return [...map.entries()]
    .map(([name, list]) => ({ name, tracks: list }))
    .sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name))
}

export function folderRoot(track: Track, folders: string[]): string {
  const normalized = track.path.toLowerCase()
  const match = folders
    .filter((folder) => normalized.startsWith(folder.toLowerCase().replace(/[\\/]+$/, '')))
    .sort((a, b) => b.length - a.length)[0]
  if (match) return match
  const parts = track.path.split(/[\\/]/)
  return parts.slice(0, -1).join('\\') || track.path
}

export function groupFolders(tracks: Track[], folders: string[]): { path: string; tracks: Track[] }[] {
  const map = new Map<string, Track[]>()
  for (const track of tracks) {
    const root = folderRoot(track, folders)
    const list = map.get(root)
    if (list) list.push(track)
    else map.set(root, [track])
  }
  return [...map.entries()]
    .map(([folderPath, list]) => ({ path: folderPath, tracks: list }))
    .sort((a, b) => b.tracks.length - a.tracks.length || a.path.localeCompare(b.path))
}

export function folderName(folderPath: string): string {
  const parts = folderPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
}

/**
 * Pulls a representative accent colour out of cover artwork: biased toward
 * saturated, mid-bright pixels so the result works on the dark glass shell.
 */
const accentCache = new Map<string, string | null>()

export async function extractAccent(src: string): Promise<string | null> {
  if (accentCache.has(src)) return accentCache.get(src) ?? null
  try {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = src
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 24
    canvas.height = 24
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, 24, 24)
    const { data } = ctx.getImageData(0, 0, 24, 24)

    let r = 0
    let g = 0
    let b = 0
    let total = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue
      const max = Math.max(data[i], data[i + 1], data[i + 2])
      const min = Math.min(data[i], data[i + 1], data[i + 2])
      if (max < 48) continue
      const saturation = (max - min) / max
      const weight = saturation * saturation * (max / 255) + 0.001
      r += data[i] * weight
      g += data[i + 1] * weight
      b += data[i + 2] * weight
      total += weight
    }
    if (!total) return null

    const toHex = (value: number): string =>
      Math.round(Math.max(28, Math.min(225, value)))
        .toString(16)
        .padStart(2, '0')
    const color = `#${toHex(r / total)}${toHex(g / total)}${toHex(b / total)}`
    accentCache.set(src, color)
    return color
  } catch {
    // Unreadable artwork (a broken file or a tainted canvas) is remembered so
    // the same cover is not decoded again on every track change.
    accentCache.set(src, null)
    return null
  }
}

/** Writes an accent colour and its soft/strong variants to the CSS variables. */
export function applyAccent(hex: string): void {
  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-soft', `${hex}26`)
  root.style.setProperty('--accent-strong', `${hex}4d`)
}

export function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalize(query.trim())
  if (!q) return false
  return fields.some((field) => field && normalize(field).includes(q))
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const PALETTE = ['#8fa3b5', '#7d94a8', '#9aa8b6', '#6f8496', '#a3b3c0', '#8496a6', '#94a4b2', '#78899a']

export function colorFor(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 100000007
  return PALETTE[hash % PALETTE.length]
}

/** Parses an LRC file into time-stamped lines. */
export function parseLrc(raw: string): LyricsLine[] {
  const lines: LyricsLine[] = []
  for (const line of raw.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) continue
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    if (!text) continue
    for (const stamp of stamps) {
      const minutes = Number(stamp[1])
      const seconds = Number(stamp[2])
      const fraction = stamp[3] ? Number(`0.${stamp[3].padEnd(2, '0').slice(0, 2)}`) : 0
      lines.push({ time: minutes * 60 + seconds + fraction, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function activeLyricIndex(lines: LyricsLine[], time: number): number {
  if (!lines.length) return -1
  let index = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].time <= time + 0.15) index = i
    else break
  }
  return index
}
