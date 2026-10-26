import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory, setRange } from './browser-support.mjs'

const server = await serveDirectory('pages-dist')
const browser = await chromium.launch({ headless: true,
  executablePath: await findChromeForTesting(chromium.executablePath()), args: chromiumArgs() })
const screenshotDir = process.env.BACKSPACE_WEBSITE_SCREENSHOTS
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
async function screenshot(page, name) {
  if (screenshotDir) await page.screenshot({ path: resolve(screenshotDir, `${name}.png`) })
}
async function posterLoaded(page) {
  await page.waitForFunction(() => performance.getEntriesByType('resource')
    .some(entry => entry.name.endsWith('/ocean-preview.jpg') && entry.responseEnd > 0))
  assert.match(await page.locator('.ocean-fallback').evaluate(el => getComputedStyle(el).backgroundImage), /ocean-preview\.jpg/)
}

try {
  // The former 12-second deadline must never strand a late first frame.
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  let release
  const gate = new Promise(resolveGate => { release = resolveGate })
  await page.route('**/ocean.js?skin=1', async route => { await gate; await route.continue() })
  const gifs = []
  page.on('request', request => { if (request.url().endsWith('.gif')) gifs.push(request.url()) })
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  await posterLoaded(page)
  await screenshot(page, 'loading-desktop')
  await setRange(page.locator('#sea-state'), 80)
  await page.waitForTimeout(13_000)
  assert.equal(gifs.length, 0, 'GIFs must not compete with the first ocean frame')
  assert.match(await page.locator('#renderer-status').innerText(), /准备中/)
  await page.locator('#language-toggle').click()
  assert.match(await page.locator('#renderer-status').innerText(), /Preparing live ocean/)
  release()
  await page.locator('#renderer-status.ready').waitFor({ timeout: 45_000 })
  await page.waitForFunction(() => document.querySelector('#ocean-frame').contentWindow.__bsState().sea > 1.4)
  await page.waitForTimeout(700)
  await screenshot(page, 'ready-desktop')
  assert.equal(gifs.length, 0, 'current scene gallery uses static captures, not historical GIFs')
  await page.close()
  console.log('✓ Poster, zero eager GIFs, late first frame, queued controls, static scene captures')

  const failure = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await failure.route('**/ocean.js?skin=1', route => route.abort())
  await failure.route('**/*.gif', route => route.abort())
  await failure.goto(server.url, { waitUntil: 'domcontentloaded' })
  await failure.locator('#renderer-status.fallback').waitFor()
  await failure.evaluate(() => window.postMessage({ type: 'bs-website-renderer', status: 'ready', attempt: '1' }, location.origin))
  assert.equal(await failure.locator('#ocean-frame.ready').count(), 0)
  await posterLoaded(failure)
  assert.equal(await failure.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await screenshot(failure, 'fallback-mobile')
  await failure.unroute('**/ocean.js?skin=1')
  await failure.locator('#ocean-retry').click()
  await failure.locator('#renderer-status.ready').waitFor({ timeout: 45_000 })
  await failure.locator('.harness-window').scrollIntoViewIfNeeded()
  await failure.waitForTimeout(1000)
  assert.match(await failure.locator('.harness-capture-dark').getAttribute('src'), /\.png$/)
  await failure.close()
  console.log('✓ Failed download, source validation, mobile fallback, retry, static scene image remains available')

  // Exercise the full timeout without spending 45 seconds in every CI run.
  const timeout = await browser.newPage()
  await timeout.addInitScript(() => {
    if (window !== window.top) return
    const original = window.setTimeout.bind(window)
    window.setTimeout = (fn, ms, ...args) => original(fn, ms === 45000 ? 250 : ms === 8000 ? 100 : ms, ...args)
  })
  let unblock
  const pending = new Promise(resolveGate => { unblock = resolveGate })
  await timeout.route('**/ocean.js?skin=1', async route => { await pending; await route.continue() })
  await timeout.goto(server.url, { waitUntil: 'domcontentloaded' })
  await timeout.locator('#renderer-status.fallback').waitFor()
  unblock()
  await timeout.locator('#renderer-status.ready').waitFor({ timeout: 45_000 })
  assert.equal(await timeout.locator('#ocean-retry').isVisible(), false)
  await timeout.close()
  console.log('✓ Timeout still accepts a late first frame without retry')

  const reduced = await browser.newPage({ reducedMotion: 'reduce' })
  const reducedGIFs = []
  reduced.on('request', request => { if (request.url().endsWith('.gif')) reducedGIFs.push(request.url()) })
  await reduced.goto(server.url)
  await reduced.locator('#renderer-status.ready').waitFor({ timeout: 45_000 })
  await reduced.locator('#gallery').scrollIntoViewIfNeeded()
  await reduced.waitForTimeout(1000)
  assert.deepEqual(reducedGIFs, [])
  assert.ok(parseFloat(await reduced.locator('#ocean-frame').evaluate(el => getComputedStyle(el).transitionDuration)) < 0.001)
  await reduced.close()
  const noJS = await browser.newPage({ javaScriptEnabled: false })
  await noJS.goto(server.url)
  assert.equal(await noJS.locator('.ocean-noscript').isVisible(), true)
  await screenshot(noJS, 'no-javascript')
  await noJS.close()
  console.log('✓ Reduced-motion static captures and no-JavaScript preview')
  if (screenshotDir) await writeFile(resolve(screenshotDir, 'loading-results.json'), JSON.stringify({ status: 'PASS', scenarios: ['delayed-first-frame', 'queued-controls', 'no-historical-gifs', 'download-failure', 'message-source-validation', 'retry', 'timeout-then-ready', 'reduced-motion', 'no-javascript'] }, null, 2))
} finally {
  await browser.close()
  await server.close()
  if (screenshotDir) await writeFile(resolve(screenshotDir, 'loading-cleanup.json'), JSON.stringify({ browserClosed: true, serverClosed: true, actualHarnessAccessed: false }, null, 2))
}
