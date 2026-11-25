/*
 * "Fix song info": proposes better titles, artists, albums, years, track
 * numbers and artwork for songs. Two sources:
 *   1. The file name ("01 - Artist - Title.mp3") and obvious junk in titles
 *      ("(Official Video)", underscores, site names). Works offline.
 *   2. MusicBrainz (https://musicbrainz.org), the open music database, with
 *      artwork from the Cover Art Archive. No account or key needed; requests
 *      are limited to one per second as MusicBrainz asks.
 * Nothing is written until the user ticks a proposal and applies it.
 */
import { app, nativeImage } from 'electron'
import path from 'node:path'
import { cleanTag, cleanTitle, isJunkTag, parseFileName } from './tagtext.js'

export interface MetaInput {
  id: string
  path: string
  title: string
  artist: string
  album: string
  albumArtist: string
  year: number | null
  trackNo: number | null
  duration: number
  hasCover: boolean
}

export interface MetaChanges {
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: number
  trackNo?: number
}

export interface MetaProposal {
  id: string
  changes: MetaChanges
  /** Front cover from the Cover Art Archive, when the song has none. */
  coverUrl?: string
  source: 'file name' | 'MusicBrainz' | 'file name + MusicBrainz'
}

const ua = (): string => `MeowPlayer/${app.getVersion()} ( https://github.com/AminMGM/MeowPlayer )`
const TIMEOUT_MS = 12_000
const UNKNOWN = /^(unknown( artist| album)?|various|track\s*\d*|untitled|<unknown>)?$/i

/* ------------------------------ file names ------------------------------ */

const fileStem = (file: string): string => path.basename(file, path.extname(file))

/** What the file name and title cleanup alone can fix. */
function fromFileName(item: MetaInput): MetaChanges {
  const changes: MetaChanges = {}
  const parsed = parseFileName(item.path)
  const titleIsFileName = !item.title.trim() || item.title === fileStem(item.path) || UNKNOWN.test(item.title.trim())
  const artistClean = isJunkTag(item.artist) ? cleanTag(item.artist) : item.artist
  const artistUnknown = !artistClean.trim() || UNKNOWN.test(artistClean.trim())
  if (artistClean !== item.artist && !artistUnknown) changes.artist = artistClean
  if (isJunkTag(item.album)) {
    const album = cleanTag(item.album)
    if (album) changes.album = album
  }
  // A channel name in the album artist ("@IRMusicMag"): use the cleaned value, or the song's artist.
  if (isJunkTag(item.albumArtist)) {
    const albumArtist = cleanTag(item.albumArtist)
    changes.albumArtist = albumArtist && !UNKNOWN.test(albumArtist) ? albumArtist : (changes.artist ?? artistClean)
  }

  if (titleIsFileName && parsed.title && parsed.title !== item.title) changes.title = parsed.title
  else {
    const cleaned = cleanTitle(item.title)
    if (cleaned && cleaned !== item.title) changes.title = cleaned
  }
  if (artistUnknown && parsed.artist) changes.artist = parsed.artist
  if (!item.trackNo && parsed.trackNo && parsed.trackNo < 200) changes.trackNo = parsed.trackNo
  return changes
}

/* ------------------------------ MusicBrainz ------------------------------ */

interface MbCredit {
  name: string
  joinphrase?: string
}
interface MbRelease {
  id: string
  title: string
  date?: string
  status?: string
  'artist-credit'?: MbCredit[]
  'release-group'?: { id?: string; 'primary-type'?: string; 'secondary-types'?: string[] }
  media?: { track?: { number?: string }[] }[]
}
interface MbRecording {
  title: string
  score?: number
  length?: number
  'artist-credit'?: MbCredit[]
  releases?: MbRelease[]
}

let nextSlot = 0
/** MusicBrainz allows about one request per second per client. */
async function throttle(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + 1100
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
}

const simplify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const credit = (credits: MbCredit[] | undefined): string =>
  (credits ?? []).map((c) => `${c.name}${c.joinphrase ?? ''}`).join('').trim()

const escapeQuery = (value: string): string => value.replace(/(["\\])/g, '\\$1')

async function searchRecording(title: string, artist: string, strict: boolean): Promise<MbRecording[]> {
  let query = `recording:"${escapeQuery(title)}" AND artist:"${escapeQuery(artist)}"`
  // First ask for the song as it appears on official studio albums.
  if (strict) query += ' AND status:official AND primarytype:album AND NOT secondarytype:live AND NOT secondarytype:compilation'
  const url = `https://musicbrainz.org/ws/2/recording?fmt=json&limit=15&query=${encodeURIComponent(query)}`
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await throttle()
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': ua(), Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status === 503) {
        // Rate limited: back off, then try once more.
        nextSlot = Date.now() + 2500
        continue
      }
      if (!res.ok) return []
      const body = (await res.json()) as { recordings?: MbRecording[] }
      return Array.isArray(body.recordings) ? body.recordings : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Picks the release to take album, year, track number and artwork from:
 * the album the song is already tagged with, otherwise the original studio
 * album by the same artist. Live albums, compilations and "Various Artists"
 * collections lose; among equals the oldest release wins.
 */
function pickRelease(releases: MbRelease[], currentAlbum: string, artist: string): MbRelease | undefined {
  const wanted = simplify(currentAlbum)
  const wantedArtist = simplify(artist)
  const rank = (release: MbRelease): number => {
    const group = release['release-group']
    const by = simplify(credit(release['artist-credit']))
    let score = 0
    if (wanted && simplify(release.title) === wanted) score += 200
    if (wantedArtist && by && (by.includes(wantedArtist) || wantedArtist.includes(by))) score += 40
    else score -= 40
    if (release.status === 'Official') score += 15
    if (group?.['primary-type'] === 'Album') score += 20
    else if (group?.['primary-type'] === 'Single' || group?.['primary-type'] === 'EP') score += 8
    if (group?.['secondary-types']?.length) score -= 60
    return score
  }
  const year = (release: MbRelease): string => (release.date && /^\d{4}/.test(release.date) ? release.date : '9999')
  return [...releases].sort((a, b) => rank(b) - rank(a) || year(a).localeCompare(year(b)))[0]
}

/** The year an album (release group) first came out. */
async function albumYear(groupId: string | undefined): Promise<number | null> {
  if (!groupId || !/^[0-9a-f-]{36}$/.test(groupId)) return null
  await throttle()
  try {
    const res = await fetch(`https://musicbrainz.org/ws/2/release-group/${groupId}?fmt=json`, {
      headers: { 'User-Agent': ua(), Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { 'first-release-date'?: string }
    const year = Number(body['first-release-date']?.slice(0, 4))
    return year > 1900 ? year : null
  } catch {
    return null
  }
}

async function hasFrontCover(releaseId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://coverartarchive.org/release/${releaseId}/front-250`, {
      method: 'HEAD',
      headers: { 'User-Agent': ua() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Proposes fixes for one song, or null when it already looks right.
 * `online` turns the MusicBrainz lookup on.
 */
/** True when any tag of the song carries upload-channel junk; such rips usually have watermarked artwork too. */
const hasJunk = (item: MetaInput): boolean =>
  [item.title, item.artist, item.album, item.albumArtist].some((value) => isJunkTag(value))

export async function lookupFix(item: MetaInput, online: boolean, replaceArt = false): Promise<MetaProposal | null> {
  const junky = hasJunk(item)
  const local = fromFileName(item)
  const title = local.title ?? item.title
  const artist = local.artist ?? item.artist
  const changes: MetaChanges = { ...local }
  let coverUrl: string | undefined
  let usedOnline = false

  const artistKnown = artist.trim() && !UNKNOWN.test(artist.trim())
  if (online && title.trim() && artistKnown) {
    const wantedTitle = simplify(title)
    const wantedArtist = simplify(artist)
    const isSong =(recording: MbRecording): boolean => {
      if ((recording.score ?? 0) < 85) return false
      if (simplify(recording.title) !== wantedTitle) return false
      const found = simplify(credit(recording['artist-credit']))
      if (wantedArtist && found && !found.includes(wantedArtist) && !wantedArtist.includes(found)) return false
      if (item.duration > 1 && recording.length && Math.abs(recording.length / 1000 - item.duration) > 6) return false
      return true
    }
    let matches = (await searchRecording(title, artist, true)).filter(isSong)
    if (!matches.length) matches = (await searchRecording(title, artist, false)).filter(isSong)
    const match = matches[0]
    // The same song is often several recordings (single, album, remaster): pool their releases.
    const releases = matches.flatMap((recording) => recording.releases ?? [])

    if (match) {
      usedOnline = true
      // Same words, better spelling or capitalisation.
      if (match.title !== title) changes.title = match.title
      const matchArtist = credit(match['artist-credit'])
      if (matchArtist && matchArtist !== artist) changes.artist = matchArtist

      const best = pickRelease(releases, item.album, matchArtist || artist)
      // Only trust a release by the same artist that is not a live album or a compilation.
      const by = simplify(credit(best?.['artist-credit']))
      const ownArtist = simplify(matchArtist || artist)
      const release =
        best &&
        !best['release-group']?.['secondary-types']?.length &&
        by &&
        (by.includes(ownArtist) || ownArtist.includes(by))
          ? best
          : undefined
      if (release) {
        const currentAlbum = changes.album ?? item.album
        const albumMissing = !currentAlbum.trim() || UNKNOWN.test(currentAlbum.trim()) || isJunkTag(item.album)
        if (albumMissing) {
          changes.album = release.title
          const albumArtist = credit(release['artist-credit'])
          if (albumArtist && albumArtist !== item.albumArtist) changes.albumArtist = albumArtist
        } else if (simplify(release.title) === simplify(currentAlbum) && release.title !== currentAlbum) {
          changes.album = release.title
        }
        const sameAlbum = albumMissing || simplify(release.title) === simplify(currentAlbum)
        // A junk or unknown album artist gets the release's real one.
        const albumArtistBad = !item.albumArtist.trim() || UNKNOWN.test(item.albumArtist.trim()) || isJunkTag(item.albumArtist)
        const releaseArtist = credit(release['artist-credit'])
        if (sameAlbum && albumArtistBad && releaseArtist) changes.albumArtist = releaseArtist
        // The album's original year (a remaster's own date would say 2011 for a 1985 album).
        const firstYear = await albumYear(release['release-group']?.id)
        if (!item.year && sameAlbum && firstYear) changes.year = firstYear
        // Track numbers differ between editions; take it only from the original one.
        const original = firstYear !== null && Number(release.date?.slice(0, 4)) === firstYear
        const number = Number(release.media?.[0]?.track?.[0]?.number)
        if (!item.trackNo && !changes.trackNo && sameAlbum && original && number > 0) changes.trackNo = number
        // New artwork for songs without any, for junk-tagged rips (usually watermarked), or when asked to replace all.
        const wantsCover = !item.hasCover || replaceArt || junky
        if (wantsCover && sameAlbum && (await hasFrontCover(release.id))) {
          coverUrl = `https://coverartarchive.org/release/${release.id}/front-500`
        }
      }
    }
  }

  // Drop "changes" that are no change at all.
  for (const key of Object.keys(changes) as (keyof MetaChanges)[]) {
    const before = item[key as keyof MetaInput]
    if (changes[key] === before || changes[key] === '' || changes[key] === undefined) delete changes[key]
  }
  if (!Object.keys(changes).length && !coverUrl) return null
  const fromFile = Object.keys(local).some((key) => key in changes)
  return {
    id: item.id,
    changes,
    coverUrl,
    source: usedOnline ? (fromFile ? 'file name + MusicBrainz' : 'MusicBrainz') : 'file name',
  }
}

/** Downloads a Cover Art Archive image and returns it as a 600 px JPEG. */
export async function fetchCover(url: string): Promise<Buffer | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'coverartarchive.org') return null
  try {
    const res = await fetch(parsed, { headers: { 'User-Agent': ua() }, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length > 15 * 1024 * 1024) return null
    const image = nativeImage.createFromBuffer(data)
    if (image.isEmpty()) return null
    const { width } = image.getSize()
    return (width > 600 ? image.resize({ width: 600, quality: 'best' }) : image).toJPEG(90)
  } catch {
    return null
  }
}
