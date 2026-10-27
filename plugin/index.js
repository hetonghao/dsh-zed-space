/**
 * Installable DeepSeek Harness Host plugin for Backspace.
 * Serves the self-contained renderer under /dsh-zed-space without patching
 * the Harness checkout.
 */
import { readFile } from 'node:fs/promises'
import { createMarketHandler } from './market-server.js'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-zed-space'
export const inject = ['webServer']

const ROUTE = '/dsh-zed-space'
const serveMarket = createMarketHandler()
const ASSET_ROOT = resolve(fileURLToPath(new URL('../native-dist/', import.meta.url)))
const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
})

function finish(res, status, headers = {}) {
  res.writeHead(status, {
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
    ...headers,
  })
  res.end()
}

async function serveAsset(req, res) {
  if (await serveMarket(req, res)) return
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    finish(res, 405, { allow: 'GET, HEAD' })
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url ?? ROUTE, 'http://dsh.local').pathname)
  } catch {
    finish(res, 400)
    return
  }

  const suffix = pathname === ROUTE || pathname === `${ROUTE}/`
    ? 'skin.html'
    : pathname.slice(`${ROUTE}/`.length)
  const target = resolve(ASSET_ROOT, suffix)
  if (target !== ASSET_ROOT && !target.startsWith(`${ASSET_ROOT}${sep}`)) {
    finish(res, 403)
    return
  }

  try {
    const body = await readFile(target)
    res.writeHead(200, {
      'cache-control': 'no-cache',
      'content-length': String(body.byteLength),
      'content-type': MIME[extname(target)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch (error) {
    if (error instanceof Error && 'code' in error
      && (error.code === 'ENOENT' || error.code === 'EISDIR')) {
      finish(res, 404)
      return
    }
    throw error
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: serveAsset,
  }), 'dsh-zed-space: static renderer route')
}
