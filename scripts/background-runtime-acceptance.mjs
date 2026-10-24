import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/work-background/runtime')
await mkdir(output, { recursive: true })
const source = await readFile(resolve(root, process.argv[2] || 'shared/cosmos.js'), 'utf8')
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const results = []
const state = page => page.evaluate(() => window.__bsState())
const send = (page, data) => page.evaluate(data => window.postMessage(data, location.origin), data)
try {
  for (const skin of ['horizon', 'vortex']) {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 })
    const errors = watchPageErrors(page, 'working-background')
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
    await page.route('**/extension/cosmos.js', route => route.fulfill({ contentType: 'text/javascript', body: source }))
    await page.goto(`${server.url}/extension/cosmos.html?skin=${skin}&controls=shared&preview=0&auto=1&spin=50`)
    await page.waitForFunction(() => window.__bsState?.().frames > 1)
    const begin = await state(page)
    const beforeImage = await page.screenshot()
    await page.waitForTimeout(2000)
    const working = await state(page)
    const workingImage = await page.screenshot({ path: resolve(output, `${skin}-working.png`) })
    const backgroundFrames = working.frames - begin.frames
    assert.ok(backgroundFrames >= 16 && backgroundFrames <= 24, `日常背景两秒应绘制约20帧，实际${backgroundFrames}`)
    assert.equal(working.preview, false)
    assert.equal(working.frameCap, 10)
    assert.equal(working.renderScale, 1, 'low refresh must not cause adaptive loss of precision')
    assert.deepEqual(working.drawingBuffer, [1280, 800])
    assert.ok(working.phases[0] > begin.phases[0], 'normal background must remain animated')
    assert.ok(!beforeImage.equals(workingImage), 'normal background must change actual pixels')
    await send(page, { type: 'bs-preview', active: true })
    await page.waitForFunction(() => window.__bsState().preview)
    const previewStart = await state(page)
    await page.waitForTimeout(2000)
    const previewEnd = await state(page)
    const previewFrames = previewEnd.frames - previewStart.frames
    assert.ok(previewFrames >= 48 && previewFrames <= 64, `完整预览两秒应约60帧，实际${previewFrames}`)
    assert.equal(previewEnd.frameCap, 30)
    assert.equal(previewEnd.renderScale, 1, 'opening settings must reset the adaptation window')
    const slowPhase = working.phases[0] - begin.phases[0]
    const fullPhase = previewEnd.phases[0] - previewStart.phases[0]
    assert.ok(fullPhase > slowPhase * .75 && fullPhase < slowPhase * 1.25, 'background must preserve the configured flow speed in real time')
    assert.deepEqual(previewEnd.params, working.params, 'performance mode must not overwrite user preferences')

    const target = skin === 'horizon' ? 'vortex' : 'horizon'
    await send(page, { type: 'bs-skin', skin: target })
    await page.waitForFunction(() => window.__bsState().transitioning && window.__bsState().view > .1 && window.__bsState().view < .9)
    await send(page, { type: 'bs-preview', active: false })
    await page.waitForFunction(() => !window.__bsState().preview)
    const closing = await state(page)
    assert.equal(closing.frameCap, 30, 'closing settings must let an in-progress transition finish smoothly')
    await page.waitForFunction(() => !window.__bsState().transitioning)
    const settled = await state(page)
    assert.equal(settled.drawnSkin, target)
    assert.equal(settled.frameCap, 10)
    await page.waitForTimeout(1800)
    assert.equal((await state(page)).renderScale, 1)
    await send(page, { type: 'bs-pointer', x: .7, y: -.2 })
    await page.waitForFunction(() => window.__bsState().frameCap === 30)
    await page.waitForFunction(() => window.__bsState().frameCap === 10)
    const pointerUniform = await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2'), program = gl.getParameter(gl.CURRENT_PROGRAM)
      return [...gl.getUniform(program, gl.getUniformLocation(program, 'uPointer'))]
    })
    assert.ok(Math.abs(pointerUniform[0] - .7) < 1e-5 && Math.abs(pointerUniform[1] + .2) < 1e-5)
    await send(page, { type: 'bs-pulse', x: 0, y: 0 })
    await page.waitForFunction(() => window.__bsState().frameCap === 30)
    await page.waitForFunction(() => window.__bsState().frameCap === 10)
    const pulseAge = await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2'), program = gl.getParameter(gl.CURRENT_PROGRAM)
      return gl.getUniform(program, gl.getUniformLocation(program, 'uPulseAge'))
    })
    assert.ok(pulseAge >= 2 && pulseAge < 4, 'lower refresh must preserve the still-visible ripple, not truncate it')

    await send(page, { type: 'bs-pause' , paused: true })
    await page.waitForFunction(() => window.__bsState().paused)
    const paused = await state(page)
    const backgroundFrozen = await page.screenshot()
    await send(page, { type: 'bs-preview', active: true })
    await page.waitForTimeout(250)
    assert.equal((await state(page)).frames, paused.frames, 'mode changes must not wake a host-paused renderer')
    await send(page, { type: 'bs-set', params: paused.params })
    await page.waitForFunction(frames => window.__bsState().frames > frames, paused.frames)
    assert.ok(backgroundFrozen.equals(await page.screenshot()), 'same configured state must produce identical pixels in work and preview modes')
    await send(page, { type: 'bs-pause', paused: false })
    await page.waitForFunction(frames => window.__bsState().frames > frames, paused.frames)
    assert.deepEqual(errors, [])
    results.push({ skin, result: 'PASS', backgroundFrames, previewFrames, begin, working, previewStart, previewEnd, closing, settled, pointerUniform, pulseAge, frozenPixelsEqual: true })
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 320, height: 200 }, reducedMotion: 'reduce' })
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
  await page.route('**/extension/cosmos.js', route => route.fulfill({ contentType: 'text/javascript', body: source }))
  await page.goto(`${server.url}/extension/cosmos.html?preview=0&controls=shared&spin=50&auto=0`)
  await page.waitForFunction(() => window.__bsState?.().frames > 1)
  assert.equal((await state(page)).frameCap, 5)
  await send(page, { type: 'bs-preview', active: true })
  await page.waitForFunction(() => window.__bsState().frameCap === 20)
  await page.close()
  results.push({ scenario: 'reduced-motion-mode-budget', result: 'PASS' })
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`PASS: ${results.length} continuous background scenarios`)
} finally { await browser.close(); await server.close() }
