import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface LyricsResult {
  synced: string | null
  plain: string | null
  source: string
}

interface LrclibEntry {
  artistName?: string
  trackName?: string
  duration?: number
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

const UA = 'MeowPlayer (https://github.com/AminMGM/MeowPlayer)'
const TIMEOUT_MS = 10_000

function cacheFile(title: string, artist: string, album: string): string {
  const key = crypto.createHash('md5').update(`${artist}|${title}|${album}`.toLowerCase()).digest('hex')
  return path.join(app.getPath('userData'), 'lyrics', `${key}.json`)
}

function readCache(file: string): LyricsResult | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (raw && (raw.synced || raw.plain)) return raw as LyricsResult
  } catch {
    /* no cache */
  }
  return null
}

function writeCache(file: string, value: LyricsResult): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(value))
  } catch {
    /* the cache is best effort */
  }
}

async function requestJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) return null
  return res.json()
}

const simplify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$/g, '')
    .replace(/[^a-z0-9]+/g, '')

/**
 * A search hit only counts when the artist matches and, if both sides know it,
 * the length is within a few seconds. Without that check the first random
 * result used to be cached as the lyrics of an unrelated song.
 */
function isMatch(entry: LrclibEntry, artist: string, duration: number | undefined): boolean {
  if (!entry.syncedLyrics && !entry.plainLyrics) return false
  const wanted = simplify(artist)
  const found = simplify(entry.artistName ?? '')
  if (wanted && found && !found.includes(wanted) && !wanted.includes(found)) return false
  if (duration && duration > 1 && entry.duration && Math.abs(entry.duration - duration) > 4) return false
  return true
}

const toResult = (entry: LrclibEntry): LyricsResult => ({
  synced: entry.syncedLyrics ?? null,
  plain: entry.plainLyrics ?? null,
  source: 'lrclib',
})

/** Lyrics from LRCLIB (https://lrclib.net): free, no API key, community database. */
export async function getLyrics(query: {
  title: string
  artist: string
  album?: string
  duration?: number
}): Promise<LyricsResult | null> {
  const title = String(query.title ?? '').trim()
  const artist = String(query.artist ?? '').trim()
  if (!title) return null

  const cache = cacheFile(title, artist, query.album ?? '')
  const cached = readCache(cache)
  if (cached) return cached

  const params = new URLSearchParams({ track_name: title, artist_name: artist })
  if (query.album) params.set('album_name', query.album)
  if (query.duration && query.duration > 1) params.set('duration', String(Math.round(query.duration)))

  try {
    const exact = (await requestJson(`https://lrclib.net/api/get?${params.toString()}`)) as LrclibEntry | null
    if (exact && (exact.syncedLyrics || exact.plainLyrics)) {
      const result = toResult(exact)
      writeCache(cache, result)
      return result
    }
  } catch {
    /* fall through to search */
  }

  try {
    const search = new URLSearchParams({ track_name: title, artist_name: artist })
    const results = (await requestJson(`https://lrclib.net/api/search?${search.toString()}`)) as LrclibEntry[] | null
    if (Array.isArray(results)) {
      const candidates = results.filter((entry) => isMatch(entry, artist, query.duration))
      const best = candidates.find((entry) => entry.syncedLyrics) ?? candidates[0]
      if (best) {
        const result = toResult(best)
        writeCache(cache, result)
        return result
      }
    }
  } catch {
    /* offline or timed out */
  }

  return null
}
