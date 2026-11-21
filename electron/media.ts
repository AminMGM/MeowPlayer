import { app, protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getState } from './store.js'
import { parseRange } from './range.js'

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wma': 'audio/x-ms-wma',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

/* ------------------------------ access list ------------------------------ */

/**
 * The protocol only serves files the user has pointed MeowPlayer at: anything
 * inside a library folder, the cover cache, and single files that were opened
 * or dropped on the window. Everything else on disk is off limits, so a bug in
 * the renderer cannot be turned into an arbitrary file read.
 */
const grantedFiles = new Set<string>()

const normalize = (value: string): string => {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function grantFile(filePath: string): void {
  grantedFiles.add(normalize(filePath))
}

export function grantDirectory(dir: string): void {
  extraRoots.add(normalize(dir))
}

const extraRoots = new Set<string>()

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function isAllowed(filePath: string): boolean {
  const target = normalize(filePath)
  if (grantedFiles.has(target)) return true
  const roots = [normalize(path.join(app.getPath('userData'), 'covers')), ...extraRoots]
  const settings = (getState().settings ?? {}) as { folders?: unknown }
  if (Array.isArray(settings.folders)) {
    for (const folder of settings.folders) if (typeof folder === 'string' && folder) roots.push(normalize(folder))
  }
  return roots.some((root) => isInside(root, target))
}

/* -------------------------------- protocol ------------------------------- */

function decodePath(requestUrl: string): string {
  const url = new URL(requestUrl)
  let p = decodeURIComponent(url.pathname)
  if (p.startsWith('/')) p = p.slice(1)
  return p
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
}

/**
 * Serves local audio and artwork over the privileged `mp-media://` scheme.
 * Range requests are supported so the audio element can seek instantly.
 */
export function registerMediaProtocol(): void {
  protocol.handle('mp-media', async (request) => {
    try {
      const filePath = decodePath(request.url)
      if (!isAllowed(filePath)) return new Response('Forbidden', { status: 403 })

      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile()) return new Response('Not found', { status: 404 })

      const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      const total = stat.size
      const base = { ...corsHeaders, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' }

      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { ...base, 'Content-Length': String(total) } })
      }

      const range = parseRange(request.headers.get('range'), total)
      if (range === 'invalid') {
        return new Response('Range not satisfiable', {
          status: 416,
          headers: { ...corsHeaders, 'Content-Range': `bytes */${total}` },
        })
      }

      if (range) {
        const stream = fs.createReadStream(filePath, { start: range.start, end: range.end })
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 206,
          headers: {
            ...base,
            'Content-Length': String(range.end - range.start + 1),
            'Content-Range': `bytes ${range.start}-${range.end}/${total}`,
          },
        })
      }

      const stream = fs.createReadStream(filePath)
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 200,
        headers: { ...base, 'Content-Length': String(total) },
      })
    } catch (err) {
      console.error('[media] failed to serve', request.url, err)
      return new Response('Not found', { status: 404 })
    }
  })
}
