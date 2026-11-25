/**
 * Title cleanup and file-name parsing for "Fix song info". No Electron imports,
 * so it can be unit tested.
 */
import path from 'node:path'

const JUNK = [
  /\s*[([]\s*(official\s*)?(music\s*)?(video|audio|lyrics?|lyric video|visuali[sz]er|hd|hq|4k|mv|m\/v)\s*[)\]]/gi,
  /\s*[([]\s*official\s*[)\]]/gi,
  /\s*[([]\s*(free download|explicit|clean)\s*[)\]]/gi,
  /\s*[-|]\s*(www\.)?[a-z0-9-]+\.(com|net|org|ir|io|me|info)\b.*$/i,
  /^(www\.)?[a-z0-9-]+\.(com|net|org|ir|io|me|info)\s*[-|]\s*/i,
]

/** Upload-channel junk: @handles, Telegram links, URLs and site names. */
const PROMO =
  /@[\w.]{3,}|t\.me\/[^\s)\]}]*|telegram(\.me)?[^\s)\]}]*|https?:\/\/[^\s)\]}]+|www\.[^\s)\]}]+|\b[a-z0-9-]+\.(com|net|org|ir|io|me|info|xyz)\b/gi

/** True when a tag carries upload-channel junk, like "@IRMusicMag" or "t.me/somechannel". */
export function isJunkTag(value: string): boolean {
  return new RegExp(PROMO.source, 'i').test(value)
}

/** Removes promo junk (and brackets left empty by it) from a tag; may return ''. */
export function cleanTag(value: string): string {
  return value
    .replace(PROMO, '')
    .replace(/[([{]\s*[)\]}]/g, '')
    .replace(/^[\s\-|•·:,/]+|[\s\-|•·:,/]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Removes video/upload junk and tidies spacing in a title. */
export function cleanTitle(title: string): string {
  let out = title.replace(/_/g, ' ')
  for (const pattern of JUNK) out = out.replace(pattern, '')
  return cleanTag(out.replace(/\s{2,}/g, ' ').trim())
}

/** "03. Artist - Title (Official Video).mp3" → { trackNo: 3, artist, title }. */
export function parseFileName(file: string): { title: string; artist?: string; trackNo?: number } {
  let base = path.basename(file, path.extname(file)).replace(/_/g, ' ').trim()
  let trackNo: number | undefined
  const numbered = /^(\d{1,3})(?:\s*[.\-)]\s*|\s+)(?=\D)/.exec(base)
  if (numbered) {
    trackNo = Number(numbered[1])
    base = base.slice(numbered[0].length)
  }
  const parts = base.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) {
    const artist = cleanTitle(parts[0])
    const title = cleanTitle(parts.slice(1).join(' - '))
    if (artist && title) return { artist, title, trackNo }
  }
  return { title: cleanTitle(base), trackNo }
}
