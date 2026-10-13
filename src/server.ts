import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { constants, createBrotliCompress, createGzip } from 'node:zlib'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export default createServerEntry({
  async fetch(request, opts) {
    return compress(request, await handler.fetch(request, opts))
  },
})

/**
 * Brotli or gzip for HTML and JSON on the plain Node server. Static files are
 * pre-compressed at build time, and on Vercel the CDN compresses for us.
 */
function compress(request: Request, res: Response) {
  const type = res.headers.get('content-type') ?? ''
  if (process.env.VERCEL || !res.body || res.headers.has('content-encoding')) return res
  if (!/text\/html|application\/json/.test(type)) return res
  const accept = request.headers.get('accept-encoding') ?? ''
  const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : ''
  if (!encoding) return res
  const zip =
    encoding === 'br'
      ? createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      : createGzip()
  const body = Readable.fromWeb(res.body as NodeReadableStream).pipe(zip)
  const headers = new Headers(res.headers)
  headers.set('content-encoding', encoding)
  headers.delete('content-length')
  headers.append('vary', 'Accept-Encoding')
  return new Response(Readable.toWeb(body) as ReadableStream, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}
