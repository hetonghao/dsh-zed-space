import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory, setRange, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/unified-cosmos/qa')
await mkdir(output, { recursive: true })
const server = await serveDirectory(root)
const browser = await chromium.launch({
  executablePath: await findChromeForTesting(chromium.executablePath()),
  headless: process.env.BACKSPACE_HEADLESS !== '0',
  args: chromiumArgs(),
})
const capturesOnly = process.argv.includes('--capture-only')
const evidence = { command: `node scripts/cosmic-acceptance.mjs${capturesOnly ? ' --capture-only' : ''}`, scenarios: [] }

async function captureCanvas(page, canvas, path) {
  const style = await page.addStyleTag({ content: '#interface, #status, #restore, #artwork { visibility: hidden !important; }' })
  try { return await canvas.screenshot(path ? { path } : {}) }
  finally { await style.evaluate(element => element.remove()) }
}

async function canvasMetrics(page, canvas, name) {
  const image = await captureCanvas(page, canvas, resolve(output, `${name}-canvas.png`))
  return page.evaluate(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let bright = 0, dark = 0, clipped = 0, peak = 0, red = 0, blue = 0
    for (let i = 0; i < pixels.length; i += 4) {
      const value = Math.max(pixels[i], pixels[i + 1], pixels[i + 2])
      if (value > 45) bright++
      if (value < 15) dark++
      if (value > 250) clipped++
      peak = Math.max(peak, value)
      red += pixels[i]
      blue += pixels[i + 2]
    }
    const center = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data
    return { brightFraction: bright / (pixels.length / 4), darkFraction: dark / (pixels.length / 4), clippedFraction: clipped / (pixels.length / 4), redMean: red / (pixels.length / 4), blueMean: blue / (pixels.length / 4), peak, center: [...center] }
  }, `data:image/png;base64,${image.toString('base64')}`)
}

async function state(frame) { return frame.locator('body').evaluate(() => window.__bsState()) }
async function uniform(frame, name) {
  return frame.locator('canvas').evaluate((canvas, key) => {
    const gl = canvas.getContext('webgl2')
    const program = gl.getParameter(gl.CURRENT_PROGRAM)
    const value = gl.getUniform(program, gl.getUniformLocation(program, key))
    return ArrayBuffer.isView(value) ? [...value] : value
  }, name)
}

try {
  if (!capturesOnly) {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } })
    const errors = watchPageErrors(page, 'transition')
    await page.goto(`${server.url}/preview/cosmos.html?skin=horizon`)
    await page.locator('body[data-ready="true"]').waitFor({ timeout: 25000 })
    const frame = page.frameLocator('#cosmos')
    const canvas = frame.locator('canvas')
    const identity = await canvas.evaluateHandle(canvas => {
      const gl = canvas.getContext('webgl2')
      return { canvas, gl, program: gl.getParameter(gl.CURRENT_PROGRAM) }
    })
    await page.getByRole('button', { name: '调节', exact: true }).click()
    await setRange(page.locator('#glow'), 82)
    await setRange(page.locator('#spin'), 0)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(120)
    const frozen = await state(frame)
    await page.waitForTimeout(500)
    assert.deepEqual((await state(frame)).phases, frozen.phases, 'zero speed must freeze both flow phases')
    await page.locator('#view-vortex').click()
    await page.waitForFunction(() => {
      const state = document.querySelector('#cosmos').contentWindow.__bsState()
      return state.transitioning && state.view > .25 && state.view < .8
    })
    const middle = await state(frame)
    assert.equal(middle.scene, 'accretion')
    assert.equal(middle.programs, 2)
    assert.deepEqual(middle.params, frozen.params)
    assert.deepEqual(middle.phases, frozen.phases)
    await captureCanvas(page, canvas, resolve(output, 'transition-middle.png'))
    const beforeReverse = await state(frame)
    await page.locator('#view-horizon').click()
    await page.waitForFunction(() => document.querySelector('#cosmos').contentWindow.__bsState().skin === 'horizon')
    const reversed = await state(frame)
    assert.ok(Math.abs(reversed.view - beforeReverse.view) < .12, 'reversing must continue from the visible pose')
    await page.waitForTimeout(250)
    assert.ok((await state(frame)).view < reversed.view, 'reverse must travel toward horizon')
    await page.waitForFunction(() => document.querySelector('#cosmos').contentWindow.__bsState().drawnSkin === 'horizon')
    assert.equal((await state(frame)).view, 0)

    await page.locator('#view-vortex').click()
    await page.waitForFunction(() => document.querySelector('#cosmos').contentWindow.__bsState().view > .55)
    await page.evaluate(() => document.querySelector('#cosmos').contentWindow.postMessage({ type: 'bs-skin', skin: 'vortex' }, location.origin))
    await page.waitForTimeout(1250)
    const completed = await state(frame)
    assert.equal(completed.transitioning, false, 'repeating the target state must not restart its transition')
    assert.equal(completed.view, 1)
    assert.equal(completed.drawnSkin, 'vortex')
    assert.deepEqual(completed.params, frozen.params, 'shared adjustments must survive both directions')
    assert.equal(await identity.evaluate(({ canvas, gl, program }) => canvas === document.querySelector('canvas')
      && gl === canvas.getContext('webgl2') && gl.getParameter(gl.CURRENT_PROGRAM) === program), true, 'state changes must reuse the canvas, context and scene program')
    await identity.dispose()

    await page.getByRole('button', { name: '暂停', exact: true }).click()
    const beforeSpeed = await state(frame)
    await page.getByRole('button', { name: '调节', exact: true }).click()
    await setRange(page.locator('#spin'), 100)
    await page.keyboard.press('Escape')
    assert.deepEqual((await state(frame)).phases, beforeSpeed.phases, 'changing speed while paused must not jump texture phase')
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await page.waitForTimeout(600)
    const moving = await state(frame)
    assert.ok(moving.phases[0] > beforeSpeed.phases[0] && moving.phases[1] > beforeSpeed.phases[1], 'nonzero speed must resume the same flow phases')
    assert.deepEqual(errors, [])
    evidence.scenarios.push({ scenario: 'shared-scene-transition', result: 'PASS', frozen, middle, beforeReverse, reversed, completed, moving, artifact: 'transition-middle.png' })
    await page.close()

    const pausedTransition = await browser.newPage({ viewport: { width: 960, height: 640 } })
    const pausedErrors = watchPageErrors(pausedTransition, 'paused-transition-controls')
    await pausedTransition.goto(`${server.url}/preview/cosmos.html?skin=horizon`)
    await pausedTransition.locator('body[data-ready="true"]').waitFor({ timeout: 25000 })
    const pausedFrame = pausedTransition.frameLocator('#cosmos')
    await pausedTransition.locator('#view-vortex').click()
    await pausedTransition.waitForFunction(() => {
      const { view, transitioning } = document.querySelector('#cosmos').contentWindow.__bsState()
      return transitioning && view > .35 && view < .7
    })
    await pausedTransition.getByRole('button', { name: '暂停', exact: true }).click()
    await pausedTransition.waitForFunction(() => document.querySelector('#cosmos').contentWindow.__bsState().paused)
    const midPause = await state(pausedFrame)
    assert.ok(midPause.view > 0 && midPause.view < 1, 'pause must retain an intermediate pose')
    await pausedTransition.getByRole('button', { name: '调节', exact: true }).click()
    await setRange(pausedTransition.locator('#glow'), 0)
    await setRange(pausedTransition.locator('#spin'), 0)
    await pausedTransition.keyboard.press('Escape')
    await pausedTransition.waitForFunction(() => {
      const { params } = document.querySelector('#cosmos').contentWindow.__bsState()
      return params.glow === 0 && params.spin === 0
    })
    assert.equal(await uniform(pausedFrame, 'uGlow'), 0, 'shared edits must reach the actual shader immediately while paused mid-transition')
    const editedPause = await state(pausedFrame)
    assert.equal(editedPause.view, midPause.view)
    assert.deepEqual(editedPause.phases, midPause.phases)
    await pausedTransition.getByRole('button', { name: '继续', exact: true }).click()
    await pausedTransition.waitForTimeout(450)
    const resumed = await state(pausedFrame)
    assert.ok(resumed.view > midPause.view, 'resume must continue the unfinished camera movement')
    assert.deepEqual(resumed.phases, midPause.phases, 'zero speed set mid-transition must freeze both phases on resume')
    await pausedTransition.waitForFunction(() => document.querySelector('#cosmos').contentWindow.__bsState().drawnSkin === 'vortex')
    const settled = await state(pausedFrame)
    assert.equal(settled.view, 1)
    assert.deepEqual(settled.phases, midPause.phases)
    assert.equal(await uniform(pausedFrame, 'uGlow'), 0)
    await pausedTransition.getByRole('button', { name: '暂停', exact: true }).click()
    await pausedTransition.evaluate(() => document.querySelector('#cosmos').contentWindow.postMessage({ type: 'bs-pointer', x: .8, y: -.4 }, location.origin))
    await pausedTransition.waitForFunction(() => {
      const canvas = document.querySelector('#cosmos').contentDocument.querySelector('canvas')
      const gl = canvas.getContext('webgl2'), program = gl.getParameter(gl.CURRENT_PROGRAM)
      return gl.getUniform(program, gl.getUniformLocation(program, 'uPointer'))[0] > .7
    })
    const offsetPointer = await uniform(pausedFrame, 'uPointer')
    await pausedTransition.getByRole('button', { name: '重置', exact: true }).click()
    await pausedTransition.waitForFunction(() => {
      const canvas = document.querySelector('#cosmos').contentDocument.querySelector('canvas')
      const gl = canvas.getContext('webgl2'), program = gl.getParameter(gl.CURRENT_PROGRAM)
      return gl.getUniform(program, gl.getUniformLocation(program, 'uPointer')).every(value => value === 0)
    })
    const resetPointer = await uniform(pausedFrame, 'uPointer')
    assert.deepEqual(resetPointer, [0, 0], 'reset while paused must recenter the rendered camera immediately')
    const resetPaused = await state(pausedFrame)
    await pausedTransition.waitForTimeout(200)
    assert.equal((await state(pausedFrame)).frames, resetPaused.frames, 'paused pointer reset must not resume the render loop')
    assert.deepEqual(pausedErrors, [])
    evidence.scenarios.push({ scenario: 'paused-transition-live-controls-and-reset', result: 'PASS', midPause, editedPause, resumed, settled, offsetPointer, resetPointer })
    await pausedTransition.close()
  }
  for (const skin of ['horizon', 'vortex']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
    const errors = watchPageErrors(page, skin)
    await page.goto(`${server.url}/preview/cosmos.html?skin=${skin}`, { waitUntil: 'domcontentloaded' })
    await page.locator('body[data-ready="true"]').waitFor({ timeout: 25000 })
    const frame = page.frameLocator('#cosmos')
    const canvas = frame.locator('canvas')
    await canvas.waitFor({ state: 'visible' })
    await page.waitForTimeout(1000)
    const initial = await state(frame)
    assert.equal(initial.webgl2, true)
    assert.equal(initial.scene, 'accretion', 'both states must render the shared scene')
    assert.equal(initial.programs, 2, 'only one scene program plus glow may be compiled')
    assert.equal(initial.view, skin === 'horizon' ? 0 : 1)
    assert.equal(initial.drawnSkin, skin)
    assert.equal(initial.autoCycle, false)
    assert.ok(initial.frames > 1)
    const metrics = await canvasMetrics(page, canvas, `${skin}-desktop`)
    assert.ok(metrics.brightFraction > .002, `${skin}: blank/dim canvas ${JSON.stringify(metrics)}`)
    assert.ok(metrics.darkFraction > .15, `${skin}: missing dark negative space`)
    assert.ok(Math.max(...metrics.center.slice(0, 3)) < 20, `${skin}: center is not black`)
    await page.screenshot({ path: resolve(output, `${skin}-desktop.png`) })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(500)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: resolve(output, `${skin}-mobile.png`) })
    await page.getByRole('button', { name: '调节', exact: true }).click()
    assert.equal(await page.getByRole('slider').count(), 8)
    await page.screenshot({ path: resolve(output, `${skin}-mobile-controls.png`) })
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('#adjust').getAttribute('aria-expanded'), 'false')
    await page.setViewportSize({ width: 1440, height: 900 })
    if (!capturesOnly) {
      await page.getByRole('button', { name: '暂停', exact: true }).click()
      await page.waitForTimeout(150)
      let stopped = await state(frame)
      assert.equal(stopped.paused, true)
      await page.waitForTimeout(2100)
      assert.equal((await state(frame)).frames, stopped.frames)
      await page.setViewportSize({ width: 1200, height: 800 })
      await page.waitForTimeout(200)
      const resized = await state(frame)
      assert.equal(resized.paused, true)
      assert.equal(resized.renderScale, stopped.renderScale, 'paused redraw must not adapt resolution after drawing')
      assert.ok(resized.frames > stopped.frames, 'paused resize must draw the new buffer')
      const resizedMetrics = await canvasMetrics(page, canvas, `${skin}-paused-resize`)
      assert.ok(resizedMetrics.brightFraction > .002, 'paused resize must preserve visible artwork')
      await page.waitForTimeout(250)
      assert.equal((await state(frame)).frames, resized.frames, 'paused resize must not resume animation')
      evidence.scenarios.push({ skin, scenario: 'paused-resize', pauseWaitMs: 2100, result: 'PASS', before: stopped, after: resized, metrics: resizedMetrics, artifact: `${skin}-paused-resize-canvas.png` })
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.waitForTimeout(200)
      stopped = await state(frame)
      const perspective = await canvas.evaluate(canvas => {
        const gl = canvas.getContext('webgl2')
        const program = gl.getParameter(gl.CURRENT_PROGRAM)
        const initialError = gl.getError()
        const pointer = gl.getUniform(program, gl.getUniformLocation(program, 'uPointer'))
        const render = x => {
          gl.uniform2f(gl.getUniformLocation(program, 'uPointer'), x, 0)
          gl.drawArrays(gl.TRIANGLES, 0, 3)
          const pixels = new Uint8Array(canvas.width * canvas.height * 4)
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          return pixels
        }
        const left = render(-0.8), right = render(0.8)
        let changed = 0
        for (let i = 0; i < left.length; i += 4) {
          if (Math.abs(left[i] - right[i]) + Math.abs(left[i + 1] - right[i + 1]) + Math.abs(left[i + 2] - right[i + 2]) > 24) changed++
        }
        gl.uniform2fv(gl.getUniformLocation(program, 'uPointer'), pointer)
        return { changedFraction: changed / (left.length / 4), initialError, error: gl.getError() }
      })
      assert.equal(perspective.initialError, 0)
      assert.equal(perspective.error, 0)
      assert.ok(perspective.changedFraction > .03, 'viewpoint must alter geometry at a fixed animation time')
      for (const nextSkin of [skin === 'horizon' ? 'vortex' : 'horizon', skin]) {
        await page.evaluate(skin => document.querySelector('#cosmos').contentWindow.postMessage({ type: 'bs-skin', skin }, location.origin), nextSkin)
        await page.waitForFunction(skin => document.querySelector('#cosmos').contentWindow.__bsState().drawnSkin === skin, nextSkin)
        const switched = await state(frame)
        assert.equal(switched.view, nextSkin === 'horizon' ? 0 : 1)
        assert.equal(switched.transitioning, false, 'paused switching must settle without animation')
        assert.deepEqual(switched.params, initial.params, 'switching must preserve shared parameters')
        assert.equal(await canvas.evaluate(canvas => canvas.getContext('webgl2').getError()), 0)
      }
      evidence.scenarios.push({ skin, scenario: 'perspective-and-render-pipeline-switch', result: 'PASS', ...perspective })
      await page.getByRole('button', { name: '调节', exact: true }).click()
      const firstKey = skin === 'horizon' ? 'glow' : 'ring'
      const beforeEdit = await captureCanvas(page, canvas)
      await page.waitForTimeout(2100)
      await setRange(page.locator(`#${firstKey}`), 0)
      await page.waitForTimeout(100)
      assert.equal((await state(frame)).params[firstKey], 0)
      assert.equal((await state(frame)).renderScale, stopped.renderScale)
      assert.ok((await state(frame)).frames > stopped.frames, 'paused slider must redraw')
      const afterEdit = await captureCanvas(page, canvas, resolve(output, `${skin}-paused-edit.png`))
      assert.ok(!beforeEdit.equals(afterEdit), 'parameter must alter actual artwork')
      const editMetrics = await canvasMetrics(page, canvas, `${skin}-paused-edit`)
      assert.ok(editMetrics.brightFraction > .002, 'long-paused parameter change must remain visible')
      evidence.scenarios.push({ skin, scenario: 'long-paused-parameter', pauseWaitMs: 2100, result: 'PASS', scale: (await state(frame)).renderScale, metrics: editMetrics, artifact: `${skin}-paused-edit-canvas.png` })
      if (skin === 'horizon') {
        await setRange(page.locator('#glow'), 100)
        await page.waitForTimeout(100)
        const maxGlow = await canvasMetrics(page, canvas, 'horizon-max-glow')
        assert.ok(maxGlow.clippedFraction < .02, 'maximum glow must not broadly clip highlights')
        evidence.scenarios.push({ skin, scenario: 'maximum-glow', result: 'PASS', metrics: maxGlow, artifact: 'horizon-max-glow-canvas.png' })
      } else {
        await setRange(page.locator('#ring'), initial.params.ring)
        await setRange(page.locator('#warm'), 0)
        await page.waitForTimeout(100)
        const cool = await canvasMetrics(page, canvas, 'vortex-cool')
        await setRange(page.locator('#warm'), 100)
        await page.waitForTimeout(100)
        const warm = await canvasMetrics(page, canvas, 'vortex-warm')
        assert.ok(cool.blueMean > cool.redMean, 'cold palette must be visibly blue')
        assert.ok(warm.redMean > warm.blueMean, 'warm palette must be visibly warm')
        evidence.scenarios.push({ skin, scenario: 'cool-warm-palette', result: 'PASS', cool, warm, artifacts: ['vortex-cool-canvas.png', 'vortex-warm-canvas.png'] })
      }
      await page.getByRole('button', { name: '重置', exact: true }).click()
      await page.waitForTimeout(100)
      assert.deepEqual((await state(frame)).params, initial.params)
      await page.keyboard.press('Escape')
      const resumeScale = (await state(frame)).renderScale
      await page.getByRole('button', { name: '继续', exact: true }).click()
      await page.waitForTimeout(150)
      assert.equal((await state(frame)).paused, false)
      assert.equal((await state(frame)).renderScale, resumeScale, 'resuming must not count paused time as slow rendering')
      assert.ok((await state(frame)).frames > stopped.frames)
      await page.mouse.move(1152, 270)
      await page.waitForTimeout(650)
      const pointer = await uniform(frame, 'uPointer')
      assert.ok(pointer[0] > .4 && pointer[1] > .25, `pointer not delivered: ${pointer}`)
      await page.mouse.click(1100, 250)
      await page.waitForTimeout(100)
      const pulseAge = await uniform(frame, 'uPulseAge')
      assert.ok(pulseAge >= 0 && pulseAge < 1, 'click must reach rendered pulse uniform')
      await page.getByRole('button', { name: '隐藏界面', exact: true }).click()
      assert.equal(await page.locator('#hide').isVisible(), false)
      assert.equal(await page.getByRole('button', { name: '显示界面', exact: true }).isVisible(), true)
      await page.keyboard.press('h')
      assert.equal(await page.locator('#hide').isVisible(), true)
      assert.equal(await page.locator('#hide').evaluate(el => el === document.activeElement), true)
      await page.locator('#artwork').focus()
      await page.waitForTimeout(1100)
      assert.ok((await uniform(frame, 'uPulseAge')) >= 1, 'previous pulse must expire before keyboard test')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(100)
      const keyboardPulse = await uniform(frame, 'uPulseAge')
      assert.ok(keyboardPulse >= 0 && keyboardPulse < 1)
      await page.getByRole('button', { name: '重置', exact: true }).click()
      await page.mouse.move(720, 450)
      for (const moment of ['start', 'mid', 'end']) {
        await page.waitForTimeout(600)
        await captureCanvas(page, canvas, resolve(output, `${skin}-motion-${moment}.png`))
      }
      await page.emulateMedia({ colorScheme: 'light' })
      await page.screenshot({ path: resolve(output, `${skin}-desktop-light.png`) })
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForTimeout(300)
      await captureCanvas(page, canvas, resolve(output, `${skin}-1920-artwork.png`))
    }
    assert.deepEqual(errors, [])
    evidence.scenarios.push({ skin, result: 'PASS', initial, metrics, checks: capturesOnly ? ['webgl-compile', 'nonblank-canvas', 'black-center', 'desktop-mobile-layout', 'eight-shared-sliders', 'escape'] : ['webgl-compile', 'nonblank-canvas', 'black-center', 'desktop-mobile-layout', 'eight-shared-sliders', 'escape', 'pause-stops-frames', 'paused-parameter-redraw', 'reset-defaults', 'resume', 'pointer-uniform', 'pulse-uniform', 'hide-restore-keyboard'], artifacts: [`${skin}-desktop.png`, `${skin}-desktop-canvas.png`, `${skin}-mobile.png`, `${skin}-mobile-controls.png`] })
    await page.close()
    if (!capturesOnly) {
      const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: 'dark' })
      const mobileErrors = watchPageErrors(mobile, `${skin}-touch`)
      await mobile.goto(`${server.url}/preview/cosmos.html?skin=${skin}`)
      await mobile.locator('body[data-ready="true"]').waitFor({ timeout: 25000 })
      await mobile.waitForTimeout(400)
      await mobile.screenshot({ path: resolve(output, `${skin}-mobile.png`) })
      await mobile.getByRole('button', { name: '调节', exact: true }).tap()
      await mobile.screenshot({ path: resolve(output, `${skin}-mobile-controls.png`) })
      const panel = await mobile.locator('#settings').boundingBox()
      assert.ok(panel.y > 844 / 2, 'compact mobile settings must leave center clear')
      await mobile.getByRole('button', { name: '调节', exact: true }).tap()
      await mobile.touchscreen.tap(195, 300)
      await mobile.waitForTimeout(100)
      const touchPulse = await uniform(mobile.frameLocator('#cosmos'), 'uPulseAge')
      assert.ok(touchPulse >= 0 && touchPulse < 1)
      await mobile.emulateMedia({ colorScheme: 'light' })
      await mobile.screenshot({ path: resolve(output, `${skin}-mobile-light.png`) })
      assert.deepEqual(mobileErrors, [])
      evidence.scenarios.push({ skin, scenario: 'touch-mobile', result: 'PASS', viewport: '390x844', deviceScaleFactor: 2, isMobile: true, hasTouch: true, controlsTop: panel.y, artifacts: [`${skin}-mobile.png`, `${skin}-mobile-controls.png`, `${skin}-mobile-light.png`] })
      await mobile.close()
      const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
      await reduced.goto(`${server.url}/preview/cosmos.html?skin=${skin}`)
      await reduced.locator('body[data-ready="true"]').waitFor({ timeout: 25000 })
      const reducedFrame = reduced.frameLocator('#cosmos')
      const t0 = (await state(reducedFrame)).phases[0]
      await reduced.waitForTimeout(1000)
      const elapsed = (await state(reducedFrame)).phases[0] - t0
      assert.ok(elapsed > 0 && elapsed < .3, `reduced motion clock not slowed: ${elapsed}`)
      const other = skin === 'horizon' ? 'vortex' : 'horizon'
      await reduced.locator(`#view-${other}`).click()
      await reduced.waitForFunction(id => document.querySelector('#cosmos').contentWindow.__bsState().drawnSkin === id, other)
      const reducedSwitched = await state(reducedFrame)
      assert.equal(reducedSwitched.view, other === 'horizon' ? 0 : 1)
      assert.equal(reducedSwitched.transitioning, false, 'reduced motion must skip camera travel')
      await reduced.screenshot({ path: resolve(output, `${skin}-reduced-motion.png`) })
      evidence.scenarios.push({ skin, scenario: 'reduced-motion', result: 'PASS', phaseAdvanceInOneSecond: elapsed, switched: reducedSwitched, artifact: `${skin}-reduced-motion.png` })
      await reduced.close()
    }
  }
  if (!capturesOnly) {
    const legacy = await browser.newPage({ viewport: { width: 640, height: 480 } })
    const legacyErrors = watchPageErrors(legacy, 'legacy-controls')
    await legacy.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
    await legacy.goto(`${server.url}/extension/cosmos.html?skin=horizon&auto=0`)
    await legacy.waitForFunction(() => window.__bsState?.().frames > 1)
    const horizonDefaults = { glow: 70, curl: 50, hue: 0, stars: 45, drift: 30, pull: 55 }
    const vortexDefaults = { spin: 50, ring: 55, turb: 55, warm: 60, pulse: 70, parallax: 50 }
    assert.deepEqual((await legacy.evaluate(() => window.__bsState())).params, horizonDefaults)
    await legacy.evaluate(() => window.postMessage({ type: 'bs-pause', paused: true }, location.origin))
    await legacy.waitForFunction(() => window.__bsState().paused)
    for (const [skin, params] of [['vortex', { ...vortexDefaults, ring: 73 }], ['horizon', { ...horizonDefaults, hue: -25 }]]) {
      const defaults = skin === 'horizon' ? horizonDefaults : vortexDefaults
      await legacy.evaluate(({ skin, params }) => window.postMessage({ type: 'bs-skin', skin, params }, location.origin), { skin, params: defaults })
      await legacy.waitForFunction(id => window.__bsState().drawnSkin === id, skin)
      const beforeEdit = await legacy.locator('canvas').screenshot()
      await legacy.evaluate(({ skin, params }) => window.postMessage({ type: 'bs-skin', skin, params }, location.origin), { skin, params })
      await legacy.waitForFunction(expected => Object.entries(expected).every(([key, value]) => window.__bsState().params[key] === value), params)
      const afterEdit = await legacy.locator('canvas').screenshot()
      assert.equal(beforeEdit.equals(afterEdit), false, `${skin}: legacy edits must change the rendered artwork`)
      await legacy.waitForFunction(id => window.__bsState().drawnSkin === id, skin)
      const switched = await legacy.evaluate(() => window.__bsState())
      assert.deepEqual(switched.params, params, 'legacy callers must retain their existing parameter contract')
      assert.equal(switched.scene, 'accretion')
      assert.equal(switched.programs, 2)
      assert.equal(await legacy.locator('canvas').evaluate(canvas => canvas.getContext('webgl2').getError()), 0)
    }
    await legacy.evaluate(params => {
      window.postMessage({ type: 'bs-pause', paused: false }, location.origin)
      window.postMessage({ type: 'bs-skin', skin: 'vortex', params }, location.origin)
    }, vortexDefaults)
    await legacy.waitForFunction(() => {
      const { view, transitioning } = window.__bsState()
      return transitioning && view > .35 && view < .7
    })
    await legacy.evaluate(() => window.postMessage({ type: 'bs-pause', paused: true }, location.origin))
    await legacy.waitForFunction(() => window.__bsState().paused)
    const legacyPaused = await legacy.evaluate(() => window.__bsState())
    await legacy.evaluate(() => window.postMessage({ type: 'bs-set', params: { ring: 100, spin: 0 } }, location.origin))
    await legacy.waitForFunction(() => window.__bsState().params.ring === 100 && window.__bsState().params.spin === 0)
    assert.equal(await uniform(legacy, 'uRing'), 100, 'legacy edits must apply immediately during a paused transition')
    const legacyEdited = await legacy.evaluate(() => window.__bsState())
    assert.deepEqual(legacyEdited.phases, legacyPaused.phases)
    await legacy.evaluate(() => window.postMessage({ type: 'bs-pause', paused: false }, location.origin))
    await legacy.waitForTimeout(500)
    const legacyResumed = await legacy.evaluate(() => window.__bsState())
    assert.ok(legacyResumed.view > legacyPaused.view)
    assert.equal(await uniform(legacy, 'uRing'), 100, 'resuming must not blend legacy controls back toward their old values')
    assert.deepEqual(legacyResumed.phases, legacyEdited.phases, 'legacy zero speed must remain frozen after resume')
    await legacy.waitForFunction(() => window.__bsState().drawnSkin === 'vortex')
    assert.equal(await uniform(legacy, 'uRing'), 100)
    assert.deepEqual((await legacy.evaluate(() => window.__bsState())).phases, legacyEdited.phases)
    assert.deepEqual(legacyErrors, [])
    evidence.scenarios.push({ scenario: 'legacy-parameter-compatibility', result: 'PASS', horizonDefaults, vortexDefaults, midTransition: { paused: legacyPaused, edited: legacyEdited, resumed: legacyResumed } })
    await legacy.close()

    const retina = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 2 })
    const retinaErrors = watchPageErrors(retina, 'retina')
    await retina.goto(`${server.url}/preview/cosmos.html?skin=vortex`)
    await retina.locator('body[data-ready="true"]').waitFor({ timeout: 25000 })
    const retinaFrame = retina.frameLocator('#cosmos')
    const native = await state(retinaFrame)
    assert.deepEqual(native.drawingBuffer, [1920, 1280], 'Retina must start at native pixel density')
    await retina.getByRole('button', { name: '暂停', exact: true }).click()
    await retina.setViewportSize({ width: 3840, height: 2160 })
    await retina.waitForTimeout(200)
    const large = await state(retinaFrame)
    assert.ok(large.drawingBuffer[0] * large.drawingBuffer[1] <= 6_000_000, 'large screens must respect the GPU pixel budget')
    assert.deepEqual(retinaErrors, [])
    evidence.scenarios.push({ scenario: 'retina-and-pixel-budget', result: 'PASS', native, large })
    await retina.close()

    const recovery = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 2 })
    const source = await readFile(resolve(root, 'extension/cosmos.js'), 'utf8')
    const reducedScaleSource = source.replace('let scale = START_SCALE;', 'let scale = 0.7;')
    assert.notEqual(source, reducedScaleSource)
    await recovery.route('**/extension/cosmos.js', route => route.fulfill({ contentType: 'text/javascript', body: reducedScaleSource }))
    await recovery.goto(`${server.url}/preview/cosmos.html?skin=vortex`)
    await recovery.locator('body[data-ready="true"]').waitFor({ timeout: 25000 })
    const recoveryFrame = recovery.frameLocator('#cosmos')
    const initialRecovery = await state(recoveryFrame)
    await recovery.waitForTimeout(4800)
    const recovered = await state(recoveryFrame)
    assert.ok(recovered.renderScale > initialRecovery.renderScale + .04, 'quality must recover when rendering is fast enough')
    evidence.scenarios.push({ scenario: 'resolution-recovery', result: 'PASS', initial: initialRecovery, recovered })
    await recovery.close()

    const unavailable = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await unavailable.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === 'webgl2' ? null : original.call(this, kind, ...args)
      }
    })
    await unavailable.goto(`${server.url}/preview/cosmos.html?skin=horizon`)
    await unavailable.getByRole('button', { name: '重新加载', exact: true }).waitFor()
    assert.match(await unavailable.getByRole('status').innerText(), /WebGL2 unavailable/)
    assert.equal(await unavailable.locator('#pause').isDisabled(), true)
    await unavailable.screenshot({ path: resolve(output, 'webgl-unavailable.png') })
    evidence.scenarios.push({ scenario: 'webgl-unavailable', result: 'PASS', observable: 'readable error, retry action and disabled renderer controls', artifact: 'webgl-unavailable.png' })
    await unavailable.close()
  }
  evidence.result = 'PASS'
} catch (error) {
  evidence.result = 'FAIL'
  evidence.error = error.stack
  throw error
} finally {
  await writeFile(resolve(output, capturesOnly ? 'capture-results.json' : 'acceptance-results.json'), JSON.stringify(evidence, null, 2))
  await browser.close()
  await server.close()
}
console.log(JSON.stringify(evidence, null, 2))
