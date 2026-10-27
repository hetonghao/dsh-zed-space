import { createPublicKey, verify } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const CATALOG_URL = 'http://127.0.0.1:8080/api/catalog'
const PREFIX = '/dsh-zed-space/market/'
const MAX_CATALOG_BYTES = 8 * 1024 * 1024
const trustedKey = createPublicKey({
  key: Buffer.from('302a300506032b657003210017b5ce0cdb7bd07a50f06cd3210da1a3929d3ff9586e79823dcef6202aed1d72', 'hex'),
  format: 'der',
  type: 'spki',
})

function requireValue(condition) {
  if (!condition) throw new Error('目录或媒体数据无效')
}
function object(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value))
  return value
}
function text(value) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= 10000)
  return value
}
function positive(value) {
  requireValue(Number.isSafeInteger(value) && value > 0)
  return value
}
function list(value) {
  requireValue(Array.isArray(value) && value.length <= 10000)
  return value
}
function base64(value) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value))
  const bytes = Buffer.from(value, 'base64url')
  requireValue(bytes.toString('base64url') === value)
  return bytes
}
function mediaURL(value) {
  const raw = text(value)
  requireValue(/^http:\/\/127\.0\.0\.1:9000\/zed-space-public\/[A-Za-z0-9_./-]+$/.test(raw)
    && !raw.includes('..') && !raw.endsWith('/'))
  const url = new URL(raw)
  requireValue(url.href === raw && !url.pathname.split('/').includes('.'))
  return raw
}

export function verifyEnvelope(value, key = trustedKey) {
  const envelope = object(value)
  requireValue(envelope.schema_version === '1.0' && envelope.key_id === 'catalog-ed25519-v1')
  const payload = base64(envelope.payload)
  const signature = base64(envelope.signature)
  requireValue(payload.length <= MAX_CATALOG_BYTES && signature.length === 64 && verify(null, payload, key, signature))
  const raw = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)))
  const wallpapers = list(raw.wallpapers).map(value => {
    const row = object(value)
    const files = list(row.files).filter(value => object(value).role === 'video').map(value => {
      const sha256 = text(value.sha256)
      requireValue(/^[a-f0-9]{64}$/.test(sha256))
      const mime = text(value.mime)
      requireValue(/^video\/[a-z0-9.+-]+$/.test(mime))
      const media = object(value.media)
      return { sha256, bytes: positive(value.bytes), mime, url: mediaURL(value.url), media: {
        width: positive(media.width), height: positive(media.height), durationMs: positive(media.duration_ms),
      } }
    })
    requireValue(files.length > 0 && new Set(files.map(file => file.sha256)).size === files.length)
    return { assetId: text(row.asset_id), title: text(object(object(row.localization)['zh-Hans']).title), files }
  })
  requireValue(new Set(wallpapers.map(row => row.assetId)).size === wallpapers.length)
  return { wallpapers }
}

async function boundedCatalog(response) {
  requireValue(response.status === 200 && response.body)
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    requireValue(size <= MAX_CATALOG_BYTES)
    chunks.push(chunk)
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
}

function compatible(file) {
  return ['video/mp4', 'video/webm'].includes(file.mime) && file.bytes <= 33554432
    && Math.max(file.media.width, file.media.height) <= 1920 && Math.min(file.media.width, file.media.height) <= 1080 && file.media.durationMs <= 30000
}
function finish(req, res, status, body, headers = {}) {
  const encoded = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
    ...(encoded ? { 'content-type': 'application/json; charset=utf-8', 'content-length': String(encoded.length) } : {}),
    ...headers,
  })
  res.end(req.method === 'HEAD' ? undefined : encoded)
}

// Dependencies are module-only test seams; HTTP requests cannot change trust or upstreams.
export function createMarketHandler({ fetcher = fetch, verifyCatalog = verifyEnvelope, headerTimeoutMs = 10000, downloadTimeoutMs = 120000 } = {}) {
  return async function serveMarket(req, res) {
    let url
    try { url = new URL(req.url, 'http://dsh.local') } catch { return false }
    if (!url.pathname.startsWith(PREFIX)) return false
    if (!['GET', 'HEAD'].includes(req.method)) {
      finish(req, res, 405, undefined, { allow: 'GET, HEAD' })
      return true
    }
    const isCatalog = url.pathname === `${PREFIX}catalog`
    if (!isCatalog && url.pathname !== `${PREFIX}media`) {
      finish(req, res, 404)
      return true
    }
    const params = url.searchParams
    if ((isCatalog && url.search) || (!isCatalog && (
      [...params.keys()].some(key => key !== 'asset' && key !== 'file')
      || params.getAll('asset').length !== 1 || !params.get('asset')?.trim() || params.get('asset').length > 10000
      || params.getAll('file').length !== 1 || !/^[a-f0-9]{64}$/.test(params.get('file'))
    ))) {
      finish(req, res, 400)
      return true
    }
    const abort = new AbortController()
    const onClose = () => abort.abort()
    res.once('close', onClose)
    req.once('aborted', onClose)
    const deadline = setTimeout(onClose, downloadTimeoutMs)
    deadline.unref?.()
    let upstream
    async function upstreamFetch(target, method) {
      const timer = setTimeout(onClose, headerTimeoutMs)
      timer.unref?.()
      try {
        return await fetcher(target, { method, redirect: 'error', credentials: 'omit', cache: 'no-store',
          headers: { 'Accept-Encoding': 'identity' }, signal: abort.signal })
      } finally { clearTimeout(timer) }
    }
    try {
      upstream = await upstreamFetch(CATALOG_URL, 'GET')
      const catalog = verifyCatalog(await boundedCatalog(upstream))
      if (isCatalog) {
        finish(req, res, 200, { wallpapers: catalog.wallpapers.map(row => ({ ...row, files: row.files.map(({ url, ...file }) => file) })) })
        return true
      }
      const file = catalog.wallpapers.find(row => row.assetId === params.get('asset'))?.files.find(file => file.sha256 === params.get('file'))
      if (!file) { finish(req, res, 404); return true }
      if (!compatible(file)) { finish(req, res, 413); return true }
      upstream = await upstreamFetch(mediaURL(file.url), req.method)
      const length = upstream.headers.get('content-length')
      requireValue(upstream.status === 200 && (length === null || length === String(file.bytes))
        && [file.mime, 'application/octet-stream'].includes(upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase())
        && [null, 'identity'].includes(upstream.headers.get('content-encoding')))
      const headers = { 'content-type': file.mime, 'content-length': String(file.bytes),
        'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }
      if (req.method === 'HEAD') { finish(req, res, 200, undefined, headers); return true }
      requireValue(upstream.body)
      async function* checkedBody() {
        let received = 0
        for await (const chunk of upstream.body) {
          received += chunk.length
          requireValue(received <= file.bytes)
          yield chunk
        }
        requireValue(received === file.bytes)
      }
      res.writeHead(200, headers)
      await pipeline(Readable.from(checkedBody()), res, { signal: abort.signal })
    } catch {
      if (!res.headersSent && !res.destroyed) finish(req, res, 503)
      else if (!res.destroyed) res.destroy()
    } finally {
      clearTimeout(deadline)
      res.off('close', onClose)
      req.off('aborted', onClose)
      abort.abort()
      if (upstream?.body && !upstream.body.locked) await upstream.body.cancel().catch(() => {})
    }
    return true
  }
}
