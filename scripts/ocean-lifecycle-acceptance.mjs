import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(resolve(root, process.argv[2] || 'shared/ocean.js'), 'utf8')
const output = resolve(root, '.scratch/ocean-lifecycle', process.argv[3] || 'current')
await mkdir(output, { recursive: true })
const evidence = { scenarios: [] }
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true, args: chromiumArgs() })
const state = page => page.evaluate(() => document.querySelector('#ocean').contentWindow.__bsState())
const rafs = page => page.evaluate(() => document.querySelector('#ocean').contentWindow.__oceanRafs)
const send = (page, data) => page.evaluate(data => document.querySelector('#ocean').contentWindow.postMessage(data, location.origin), data)
const hidden = (page, value) => page.evaluate(value => {
  const frame = document.querySelector('#ocean').contentWindow
  Object.defineProperty(frame.document, 'hidden', { configurable: true, value })
  frame.document.dispatchEvent(new frame.Event('visibilitychange'))
}, value)

async function open(deferInit = false) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  const errors = watchPageErrors(page, 'ocean lifecycle')
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame
    window.__oceanRafs = 0
    window.requestAnimationFrame = callback => request(time => { window.__oceanRafs++; callback(time) })
  })
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
  let runtime = source
  if (deferInit) {
    assert.ok(runtime.includes('    await renderer.init();'), 'initialization probe must match the real bootstrap')
    runtime = runtime.replace('    await renderer.init();', '    await new Promise(resolve => { window.__releaseOceanInit = resolve; });\n    await renderer.init();')
  }
  await page.route('**/extension/ocean.js?skin=1', route => route.fulfill({ contentType: 'text/javascript', body: runtime }))
  await page.goto(`${server.url}/tests/fixtures/generic/index.html`)
  await page.evaluate(origin => {
    const iframe = document.createElement('iframe')
    iframe.id = 'ocean'
    iframe.style.cssText = 'width:640px;height:400px;border:0'
    iframe.src = `${origin}/extension/skin.html?auto=0&quality=low&parentOrigin=${encodeURIComponent(origin)}`
    document.body.replaceChildren(iframe)
  }, server.url)
  if (deferInit) await page.waitForFunction(() => typeof document.querySelector('#ocean').contentWindow.__releaseOceanInit === 'function')
  else await page.frameLocator('#ocean').locator('body.ready').waitFor({ timeout: 45000 })
  return { page, errors }
}

try {
  const { page, errors } = await open()
  await page.waitForTimeout(300)
  const active = await state(page)
  await send(page, { type: 'bs-pause', paused: true })
  await page.waitForTimeout(100)
  const paused = await state(page)
  const pausedRafs = await rafs(page)
  await page.waitForTimeout(2200)
  const still = await state(page)
  const afterRafs = await rafs(page)
  evidence.scenarios.push({ name: 'host-pause-stops-rendering-and-raf', active, paused, still, addedRafs: afterRafs - pausedRafs })
  assert.equal(still.elapsed, paused.elapsed, 'hidden ocean must freeze wave time')
  assert.equal(still.frames, paused.frames, 'hidden ocean must stop render commands')
  assert.equal(afterRafs, pausedRafs, 'Three internal RAF callbacks must stop too')
  assert.equal(paused.paused, true)
  assert.equal(paused.loopActive, false)

  await hidden(page, true)
  await hidden(page, false)
  await page.waitForTimeout(250)
  assert.equal((await state(page)).loopActive, false, 'visibility must not override a host pause')
  assert.equal(await rafs(page), pausedRafs)
  await page.frameLocator('#ocean').locator('body').evaluate(() => {
    window.postMessage({ type: 'bs-pause', paused: false }, location.origin)
    window.dispatchEvent(new MessageEvent('message', { source: window.parent, origin: 'https://wrong.example', data: { type: 'bs-pause', paused: false } }))
  })
  await page.waitForTimeout(150)
  assert.equal((await state(page)).paused, true, 'non-parent and wrong-origin messages must be ignored')
  assert.equal(await rafs(page), pausedRafs)
  evidence.scenarios.push({ name: 'host-pause-precedes-visibility-and-untrusted-messages', result: 'PASS' })

  await page.evaluate(() => { document.querySelector('#ocean').style.cssText = 'width:720px;height:450px;border:0' })
  await page.waitForTimeout(150)
  assert.equal((await state(page)).frames, paused.frames, 'paused resize must not restart the ocean')
  const resumeAt = await page.evaluate(() => {
    document.querySelector('#ocean').contentWindow.postMessage({ type: 'bs-pause', paused: false }, location.origin)
    return performance.now()
  })
  await page.waitForFunction(frames => document.querySelector('#ocean').contentWindow.__bsState().frames > frames, paused.frames)
  const observation = await page.evaluate(() => ({ state: document.querySelector('#ocean').contentWindow.__bsState(), at: performance.now() }))
  const resumed = observation.state
  const resumeEvidence = { name: 'resume-resize-and-rapid-toggle', resumed, resumeWallSeconds: (observation.at - resumeAt) / 1000 }
  evidence.scenarios.push(resumeEvidence)
  assert.equal(resumed.paused, false)
  assert.equal(resumed.loopActive, true)
  assert.ok(resumed.elapsed >= paused.elapsed && resumed.elapsed - paused.elapsed <= resumeEvidence.resumeWallSeconds + .02, 'resume must not include paused wall time or move backward')
  assert.equal(resumed.renderScale, paused.renderScale, 'pause must not cause a low-FPS downscale on resume')
  assert.equal(await page.frameLocator('#ocean').locator('canvas').evaluate(canvas => canvas.width), Math.floor(720 * resumed.renderScale))
  await page.frameLocator('#ocean').locator('canvas').screenshot({ path: resolve(output, 'resumed.png') })
  await page.evaluate(() => {
    const target = document.querySelector('#ocean').contentWindow
    for (const paused of [true, false, true, false, true]) target.postMessage({ type: 'bs-pause', paused }, location.origin)
  })
  await page.waitForFunction(() => document.querySelector('#ocean').contentWindow.__bsState().paused)
  const rapid = await state(page)
  const rapidRafs = await rafs(page)
  await page.waitForTimeout(400)
  assert.equal((await state(page)).frames, rapid.frames)
  assert.equal(await rafs(page), rapidRafs, 'an earlier resume must not revive a later pause')
  resumeEvidence.rapid = rapid
  assert.deepEqual(errors, [])
  await page.close()

  const pending = await open(true)
  for (const paused of [true, false, true]) await send(pending.page, { type: 'bs-pause', paused })
  await pending.page.waitForFunction(() => document.querySelector('#ocean').contentWindow.__bsState().paused)
  assert.equal((await state(pending.page)).initialized, false)
  await pending.page.evaluate(() => document.querySelector('#ocean').contentWindow.__releaseOceanInit())
  await pending.page.waitForFunction(() => document.querySelector('#ocean').contentWindow.__bsState().initialized)
  const initialized = await state(pending.page)
  const initRafs = await rafs(pending.page)
  await pending.page.waitForTimeout(350)
  assert.equal(initialized.frames, 0, 'pause before GPU init must prevent the first render')
  assert.equal(initialized.elapsed, 0)
  assert.equal(initialized.loopActive, false)
  assert.equal(await rafs(pending.page), initRafs)
  await hidden(pending.page, true)
  await send(pending.page, { type: 'bs-pause', paused: false })
  await pending.page.waitForFunction(() => !document.querySelector('#ocean').contentWindow.__bsState().paused)
  assert.equal((await state(pending.page)).loopActive, false, 'host resume must respect hidden documents')
  await hidden(pending.page, false)
  await pending.page.frameLocator('#ocean').locator('body.ready').waitFor({ timeout: 45000 })
  const firstVisible = await state(pending.page)
  assert.ok(firstVisible.frames > 0 && firstVisible.elapsed > 0)
  assert.ok(Number.isFinite(firstVisible.elapsed), 'starting the vendored loop must never send an undefined timestamp to animate')
  assert.deepEqual(pending.errors, [])
  evidence.scenarios.push({ name: 'pause-during-initialization-and-hidden-resume', initialized, firstVisible })
  await pending.page.close()

  const showcase = await browser.newPage({ viewport: { width: 640, height: 400 } })
  const showcaseErrors = watchPageErrors(showcase, 'ocean showcase lifecycle')
  await showcase.addInitScript(() => {
    const request = window.requestAnimationFrame
    window.__oceanRafs = 0
    window.requestAnimationFrame = callback => request(time => { window.__oceanRafs++; callback(time) })
  })
  await showcase.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
  await showcase.route('**/ocean-lifecycle-showcase.html?*', route => route.fulfill({ contentType: 'text/html', body: `<html><body><div id="ui"><input id="sea-state" value="50"><output id="sea-state-value"></output><input id="time-of-day" value="55"><output id="time-label"></output><button id="drift">Drift</button></div><script type="module" src="/extension/ocean.js"></script></body></html>` }))
  await showcase.route('**/extension/ocean.js', route => route.fulfill({ contentType: 'text/javascript', body: source }))
  await showcase.goto(`${server.url}/ocean-lifecycle-showcase.html?quality=low`)
  await showcase.locator('body.ready').waitFor({ timeout: 45000 })
  const showcaseBefore = await showcase.locator('canvas').screenshot()
  const showcaseRafs = await showcase.evaluate(() => window.__oceanRafs)
  await showcase.evaluate(() => window.postMessage({ type: 'bs-pause', paused: true }, location.origin))
  await showcase.waitForTimeout(400)
  const showcaseAfter = await showcase.locator('canvas').screenshot({ path: resolve(output, 'showcase.png') })
  assert.ok(await showcase.evaluate(() => window.__oceanRafs) > showcaseRafs + 2, 'standalone showcase must ignore the skin-only pause protocol')
  assert.ok(!showcaseBefore.equals(showcaseAfter), 'standalone showcase must keep its existing animation')
  assert.deepEqual(showcaseErrors, [])
  evidence.scenarios.push({ name: 'standalone-showcase-unchanged', result: 'PASS' })
  await showcase.close()
  evidence.result = 'PASS'
  console.log(`PASS: ${evidence.scenarios.length} ocean lifecycle scenarios`)
} catch (error) {
  evidence.result = 'FAIL'
  evidence.failure = error.message
  throw error
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  await browser.close()
  await server.close()
}
