import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { createServer } from 'node:http'
import test from 'node:test'
import { createMarketHandler, verifyEnvelope } from '../plugin/market-server.js'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const sha = 'a'.repeat(64)
const bytes = Buffer.from('video bytes')
const file = { role: 'video', url: 'http://127.0.0.1:9000/zed-space-public/video', sha256: sha, bytes: bytes.length, mime: 'video/mp4', media: { width: 1920, height: 1080, duration_ms: 30000 } }
const catalog = () => ({ wallpapers: [{ asset_id: 'demo', localization: { 'zh-Hans': { title: '视频' } }, files: [{ role: 'poster' }, structuredClone(file)] }] })
function envelope(value = catalog()) {
  const payload = Buffer.from(JSON.stringify(value))
  return { schema_version: '1.0', key_id: 'catalog-ed25519-v1', payload: payload.toString('base64url'), signature: sign(null, payload, privateKey).toString('base64url') }
}
const verifyCatalog = value => verifyEnvelope(value, publicKey)
async function harness(t, options) {
  const handler = createMarketHandler(options)
  const server = createServer(async (req, res) => { if (!await handler(req, res)) { res.writeHead(404); res.end() } })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)) })
  return `http://127.0.0.1:${server.address().port}/dsh-zed-space/market`
}

test('signed raw payload is verified before normalization, tampering and wrong keys fail', () => {
  const signed = envelope()
  assert.equal(verifyCatalog(signed).wallpapers[0].files[0].sha256, sha)
  assert.throws(() => verifyCatalog({ ...signed, payload: Buffer.from('{}').toString('base64url') }))
  assert.throws(() => verifyEnvelope(signed, generateKeyPairSync('ed25519').publicKey))
  assert.throws(() => verifyCatalog({ ...signed, signature: signed.signature + '=' }))
})

test('HTTP catalog strips URLs and posters; media GET and HEAD use only trusted membership', async t => {
  const calls = []
  const base = await harness(t, { verifyCatalog, fetcher: async (url, init) => {
    calls.push({ url, method: init.method, redirect: init.redirect })
    return url.endsWith('/api/catalog') ? Response.json(envelope()) : new Response(init.method === 'HEAD' ? null : bytes, { headers: { 'content-type': file.mime, 'content-length': String(bytes.length) } })
  } })
  const response = await fetch(`${base}/catalog`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { wallpapers: [{ assetId: 'demo', title: '视频', files: [{ sha256: sha, bytes: bytes.length, mime: 'video/mp4', media: { width: 1920, height: 1080, durationMs: 30000 } }] }] })
  for (const method of ['GET', 'HEAD']) {
    const media = await fetch(`${base}/media?asset=demo&file=${sha}`, { method })
    assert.equal(media.status, 200)
    assert.equal(media.headers.get('content-length'), String(bytes.length))
    assert.equal(media.headers.get('content-type'), 'video/mp4')
    assert.deepEqual(Buffer.from(await media.arrayBuffer()), method === 'HEAD' ? Buffer.alloc(0) : bytes)
  }
  assert.ok(calls.every(c => ['http://127.0.0.1:8080/api/catalog', file.url].includes(c.url) && c.redirect === 'error'))
})

test('signed metadata rejects duplicate IDs/hashes, malformed sizes and escaped or non-public URLs', () => {
  const invalidURLs = ['http://127.0.0.1:9000/private/video', 'http://localhost:9000/zed-space-public/video', 'http://127.0.0.1:9000/zed-space-public/../secret', 'http://127.0.0.1:9000/zed-space-public/%2e%2e/video', 'http://user@127.0.0.1:9000/zed-space-public/video', file.url + '?key=x', file.url + '#x', file.url + '/./x', file.url + '\\x', 'https://external.test/video']
  for (const url of invalidURLs) {
    const value = catalog(); value.wallpapers[0].files[1].url = url
    assert.throws(() => verifyCatalog(envelope(value)), url)
  }
  for (const mutate of [
    value => value.wallpapers.push(structuredClone(value.wallpapers[0])),
    value => value.wallpapers[0].files.push(structuredClone(file)),
    value => { value.wallpapers[0].files[1].bytes = '11' },
    value => { value.wallpapers[0].files[1].media.width = 0 },
    value => { value.wallpapers[0].files[1].sha256 = '../x' },
  ]) { const value = catalog(); mutate(value); assert.throws(() => verifyCatalog(envelope(value))) }
})

test('public HTTP rejects malformed queries/methods and unknown IDs without arbitrary upstream fetch', async t => {
  const calls = []
  const base = await harness(t, { verifyCatalog, fetcher: async url => { calls.push(url); return Response.json(envelope()) } })
  for (const query of ['', '?asset=demo', `?asset=demo&file=${sha}&url=https://external.test`, `?asset=demo&asset=demo&file=${sha}`, '?asset=demo&file=../secret', `?asset=&file=${sha}`]) {
    assert.equal((await fetch(`${base}/media${query}`)).status, 400)
  }
  assert.equal((await fetch(`${base}/catalog?key=evil`)).status, 400)
  assert.equal((await fetch(`${base}/catalog`, { method: 'POST' })).status, 405)
  assert.equal(calls.length, 0)
  assert.equal((await fetch(`${base}/media?asset=missing&file=${sha}`)).status, 404)
  assert.deepEqual(calls, ['http://127.0.0.1:8080/api/catalog'])
})

test('incompatible videos remain discoverable but never reach media upstream', async t => {
  for (const patch of [{ bytes: 33554433 }, { mime: 'video/quicktime' }, { media: { ...file.media, width: 1921 } }, { media: { ...file.media, height: 1081 } }, { media: { ...file.media, duration_ms: 30001 } }]) {
    const value = catalog(); Object.assign(value.wallpapers[0].files[1], patch)
    const calls = []
    const base = await harness(t, { verifyCatalog, fetcher: async url => { calls.push(url); return Response.json(envelope(value)) } })
    const discovered = await (await fetch(`${base}/catalog`)).json()
    assert.equal(discovered.wallpapers[0].files[0].mime, patch.mime ?? file.mime)
    assert.equal((await fetch(`${base}/media?asset=demo&file=${sha}`)).status, 413)
    assert.ok(calls.every(url => url.endsWith('/api/catalog')))
  }
})

test('catalog signature failures, oversized bodies and upstream media headers fail closed', async t => {
  for (const response of [Response.json({ ...envelope(), signature: 'a'.repeat(86) }), new Response('x'.repeat(8 * 1024 * 1024 + 1)), new Response(null, { status: 302 })]) {
    const base = await harness(t, { verifyCatalog, fetcher: async () => response })
    assert.equal((await fetch(`${base}/catalog`)).status, 503)
  }
  for (const response of [new Response(bytes, { status: 302 }), new Response(bytes, { headers: { 'content-type': 'text/html' } }), new Response(bytes, { headers: { 'content-type': file.mime, 'content-length': '999' } }), new Response(bytes, { headers: { 'content-type': file.mime, 'content-encoding': 'gzip' } })]) {
    const base = await harness(t, { verifyCatalog, fetcher: async url => url.endsWith('/api/catalog') ? Response.json(envelope()) : response })
    assert.equal((await fetch(`${base}/media?asset=demo&file=${sha}`)).status, 503)
  }
})

test('short, oversized, and errored media streams cannot complete a successful download', async t => {
  for (const body of [bytes.subarray(0, -1), Buffer.concat([bytes, Buffer.from('!')]), new ReadableStream({ start(controller) { controller.error(new Error('upstream broke')) } })]) {
    const base = await harness(t, { verifyCatalog, fetcher: async url => url.endsWith('/api/catalog') ? Response.json(envelope()) : new Response(body, { headers: { 'content-type': file.mime } }) })
    await assert.rejects(async () => { const result = await fetch(`${base}/media?asset=demo&file=${sha}`); await result.arrayBuffer() })
  }
})

test('real upstream HTTP receives cancellation when the downstream disconnects', async t => {
  let resolveClosed
  const closed = new Promise(resolve => { resolveClosed = resolve })
  const upstream = createServer((req, res) => {
    res.writeHead(200, { 'content-type': file.mime })
    res.write(bytes.subarray(0, 1))
    res.on('close', resolveClosed)
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  t.after(() => { upstream.closeAllConnections(); return new Promise(resolve => upstream.close(resolve)) })
  const base = await harness(t, { verifyCatalog, fetcher: async (url, init) => url.endsWith('/api/catalog') ? Response.json(envelope()) : fetch(`http://127.0.0.1:${upstream.address().port}/video`, init) })
  const controller = new AbortController()
  const result = await fetch(`${base}/media?asset=demo&file=${sha}`, { signal: controller.signal })
  const reader = result.body.getReader()
  assert.equal((await reader.read()).value.length, 1)
  controller.abort()
  await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('upstream not cancelled')), 2000); timer.unref() })])
})

test('real upstream header timeout returns 503 and stalled body hits the whole-download deadline', async t => {
  for (const sendHeaders of [false, true]) {
    let resolveClosed
    const closed = new Promise(resolve => { resolveClosed = resolve })
    const upstream = createServer((req, res) => {
      res.on('close', resolveClosed)
      if (sendHeaders) { res.writeHead(200, { 'content-type': file.mime }); res.write(bytes.subarray(0, 1)) }
    })
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
    t.after(() => { upstream.closeAllConnections(); return new Promise(resolve => upstream.close(resolve)) })
    const base = await harness(t, { verifyCatalog, headerTimeoutMs: 100, downloadTimeoutMs: 200, fetcher: async (url, init) => url.endsWith('/api/catalog') ? Response.json(envelope()) : fetch(`http://127.0.0.1:${upstream.address().port}/video`, init) })
    const response = await fetch(`${base}/media?asset=demo&file=${sha}`)
    if (sendHeaders) await assert.rejects(() => response.arrayBuffer())
    else assert.equal(response.status, 503)
    await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('upstream not timed out')), 2000); timer.unref() })])
  }
})

test('object storage octet-stream is emitted with the signed video MIME', async t => {
  const base = await harness(t, { verifyCatalog, fetcher: async url => url.endsWith('/api/catalog') ? Response.json(envelope()) : new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) } }) })
  const response = await fetch(`${base}/media?asset=demo&file=${sha}`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), file.mime)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
})

test('portrait videos use the existing native long-side and short-side limits', async t => {
  const value = catalog(); value.wallpapers[0].files[1].media = { width: 1080, height: 1920, duration_ms: 30000 }
  const base = await harness(t, { verifyCatalog, fetcher: async url => url.endsWith('/api/catalog') ? Response.json(envelope(value)) : new Response(bytes, { headers: { 'content-type': file.mime } }) })
  const response = await fetch(`${base}/media?asset=demo&file=${sha}`)
  assert.equal(response.status, 200)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
})
