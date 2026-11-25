/*
 * Spotify playlist import. Spotify does not let other apps play its music, but
 * a playlist exported as CSV (Exportify, TuneMyMusic, Soundiiz and others all
 * write one) can be rebuilt from the songs already in the local library.
 */
import type { Track } from './types'

export interface PlaylistRow {
  title: string
  artist: string
  album: string
}

/** Splits CSV text into rows, honouring quoted fields with commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(field)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  row.push(field)
  if (row.some((cell) => cell.trim())) rows.push(row)
  return rows
}

const column = (header: string[], ...names: RegExp[]): number =>
  header.findIndex((cell) => names.some((name) => name.test(cell.trim())))

/**
 * Reads a playlist export: a CSV with title and artist columns (any of the
 * common exporters), or plain text with one "Artist - Title" per line.
 */
export function parsePlaylistExport(text: string): PlaylistRow[] {
  const rows = parseCsv(text)
  const header = rows[0] ?? []
  const titleCol = column(header, /^track ?name$/i, /^title$/i, /^song( name)?$/i, /^name$/i, /^track$/i)
  const artistCol = column(header, /^artist ?name\(?s?\)?$/i, /^artists?$/i, /^artist names?$/i)
  const albumCol = column(header, /^album( name)?$/i)

  if (titleCol >= 0 && artistCol >= 0) {
    return rows
      .slice(1)
      .map((cells) => ({
        title: (cells[titleCol] ?? '').trim(),
        // Exportify joins several artists with commas (older versions with semicolons).
        artist: (cells[artistCol] ?? '').split(/[;,]/)[0].trim(),
        album: albumCol >= 0 ? (cells[albumCol] ?? '').trim() : '',
      }))
      .filter((row) => row.title)
  }

  // Plain text: "Artist - Title" per line.
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [artist, ...rest] = line.split(/\s+[-–—]\s+/)
      return rest.length ? { artist: artist.trim(), title: rest.join(' - ').trim(), album: '' } : { artist: '', title: line, album: '' }
    })
}

/** Lower-case letters and digits only, without accents, brackets or "feat." parts. */
export function looseKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+-\s+(.*remaster.*|.*version|live.*|mono|stereo|radio edit|single.*)$/i, '')
    .replace(/\(.*?\)|\[.*?\]|\b(feat|ft)\..*$/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/** Finds each row's song in the library. Returns the matched ids in playlist order and the rows not found. */
export function matchPlaylist(rows: PlaylistRow[], tracks: Track[]): { ids: string[]; missing: PlaylistRow[] } {
  const byTitle = new Map<string, Track[]>()
  for (const track of tracks) {
    const key = looseKey(track.title)
    if (!key) continue
    const list = byTitle.get(key)
    if (list) list.push(track)
    else byTitle.set(key, [track])
  }

  const ids: string[] = []
  const missing: PlaylistRow[] = []
  for (const row of rows) {
    const candidates = byTitle.get(looseKey(row.title)) ?? []
    const artist = looseKey(row.artist)
    const album = looseKey(row.album)
    const sameArtist = candidates.filter((track) => {
      if (!artist) return true
      const found = looseKey(track.artist) + looseKey(track.albumArtist)
      return found.includes(artist) || (looseKey(track.artist) !== '' && artist.includes(looseKey(track.artist)))
    })
    const pick = sameArtist.find((track) => album && looseKey(track.album) === album) ?? sameArtist[0]
    if (pick) ids.push(pick.id)
    else missing.push(row)
  }
  return { ids: [...new Set(ids)], missing }
}
