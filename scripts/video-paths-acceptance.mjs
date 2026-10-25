import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { apply } from '../plugin/index.js'
import { chromiumArgs, findChromeForTesting, serveDirectory, setRange } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/video-background/paths')
await mkdir(output, { recursive: true })
const temporary = await mkdtemp(resolve(tmpdir(), 'backspace-video-paths-'))
const chrome = await findChromeForTesting(chromium.executablePath())
const sample = resolve(output, 'source.mp4')
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', sample])
const original = await readFile(sample)
const free = Buffer.alloc(3 * 1024 * 1024 - original.length)
free.writeUInt32BE(free.length, 0); free.write('free', 4)
const videoBytes = Buffer.concat([original, free])
const checksum = createHash('sha256').update(videoBytes).digest('hex')
const largeSample = resolve(output, 'three-megabytes.mp4')
await writeFile(largeSample, videoBytes)
const fixture = (await readFile(resolve(root, 'tests/fixtures/harness/index.html'), 'utf8')).replace('lang="en"', 'lang="zh-CN"')
const results = []
const ready = page => page.waitForFunction(() => {
  const button = document.querySelector('.bs-video-import')
  return button && !button.disabled
})
async function pluginServer(withPlugin) {
  let route
  apply({ effect: factory => factory(), webServer: { register: value => { route = value; return () => {} } } })
  const client = await readFile(resolve(root, 'plugin/client.js'))
  const server = createServer(async (request, response) => {
    if (request.url.startsWith('/dsh-backspace/')) { await route.handler(request, response); return }
    if (request.url === '/client.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(client); return }
    const bootstrap = withPlugin ? '<script>window.__ModuleLoader__={load:({factory})=>factory(()=>{}).apply({effect:()=>{}})};</script><script src="/client.js"></script>' : ''
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(fixture.replace('</body>', bootstrap + '</body>'))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) }
}
try {
  for (const adapter of ['static', 'plugin', 'extension']) {
    let server
    if (adapter === 'static') {
      const dist = resolve(temporary, 'dist'); await mkdir(dist)
      await writeFile(resolve(dist, 'index.html'), fixture)
      execFileSync('bash', [resolve(root, 'native-dist/install-skin.sh'), '--dist', dist], { stdio: 'pipe' })
      server = await serveDirectory(dist)
    } else server = await pluginServer(adapter === 'plugin')
    const profile = resolve(temporary, `${adapter}-profile`)
    const launch = () => chromium.launchPersistentContext(profile, {
      executablePath: chrome, headless: true, viewport: { width: 1280, height: 900 },
      ignoreDefaultArgs: adapter === 'extension' ? ['--disable-extensions'] : [],
      args: [...chromiumArgs(), ...(adapter === 'extension' ? [`--disable-extensions-except=${resolve(root, 'extension')}`, `--load-extension=${resolve(root, 'extension')}`] : [])],
    })
    let context
    let other
    try {
      context = await launch()
      let page = context.pages()[0]
      await page.goto(server.url)
      await page.getByRole('button', { name: 'Backspace 皮肤设置', exact: true }).click()
      await page.getByRole('tab', { name: '本地视频', exact: true }).click()
      await ready(page)
      await page.locator('#__dsh-backspace-panel__-video-files').setInputFiles(largeSample)
      await page.getByRole('checkbox', { name: '启用 three-megabytes', exact: true }).check()
      await ready(page)
      const frame = page.frameLocator('#__dsh-backspace-video__')
      const proof = await frame.locator('video').evaluate(async video => {
        const bytes = await (await fetch(video.currentSrc)).arrayBuffer()
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        return { origin: location.origin, size: bytes.byteLength, hash: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''), muted: video.muted, playing: !video.paused }
      })
      assert.equal(proof.size, videoBytes.length); assert.equal(proof.hash, checksum); assert.equal(proof.muted, true); assert.equal(proof.playing, true)
      if (adapter === 'extension') assert.ok(proof.origin.startsWith('chrome-extension://'))
      await page.getByRole('button', { name: '重命名 three-megabytes', exact: true }).click()
      const input = page.getByRole('textbox', { name: '重命名 three-megabytes', exact: true })
      await input.fill('跨路径视频'); await input.press('Enter'); await ready(page)
      await setRange(page.locator('#__dsh-backspace-panel__-glass-range'), 65)
      for (const [skin, selector, value] of [['horizon', 'cosmos-glow', 27], ['vortex', 'cosmos-glow', 83], ['ocean', 'sea', 41]]) {
        await page.locator(`[data-skin="${skin}"]`).click()
        await setRange(page.locator(`#__dsh-backspace-panel__-${selector}-range`), value)
      }
      await page.getByRole('tab', { name: '本地视频', exact: true }).click()
      await ready(page)
      await page.screenshot({ path: resolve(output, `${adapter}-light.png`), fullPage: true })
      await context.close()
      context = await launch()
      page = context.pages()[0]
      await page.goto(server.url)
      await page.getByRole('button', { name: 'Backspace 皮肤设置', exact: true }).click()
      await page.getByRole('checkbox', { name: '启用 跨路径视频', exact: true }).waitFor()
      await ready(page)
      assert.equal(await page.getByRole('checkbox', { name: '启用 跨路径视频', exact: true }).isChecked(), true)
      assert.equal(await page.locator('#__dsh-backspace-panel__-glass-range').inputValue(), '65')
      for (const [skin, selector, value] of [['horizon', 'cosmos-glow', '27'], ['vortex', 'cosmos-glow', '83'], ['ocean', 'sea', '41']]) {
        await page.locator(`[data-skin="${skin}"]`).click()
        assert.equal(await page.locator(`#__dsh-backspace-panel__-${selector}-range`).inputValue(), value, `${adapter}: ${skin} settings survive restart independently`)
      }
      await page.getByRole('tab', { name: '本地视频', exact: true }).click()
      await ready(page)
      if (adapter === 'extension') {
        const scalarStorage = await page.frameLocator('#__dsh-backspace-video__').locator('body').evaluate(async () => chrome.storage.sync.get(null))
        assert.ok(JSON.stringify(scalarStorage).length < 8000)
        assert.doesNotMatch(JSON.stringify(scalarStorage), /跨路径视频|data:image|three-megabytes/)
        other = await pluginServer(false)
        const otherPage = await context.newPage()
        await otherPage.goto(other.url)
        await otherPage.getByRole('button', { name: 'Backspace 皮肤设置', exact: true }).click()
        await ready(otherPage)
        assert.equal(await otherPage.locator('.bs-video-grid img').count(), 0)
        await otherPage.waitForFunction(() => {
          const frame = document.getElementById('__dsh-backspace__')
          return frame && getComputedStyle(frame).opacity === '1'
        }, null, { timeout: 10000 })
        assert.equal(await otherPage.locator('#__dsh-backspace__').evaluate(frame => getComputedStyle(frame).opacity), '1')
        await otherPage.close()
      }
      await page.getByRole('button', { name: '移除 跨路径视频', exact: true }).click()
      await ready(page)
      assert.equal(await page.locator('.bs-video-grid img').count(), 0)
      await page.reload()
      await page.getByRole('button', { name: 'Backspace 皮肤设置', exact: true }).click()
      await ready(page)
      assert.equal(await page.locator('.bs-video-grid img').count(), 0)
      results.push({ scenario: adapter, result: 'PASS', ...proof, processRestart: true, renameAndAppearancePersisted: true, builtinSettingsPersistedIndependently: true, removed: true })
    } finally {
      await context?.close(); await other?.close(); await server.close()
    }
  }
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await rm(temporary, { recursive: true, force: true })
}
console.log(`PASS: ${results.length} real installation paths`)
