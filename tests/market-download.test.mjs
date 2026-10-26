import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import test from 'node:test'
import '../shared/market-download.js'
const content = Buffer.from('verified video bytes')
const sha256 = createHash('sha256').update(content).digest('hex')
const makeCatalog = () => ({ wallpapers: [{ assetId: 'demo', title: '真实标题', files: [{ sha256, bytes: content.length, mime: 'video/mp4', media: { width: 1080, height: 1920, durationMs: 30000 } }] }] })
async function harness(t, { catalog = makeCatalog(), media = content, headers = {}, onMedia } = {}) {
  const calls = []
  const server = createServer((req, res) => {
    calls.push(req.url)
    if (req.url === '/market/catalog') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(catalog)); return }
    if (onMedia) { onMedia(req, res); return }
    res.writeHead(200, { 'content-type': 'video/mp4', ...headers }); res.end(media)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)) })
  return { calls, options: { assetUrl: path => `http://127.0.0.1:${server.address().port}/${path}`, assetId: 'demo', sha256, signal: new AbortController().signal } }
}
test('real HTTP verifies every byte and SHA before returning the signed-title File', async t => {
  const h = await harness(t); const phases = []; const progress = []
  const file = await globalThis.ZedSpaceMarketDownload.download({ ...h.options, onPhase: value => phases.push(value), onProgress: (...value) => progress.push(value) })
  assert.equal(file.name, '真实标题.mp4'); assert.equal(file.type, 'video/mp4')
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), content)
  assert.deepEqual(phases, ['verifying']); assert.deepEqual(progress[0], [0, content.length]); assert.deepEqual(progress.at(-1), [content.length, content.length])
  assert.deepEqual(h.calls, ['/market/catalog', `/market/media?asset=demo&file=${sha256}`])
})
test('unknown membership and incompatible metadata prevent media requests', async t => {
  for (const mutate of [value => { value.wallpapers[0].assetId = 'other' }, value => { value.wallpapers[0].files[0].bytes = 33554433 }, value => { value.wallpapers[0].files[0].mime = 'video/quicktime' }, value => { value.wallpapers[0].files[0].media.durationMs = 30001 }, value => { value.wallpapers[0].files[0].media.height = 1921 }, value => { value.wallpapers.push(structuredClone(value.wallpapers[0])) }]) {
    const catalog = makeCatalog(); mutate(catalog)
    const h = await harness(t, { catalog }); await assert.rejects(globalThis.ZedSpaceMarketDownload.download(h.options)); assert.deepEqual(h.calls, ['/market/catalog'])
  }
})
test('length mismatch, overshoot, truncation, wrong MIME and hash mismatch are rejected', async t => {
  for (const options of [{ headers: { 'content-length': '999' } }, { media: Buffer.concat([content, Buffer.from('!')]) }, { media: content.subarray(1) }, { headers: { 'content-type': 'text/html' } }, { media: Buffer.alloc(content.length, 1) }]) {
    const h = await harness(t, options); await assert.rejects(globalThis.ZedSpaceMarketDownload.download(h.options))
  }
})
test('aborting during streaming closes the actual upstream and yields no File', async t => {
  let resolveClosed; const closed = new Promise(resolve => { resolveClosed = resolve })
  const h = await harness(t, { onMedia(req, res) { res.on('close', resolveClosed); res.writeHead(200, { 'content-type': 'video/mp4' }); res.write(content.subarray(0, 1)) } })
  const abort = new AbortController()
  await assert.rejects(globalThis.ZedSpaceMarketDownload.download({ ...h.options, signal: abort.signal, onProgress(received) { if (received) abort.abort() } }))
  await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('upstream not closed')), 2000); timer.unref() })])
})
