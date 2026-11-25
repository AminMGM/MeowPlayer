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

/** Removes video/upload junk and tidies spacing in a title. */
export function cleanTitle(title: string): string {
  let out = title.replace(/_/g, ' ')
  for (const pattern of JUNK) out = out.replace(pattern, '')
  return out.replace(/\s{2,}/g, ' ').trim()
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
