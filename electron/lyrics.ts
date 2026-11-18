import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface LyricsResult {
  synced: string | null
  plain: string | null
  source: string
}

const UA = 'MeowPlayer/1.0 (Windows desktop music player)'

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
    /* ignore */
  }
}

async function requestJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) return null
  return res.json()
}

/**
 * Lyrics from LRCLIB (https://lrclib.net) — free, no API key, community database.
 */
export async function getLyrics(query: {
  title: string
  artist: string
  album?: string
  duration?: number
}): Promise<LyricsResult | null> {
  const title = (query.title ?? '').trim()
  const artist = (query.artist ?? '').trim()
  if (!title) return null

  const cache = cacheFile(title, artist, query.album ?? '')
  const cached = readCache(cache)
  if (cached) return cached

  const params = new URLSearchParams({ track_name: title, artist_name: artist })
  if (query.album) params.set('album_name', query.album)
  if (query.duration && query.duration > 1) params.set('duration', String(Math.round(query.duration)))

  try {
    const exact = await requestJson(`https://lrclib.net/api/get?${params.toString()}`)
    if (exact && (exact.syncedLyrics || exact.plainLyrics)) {
      const result: LyricsResult = {
        synced: exact.syncedLyrics ?? null,
        plain: exact.plainLyrics ?? null,
        source: 'lrclib',
      }
      writeCache(cache, result)
      return result
    }
  } catch {
    /* fall through to search */
  }

  try {
    const searchParams = new URLSearchParams({ track_name: title, artist_name: artist })
    const results = await requestJson(`https://lrclib.net/api/search?${searchParams.toString()}`)
    if (Array.isArray(results) && results.length) {
      const best =
        results.find((item: any) => item.syncedLyrics && item.artistName?.toLowerCase() === artist.toLowerCase()) ??
        results.find((item: any) => item.syncedLyrics) ??
        results[0]
      if (best && (best.syncedLyrics || best.plainLyrics)) {
        const result: LyricsResult = {
          synced: best.syncedLyrics ?? null,
          plain: best.plainLyrics ?? null,
          source: 'lrclib',
        }
        writeCache(cache, result)
        return result
      }
    }
  } catch {
    /* offline */
  }

  return null
}
