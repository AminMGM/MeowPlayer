import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface LyricsResult {
  synced: string | null
  plain: string | null
  /** LRCLIB marks tracks without vocals as instrumental. */
  instrumental?: boolean
  source: string
}

interface LrclibEntry {
  artistName?: string
  trackName?: string
  duration?: number
  syncedLyrics?: string | null
  plainLyrics?: string | null
  instrumental?: boolean
}

const UA = 'MeowPlayer (https://github.com/AminMGM/MeowPlayer)'
const TIMEOUT_MS = 10_000

export interface LyricsQuery {
  title: string
  artist: string
  album?: string
  duration?: number
  /** Ask LRCLIB again even if it had nothing for this song recently. */
  force?: boolean
}

/** How long a "no lyrics on LRCLIB" answer is trusted before asking again. */
const MISS_TTL = 30 * 24 * 60 * 60 * 1000

const cacheDir = (): string => path.join(app.getPath('userData'), 'lyrics')

function cacheFile(title: string, artist: string, album: string): string {
  const key = crypto.createHash('md5').update(`${artist}|${title}|${album}`.toLowerCase()).digest('hex')
  return path.join(cacheDir(), `${key}.json`)
}

type Cached = LyricsResult | 'missing' | null

/** Saved lyrics, a recent "not found" ('missing'), or nothing. */
function readCache(file: string): Cached {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (raw?.missing) return Date.now() - Number(raw.at ?? 0) < MISS_TTL ? 'missing' : null
    if (raw && (raw.synced || raw.plain || raw.instrumental)) return raw as LyricsResult
  } catch {
    /* no cache */
  }
  return null
}

const queryFile = (query: LyricsQuery): string =>
  cacheFile(String(query.title ?? '').trim(), String(query.artist ?? '').trim(), query.album ?? '')

/** For each song: true when lyrics (or a recent "not found") are already saved. */
export function cachedStatus(queries: LyricsQuery[]): boolean[] {
  return queries.map((query) => readCache(queryFile(query)) !== null)
}

/** Number of songs and bytes in the lyrics database. */
export async function cacheStats(): Promise<{ songs: number; bytes: number }> {
  let songs = 0
  let bytes = 0
  try {
    for (const name of await fs.promises.readdir(cacheDir())) {
      if (!name.endsWith('.json')) continue
      const stat = await fs.promises.stat(path.join(cacheDir(), name))
      bytes += stat.size
      songs += 1
    }
  } catch {
    /* no database yet */
  }
  return { songs, bytes }
}

export async function clearCache(): Promise<void> {
  await fs.promises.rm(cacheDir(), { recursive: true, force: true })
}

function writeCache(file: string, value: LyricsResult | { missing: true; at: number }): void {
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
    .replace(/\p{M}/gu, '')
    .replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$/g, '')
    .replace(/[^a-z0-9]+/g, '')

/**
 * A search hit only counts when the artist matches and, if both sides know it,
 * the length is within a few seconds. Without that check the first random
 * result used to be cached as the lyrics of an unrelated song.
 */
function isMatch(entry: LrclibEntry, artist: string, duration: number | undefined): boolean {
  if (!entry.syncedLyrics && !entry.plainLyrics && !entry.instrumental) return false
  const wanted = simplify(artist)
  const found = simplify(entry.artistName ?? '')
  if (wanted && found && !found.includes(wanted) && !wanted.includes(found)) return false
  if (duration && duration > 1 && entry.duration && Math.abs(entry.duration - duration) > 4) return false
  return true
}

const toResult = (entry: LrclibEntry): LyricsResult => ({
  synced: entry.syncedLyrics ?? null,
  plain: entry.plainLyrics ?? null,
  instrumental: Boolean(entry.instrumental) && !entry.syncedLyrics && !entry.plainLyrics,
  source: 'lrclib',
})

/** Lyrics from LRCLIB (https://lrclib.net): free, no API key, community database. */
export async function getLyrics(query: LyricsQuery): Promise<LyricsResult | null> {
  const title = String(query.title ?? '').trim()
  const artist = String(query.artist ?? '').trim()
  if (!title) return null

  const cache = cacheFile(title, artist, query.album ?? '')
  const cached = readCache(cache)
  if (cached === 'missing' && !query.force) return null
  if (cached && cached !== 'missing') return cached

  const params = new URLSearchParams({ track_name: title, artist_name: artist })
  if (query.album) params.set('album_name', query.album)
  if (query.duration && query.duration > 1) params.set('duration', String(Math.round(query.duration)))

  let answered = false
  try {
    const exact = (await requestJson(`https://lrclib.net/api/get?${params.toString()}`)) as LrclibEntry | null
    answered = true
    if (exact && (exact.syncedLyrics || exact.plainLyrics || exact.instrumental)) {
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
      answered = true
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

  // LRCLIB answered but has nothing: remember that for a while instead of asking every time.
  if (answered) writeCache(cache, { missing: true, at: Date.now() })
  return null
}
