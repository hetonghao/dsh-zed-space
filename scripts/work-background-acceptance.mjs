import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/work-background/integration')
await mkdir(output, { recursive: true })
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 })
const errors = watchPageErrors(page, 'dsh-working-background')
const seed = { glow: 85, ring: 62, turb: 60, warm: 57, spin: 70, stars: 67, parallax: 55, pulse: 70 }
const frameState = id => page.locator(`#${id}`).evaluate(frame => frame.contentWindow.__bsState())
const cosmicId = '__dsh-backspace-cosmos__', oceanId = '__dsh-backspace__'
const panelId = '__dsh-backspace-panel__'
try {
  await page.addInitScript(() => {
    const request = requestAnimationFrame
    window.__rafCalls = 0
    window.requestAnimationFrame = callback => request(time => { window.__rafCalls++; callback(time) })
  })
  for (const file of ['cosmos.js', 'ocean.js']) {
    const body = await readFile(resolve(root, 'shared', file), 'utf8')
    await page.route(`**/extension/${file}`, route => route.fulfill({ contentType: 'text/javascript', body }))
  }
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.addScriptTag({ content: await readFile(resolve(root, 'shared/skin-core.js'), 'utf8') })
  await page.evaluate(async seed => {
    window.controller = BackspaceSkinCore.createController({
      assetUrl: path => `/extension/${path}`,
      storage: { get: async defaults => ({ ...defaults, skin: 'ocean', autoCycle: true, p: { cosmos: seed } }), set: async () => {} },
    })
    await controller.start()
  }, seed)
  await page.waitForFunction(id => document.getElementById(id)?.contentWindow.__bsState?.().frames > 1, oceanId, { timeout: 30000 })
  const oceanIdentity = await page.locator(`#${oceanId}`).evaluateHandle(frame => frame)
  await page.locator('#__dsh-backspace-btn__').click()
  await page.locator('[data-skin=horizon]').click()
  await page.waitForFunction(id => document.getElementById(id)?.contentWindow.__bsState?.().frames > 1, cosmicId, { timeout: 30000 })
  await page.waitForFunction(id => document.getElementById(id).contentWindow.__bsState().paused, oceanId)
  const oceanStopped = await frameState(oceanId)
  const oceanRafs = await page.locator(`#${oceanId}`).evaluate(frame => frame.contentWindow.__rafCalls)
  await page.waitForTimeout(700)
  assert.equal((await frameState(oceanId)).frames, oceanStopped.frames)
  assert.equal((await frameState(oceanId)).elapsed, oceanStopped.elapsed)
  assert.equal(await page.locator(`#${oceanId}`).evaluate(frame => frame.contentWindow.__rafCalls), oceanRafs)
  assert.equal((await frameState(cosmicId)).preview, true)
  const cosmicIdentity = await page.locator(`#${cosmicId}`).evaluateHandle(frame => frame)
  await page.locator(`#${panelId} .bs-close`).click()
  await page.waitForFunction(id => !document.getElementById(id), oceanId)
  await page.waitForFunction(id => document.getElementById(id).contentWindow.__bsState().frameCap === 10, cosmicId)

  await page.evaluate(() => {
    const log = document.createElement('div'); log.id = 'working-messages';
    log.style.cssText = 'position:fixed;right:0;top:0;width:50%;height:70%;overflow:auto;pointer-events:auto'
    const input = document.createElement('textarea'); input.id = 'working-input'; log.append(input)
    document.body.append(log); input.focus()
    window.__placementWrites = 0
    const button = document.querySelector('#__dsh-backspace-btn__')
    new MutationObserver(records => { window.__placementWrites += records.length }).observe(button, { attributes: true, attributeFilter: ['style'] })
  })
  const workingStart = await frameState(cosmicId)
  await page.keyboard.type('正常输入消息，持续保留已配置的动态背景。', { delay: 25 })
  await page.evaluate(async () => {
    const log = document.getElementById('working-messages')
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('p'); p.textContent = `流式回复 ${i}`; log.append(p)
      log.scrollTop = log.scrollHeight
      await new Promise(resolve => setTimeout(resolve, 75))
    }
  })
  const workingEnd = await frameState(cosmicId)
  assert.ok(workingEnd.frames - workingStart.frames >= 12 && workingEnd.frames - workingStart.frames <= 30)
  assert.ok(workingEnd.phases[0] > workingStart.phases[0], 'the selected background must keep moving while typing and scrolling')
  assert.deepEqual(workingEnd.params, seed)
  assert.equal(workingEnd.renderScale, 1)
  assert.equal(await page.evaluate(() => window.__placementWrites), 0)
  assert.equal(await page.locator('iframe').count(), 1, 'normal work must retain only the selected renderer')
  await page.screenshot({ path: resolve(output, 'working.png') })

  await page.locator('#__dsh-backspace-btn__').click()
  await page.locator('[data-skin=vortex]').click()
  await page.waitForFunction(id => document.getElementById(id).contentWindow.__bsState().drawnSkin === 'vortex', cosmicId)
  assert.equal(await cosmicIdentity.evaluate(frame => frame === document.getElementById('__dsh-backspace-cosmos__')), true)
  await page.locator('[data-skin=ocean]').click()
  await page.waitForFunction(id => document.getElementById(id)?.contentWindow.__bsState?.().frames > 1, oceanId, { timeout: 30000 })
  assert.equal(await oceanIdentity.evaluate(frame => frame === document.getElementById('__dsh-backspace__')), false)
  assert.equal((await frameState(cosmicId)).paused, true)
  await page.locator(`#${panelId} .bs-close`).click()
  await page.waitForFunction(id => !document.getElementById(id), cosmicId)
  await page.locator('#__dsh-backspace-btn__').click()
  await page.locator('[data-skin=horizon]').click()
  await page.waitForFunction(id => document.getElementById(id)?.contentWindow.__bsState?.().frames > 1, cosmicId, { timeout: 30000 })
  assert.deepEqual((await frameState(cosmicId)).params, seed)
  assert.equal(await cosmicIdentity.evaluate(frame => frame === document.getElementById('__dsh-backspace-cosmos__')), false)
  await page.locator(`#${panelId} .bs-close`).click()
  await page.waitForFunction(id => !document.getElementById(id), oceanId)
  await page.evaluate(() => controller.stop())
  assert.equal(await page.locator('iframe').count(), 0)
  assert.deepEqual(errors, [])
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ result: 'PASS', oceanStopped, oceanRafs, workingStart, workingEnd, placementWrites: 0, retainedRenderers: 1, rebuiltParameters: seed, cleanupFrames: 0 }, null, 2))
  console.log('PASS: real ocean/cosmos lifecycle, normal typing/streaming/scrolling, parameter-preserving rebuild')
} finally { await browser.close(); await server.close() }
