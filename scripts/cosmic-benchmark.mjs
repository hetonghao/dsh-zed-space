import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2).filter(arg => arg !== '--clock-only')
const source = await readFile(resolve(root, args[0] || 'shared/cosmos.js'), 'utf8')
const output = resolve(root, '.omo/evidence/cosmic-performance', args[1] || 'current')
await mkdir(output, { recursive: true })
const evidence = { scenarios: [] }
const clockOnly = process.argv.includes('--clock-only')
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const state = page => page.evaluate(() => window.__bsState())
const idle = page => page.waitForFunction(() => window.__bsState().idle, { }, { timeout: 15000 })
const uniform = (page, name) => page.evaluate(name => {
  const gl = document.querySelector('canvas').getContext('webgl2')
  const value = gl.getUniform(gl.getParameter(gl.CURRENT_PROGRAM), gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), name))
  return ArrayBuffer.isView(value) ? [...value] : value
}, name)
const send = (page, message) => page.evaluate(message => window.postMessage(message, location.origin), message)
async function open(query = '', options = {}, runtime = source) {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2, ...options })
  const errors = watchPageErrors(page, 'cosmic scheduling')
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame
    window.__rafCalls = 0
    window.requestAnimationFrame = callback => request(time => { window.__rafCalls++; callback(time) })
  })
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
  const shader = (await readFile(resolve(root, 'shared/skins/accretion.js'), 'utf8'))
    .replace('export function sceneParams(id, params, shared = false) {', 'export function sceneParams(id, params, shared = false) { window.__normalizations = (window.__normalizations || 0) + 1;');
  await page.route('**/extension/skins/accretion.js', route => route.fulfill({ contentType: 'text/javascript', body: shader }))
  await page.route('**/extension/cosmos.js', route => route.fulfill({ contentType: 'text/javascript', body: runtime }))
  const url = new URL(`${server.url}/extension/cosmos.html?skin=horizon&controls=shared&auto=0&spin=0`)
  for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value)
  await page.goto(url.href)
  await page.waitForFunction(() => window.__bsState?.().frames > 0)
  return { page, errors }
}
try {
  if (!clockOnly) {
  const { page, errors } = await open()
  await page.waitForTimeout(200)
  const before = await state(page)
  const rafBefore = await page.evaluate(() => window.__rafCalls)
  const imageBefore = await page.screenshot({ path: resolve(output, 'idle-before.png') })
  await page.waitForTimeout(1000)
  const after = await state(page)
  const imageAfter = await page.screenshot({ path: resolve(output, 'idle-after.png') })
  evidence.scenarios.push({ name: 'static-idle', before, after, addedFrames: after.frames - before.frames, addedRafs: await page.evaluate(() => window.__rafCalls) - rafBefore })
  assert.equal(await page.evaluate(() => window.__rafCalls), rafBefore, 'static scene must stop RAF callbacks')
  assert.equal(after.frames, before.frames, 'zero-speed static scene must stop drawing')
  assert.equal(after.paused, false, 'idle must remain distinct from explicit pause')
  assert.ok(imageBefore.equals(imageAfter), 'idle must retain its full-resolution image')
  assert.deepEqual(after.drawingBuffer, [1280, 800])
  await send(page, { type: 'bs-set', params: { glow: 35 } })
  await page.waitForFunction(() => window.__bsState().params.glow === 35 && window.__bsState().idle)
  assert.equal(await uniform(page, 'uGlow'), 35)
  assert.deepEqual((await state(page)).phases, after.phases)
  const adjusted = await page.screenshot({ path: resolve(output, 'idle-adjusted.png') })
  assert.ok(!adjusted.equals(imageAfter), 'an idle parameter edit must redraw the actual image')

  await send(page, { type: 'bs-set', params: { spin: 50 } })
  await page.waitForFunction(() => window.__bsState().params.spin === 50)
  const movingStart = await state(page)
  const normalizations = await page.evaluate(() => window.__normalizations)
  await page.waitForTimeout(500)
  const movingEnd = await state(page)
  assert.ok(movingEnd.frames > movingStart.frames + 3)
  assert.ok(movingEnd.phases[0] > movingStart.phases[0])
  assert.equal(await page.evaluate(() => window.__normalizations), normalizations, 'steady animation must not normalize parameters per RAF')
  await send(page, { type: 'bs-set', params: { spin: 0 } })
  await idle(page)
  const stopped = await state(page)
  await page.waitForTimeout(300)
  assert.equal((await state(page)).frames, stopped.frames)
  assert.deepEqual((await state(page)).phases, stopped.phases)
  evidence.scenarios.push({ name: 'parameter-and-speed-wakeup', movingStart, movingEnd, normalizationsDuringAnimation: 0, stopped })

  await send(page, { type: 'bs-set', auto: true })
  await page.waitForFunction(() => window.__bsState().autoCycle)
  const cycleStart = await state(page)
  await page.waitForTimeout(400)
  const cycleEnd = await state(page)
  assert.ok(cycleEnd.frames > cycleStart.frames + 3, 'zero spin must not stop an enabled day cycle')
  assert.deepEqual(cycleEnd.phases, stopped.phases)
  await send(page, { type: 'bs-set', auto: false })
  await idle(page)
  evidence.scenarios.push({ name: 'automatic-cycle-keeps-rendering', cycleStart, cycleEnd })

  await send(page, { type: 'bs-pointer', x: .8, y: -.4 })
  await page.waitForFunction(() => !window.__bsState().idle)
  const pointerStart = await state(page)
  await idle(page)
  const settledPointer = await uniform(page, 'uPointer')
  assert.ok(Math.abs(settledPointer[0] - .8) < 1e-6 && Math.abs(settledPointer[1] + .4) < 1e-6)
  assert.ok((await state(page)).frames > pointerStart.frames + 3, 'pointer movement must retain its easing')
  await page.waitForTimeout(1600)
  const beforeResize = await state(page)
  await page.setViewportSize({ width: 720, height: 450 })
  await page.waitForFunction(() => window.__bsState().drawingBuffer[0] === 1440)
  const resized = await state(page)
  assert.equal(resized.renderScale, beforeResize.renderScale, 'idle time must not be treated as slow rendering')
  assert.deepEqual(resized.drawingBuffer, [1440, 900])
  await page.waitForTimeout(300)
  assert.equal((await state(page)).frames, resized.frames)
  evidence.scenarios.push({ name: 'pointer-inertia-and-idle-resize', settledPointer, beforeResize, resized })

  await send(page, { type: 'bs-skin', skin: 'vortex' })
  await page.waitForFunction(() => window.__bsState().transitioning && window.__bsState().view > .1)
  const middle = await state(page)
  await idle(page)
  const transitioned = await state(page)
  assert.equal(transitioned.view, 1)
  assert.equal(transitioned.drawnSkin, 'vortex')
  assert.deepEqual(transitioned.phases, stopped.phases)
  evidence.scenarios.push({ name: 'idle-state-transition', middle, transitioned })

  const beforePulse = await page.screenshot()
  await send(page, { type: 'bs-pulse', x: 0, y: 0 })
  await page.waitForFunction(() => !window.__bsState().idle)
  await page.waitForTimeout(700)
  const pulse = await page.screenshot({ path: resolve(output, 'pulse.png') })
  assert.ok(!pulse.equals(beforePulse), 'click must animate a zero-spin scene')
  await idle(page)
  assert.equal(await uniform(page, 'uPulseAge'), -1)
  const afterPulse = await page.screenshot({ path: resolve(output, 'pulse-settled.png') })
  assert.ok(afterPulse.equals(beforePulse), 'expired pulse must return to the unchanged image')
  evidence.scenarios.push({ name: 'pulse-wakeup-and-expiry', ended: await state(page) })

  await send(page, { type: 'bs-pause', paused: true })
  await page.waitForFunction(() => window.__bsState().paused)
  const paused = await state(page)
  await send(page, { type: 'bs-set', params: { glow: 70, spin: 50 } })
  await page.waitForFunction(() => window.__bsState().params.glow === 70)
  assert.equal(await uniform(page, 'uGlow'), 70)
  await page.waitForTimeout(300)
  const editedPause = await state(page)
  assert.deepEqual(editedPause.phases, paused.phases)
  await page.waitForTimeout(200)
  assert.equal((await state(page)).frames, editedPause.frames)
  await send(page, { type: 'bs-pause', paused: false })
  await page.waitForFunction(frames => window.__bsState().frames > frames + 2, editedPause.frames)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const hidden = await state(page)
  await page.waitForTimeout(300)
  assert.equal((await state(page)).frames, hidden.frames)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction(frames => window.__bsState().frames > frames + 2, hidden.frames)
  evidence.scenarios.push({ name: 'pause-edit-resume-and-visibility-event', paused, editedPause, hidden, resumed: await state(page) })
  await page.close()
  assert.deepEqual(errors, [])

  const low = await open('spin=50', {}, source.replace('let scale = START_SCALE;', 'let scale = 0.7;'))
  await send(low.page, { type: 'bs-pause', paused: true })
  await low.page.waitForFunction(() => window.__bsState().paused)
  const degraded = await state(low.page)
  assert.equal(degraded.renderScale, .7)
  await send(low.page, { type: 'bs-set', params: { spin: 0 } })
  await low.page.waitForFunction(() => window.__bsState().params.spin === 0)
  assert.equal((await state(low.page)).renderScale, .7, 'explicit pause must retain its resolution')
  await send(low.page, { type: 'bs-pause', paused: false })
  await idle(low.page)
  const restored = await state(low.page)
  assert.equal(restored.renderScale, 1, 'idle must finish at native resolution after adaptive downscaling')
  assert.deepEqual(restored.drawingBuffer, [1280, 800])
  await low.page.waitForTimeout(1000)
  assert.equal((await state(low.page)).frames, restored.frames)
  await low.page.screenshot({ path: resolve(output, 'idle-native-restored.png') })
  assert.deepEqual(low.errors, [])
  evidence.scenarios.push({ name: 'idle-restores-native-resolution', degraded, restored })
  await low.page.close()
  }

  for (const hz of [60, 120]) for (const reduced of [false, true]) {
    const timingPage = await browser.newPage({ viewport: { width: 320, height: 200 }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
    await timingPage.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
    await timingPage.route('**/extension/cosmos.js', route => route.fulfill({ contentType: 'text/javascript', body: source }))
    await timingPage.addInitScript(() => {
      let next = 0, time = performance.now()
      const callbacks = new Map()
      window.requestAnimationFrame = callback => { callbacks.set(++next, callback); return next }
      window.cancelAnimationFrame = id => callbacks.delete(id)
      window.pumpRaf = (count, hz) => {
        for (let frame = 0; frame < count; frame++) {
          time += 1000 / hz
          const pending = [...callbacks.values()]
          callbacks.clear()
          for (const callback of pending) callback(time)
        }
      }
    })
    await timingPage.goto(`${server.url}/extension/cosmos.html?controls=shared&auto=0&spin=50`)
    await timingPage.waitForFunction(() => typeof window.__bsState === 'function')
    const observed = await timingPage.evaluate(hz => {
      window.pumpRaf(12, hz)
      const before = window.__bsState()
      window.pumpRaf(hz, hz)
      return { before, after: window.__bsState() }
    }, hz)
    const frames = observed.after.frames - observed.before.frames
    evidence.scenarios.push({ name: 'simulated-refresh-budget', hz, reduced, frames, ...observed })
    assert.equal(frames, reduced ? 20 : 30, `${hz} Hz input clock must respect the background frame budget`)
    assert.equal(observed.after.renderScale, 1)
    await timingPage.close()
  }
  evidence.result = 'PASS'
  await writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(`PASS: ${evidence.scenarios.length} scheduling scenarios`)
} catch (error) {
  evidence.result = 'FAIL'
  evidence.failure = { message: error.message, stack: error.stack }
  await writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  throw error
} finally { await browser.close(); await server.close() }
