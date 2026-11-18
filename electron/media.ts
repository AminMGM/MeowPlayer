import { protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

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
 * Serves local audio and artwork files over the privileged `mp-media://` scheme.
 * Range requests are supported so the <audio> element can seek instantly.
 */
export function registerMediaProtocol(): void {
  protocol.handle('mp-media', async (request) => {
    try {
      const filePath = decodePath(request.url)
      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile()) return new Response('Not found', { status: 404 })

      const ext = path.extname(filePath).toLowerCase()
      const type = MIME[ext] ?? 'application/octet-stream'
      const total = stat.size
      const rangeHeader = request.headers.get('range')

      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': type, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
        })
      }

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
        let start = match?.[1] ? parseInt(match[1], 10) : 0
        let end = match?.[2] ? parseInt(match[2], 10) : total - 1
        if (Number.isNaN(start)) start = 0
        if (Number.isNaN(end) || end >= total) end = total - 1
        if (start > end) return new Response('Range not satisfiable', { status: 416 })
        const stream = fs.createReadStream(filePath, { start, end })
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Type': type,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
          },
        })
      }

      const stream = fs.createReadStream(filePath)
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': type,
          'Content-Length': String(total),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        },
      })
    } catch (err) {
      console.error('[media] failed to serve', request.url, err)
      return new Response('Not found', { status: 404 })
    }
  })
}
