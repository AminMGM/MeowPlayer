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

export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? word : many}`
}

export function albumKey(track: Pick<Track, 'albumArtist' | 'album'>): string {
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

/** True when a track belongs to an artist, either as performer or as album artist. */
export function isByArtist(track: Track, artist: string): boolean {
  return track.artist === artist || track.albumArtist === artist
}

export function groupArtists(tracks: Track[]): { name: string; tracks: Track[]; albums: number }[] {
  const map = new Map<string, Track[]>()
  for (const track of tracks) {
    const list = map.get(track.artist)
    if (list) list.push(track)
    else map.set(track.artist, [track])
  }
  return [...map.entries()]
    .map(([name, list]) => ({ name, tracks: list, albums: new Set(list.map((t) => albumKey(t))).size }))
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

const trimSeparators = (value: string): string => value.replace(/[\\/]+$/, '')

/** True when `child` is `folder` itself or sits somewhere inside it. */
export function isInFolder(child: string, folder: string): boolean {
  const base = trimSeparators(folder).toLowerCase()
  const target = child.toLowerCase()
  if (!base) return false
  return target === base || target.startsWith(`${base}\\`) || target.startsWith(`${base}/`)
}

export function folderRoot(track: Track, folders: string[]): string {
  const match = folders.filter((folder) => isInFolder(track.path, folder)).sort((a, b) => b.length - a.length)[0]
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

/* -------------------------------- colour -------------------------------- */

const accentCache = new Map<string, string | null>()

/**
 * Pulls a representative accent colour out of cover artwork, biased toward
 * saturated, mid-bright pixels so the result reads well on the dark shell.
 */
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
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
    if (!total) {
      accentCache.set(src, null)
      return null
    }
    const color = softenColor(r / total, g / total, b / total)
    accentCache.set(src, color)
    return color
  } catch {
    // Unreadable artwork is remembered so it is not decoded on every change.
    accentCache.set(src, null)
    return null
  }
}

/**
 * Turns a cover colour into a calm accent: the hue is kept, but saturation is
 * capped and lightness pinned to a soft pastel range, so album theming tints
 * the interface instead of flooding it.
 */
export function softenColor(r: number, g: number, b: number): string {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let hue = 0
  if (delta > 0) {
    if (max === rn) hue = ((gn - bn) / delta) % 6
    else if (max === gn) hue = (bn - rn) / delta + 2
    else hue = (rn - gn) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  const lightness = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))

  const s = Math.min(saturation, 0.42)
  const l = Math.min(0.74, Math.max(0.64, lightness))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x]
  const hex = (value: number): string =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(r1)}${hex(g1)}${hex(b1)}`
}

/** Writes the accent colour; the soft and strong variants are derived in CSS. */
export function applyAccent(hex: string): void {
  document.documentElement.style.setProperty('--accent', hex)
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return `rgba(163, 183, 201, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* -------------------------------- search -------------------------------- */

export function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
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

/* -------------------------------- lyrics -------------------------------- */

/**
 * Parses an LRC file into time-stamped lines. A timestamp with no text marks
 * an instrumental gap and is kept as an empty line, so the previous lyric does
 * not stay highlighted through a solo.
 */
export function parseLrc(raw: string): LyricsLine[] {
  const lines: LyricsLine[] = []
  for (const line of raw.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) continue
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    for (const stamp of stamps) {
      const minutes = Number(stamp[1])
      const seconds = Number(stamp[2])
      const fraction = stamp[3] ? Number(`0.${stamp[3]}`) : 0
      lines.push({ time: minutes * 60 + seconds + fraction, text })
    }
  }
  lines.sort((a, b) => a.time - b.time)
  // Drop leading gaps and collapse runs of gaps into one.
  return lines.filter((line, index) => line.text || (index > 0 && lines[index - 1].text))
}

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR_CHAR = /[A-Za-zÀ-ɏЀ-ӿ]/

/** True when text is written right to left (Persian, Arabic, Hebrew, Urdu…). */
export function isRtl(text: string): boolean {
  const rtl = text.match(new RegExp(RTL_CHAR, 'g'))?.length ?? 0
  const ltr = text.match(new RegExp(LTR_CHAR, 'g'))?.length ?? 0
  return rtl > 0 && rtl >= ltr
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

/** How far through the active line playback is, from 0 to 1. */
export function lyricProgress(lines: LyricsLine[], index: number, time: number): number {
  const line = lines[index]
  if (!line) return 0
  const next = lines[index + 1]
  const end = next ? next.time : line.time + 5
  const span = Math.max(0.2, end - line.time)
  return Math.max(0, Math.min(1, (time - line.time) / span))
}

export function dayKey(at: number = Date.now()): string {
  const date = new Date(at)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
