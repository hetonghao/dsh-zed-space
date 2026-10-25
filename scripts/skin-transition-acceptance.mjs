import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, setRange, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(process.argv[2] || root)
const output = resolve(root, '.scratch/skin-transition')
await mkdir(output, { recursive: true })
const core = await readFile(resolve(sourceRoot, 'shared/skin-core.js'), 'utf8')
const runtimes = Object.fromEntries(await Promise.all(['ocean', 'cosmos'].map(async name => [name, await readFile(resolve(sourceRoot, `shared/${name}.js`), 'utf8')])))
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const cosmicId = '__dsh-backspace-cosmos__', oceanId = '__dsh-backspace__'
const panelId = '__dsh-backspace-panel__', buttonId = '__dsh-backspace-btn__'
const seed = { glow: 81, ring: 62, turb: 37, warm: 69, spin: 50, stars: 63, parallax: 55, pulse: 70 }
const results = []
const record = scenario => { results.push(scenario); console.log(`PASS: ${scenario.scenario}`) }
let lastPage, lastErrors
const state = page => page.evaluate(() => controller.getTransitionState())
const renderer = (page, id) => page.locator(`#${id}`).evaluate(frame => frame.contentWindow.__bsState())
const select = (page, skin) => page.locator(`[data-skin="${skin}"]`).click()
const frames = page => page.locator(`iframe[id="${cosmicId}"], iframe[id="${oceanId}"]`)
const waitPhase = (page, phase) => page.waitForFunction(phase => controller.getTransitionState().phase === phase, phase, { timeout: 30000 })
const settled = (page, skin) => page.waitForFunction(({ skin, cosmicId }) => {
  const transition = controller.getTransitionState()
  const cosmic = document.getElementById(cosmicId)?.contentWindow.__bsState?.()
  return transition.phase === 'idle' && transition.visible === skin && transition.frameCount === 1
    && (skin === 'ocean' || (cosmic?.drawnSkin === skin && !cosmic.transitioning))
}, { skin, cosmicId }, { timeout: 30000 })
const capture = (page, name) => page.screenshot({ path: resolve(output, `${name}.png`) })

async function boot(skin = 'horizon', reducedMotion = 'no-preference', enabled = true) {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, reducedMotion })
  const errors = watchPageErrors(page, 'skin transition')
  lastPage = page
  lastErrors = errors
  await page.addInitScript(() => {
    if (window !== window.top) return
    window.__holdReady = false
    window.__heldReady = []
    addEventListener('message', event => {
      if (__holdReady && event.isTrusted && event.data?.type === 'bs-frame-ready') {
        __heldReady.push({ data: event.data, source: event.source, origin: event.origin, state: event.source.__bsState?.() })
        event.stopImmediatePropagation()
      }
    }, true)
  })
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
  for (const [name, body] of Object.entries(runtimes)) await page.route(`**/extension/${name}.js*`, route => route.fulfill({ contentType: 'text/javascript', body }))
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.addScriptTag({ content: core })
  await page.evaluate(async ({ skin, seed, enabled }) => {
    let stored = { ...BackspaceSkinCore.DEFAULTS, skin, enabled, autoCycle: false, p: { cosmos: seed } }
    let listener
    window.getStored = () => stored
    window.updateStored = patch => { stored = { ...stored, ...patch }; listener?.(patch) }
    window.controller = BackspaceSkinCore.createController({
      assetUrl: path => `/extension/${path}`,
      storage: { get: async () => stored, set: async patch => { stored = { ...stored, ...patch } } },
      listen: callback => { listener = callback; return () => { listener = null } },
    })
    await controller.start()
  }, { skin, seed, enabled })
  return { page, errors }
}

async function openPanel(page) {
  if (await page.locator(`#${buttonId}`).getAttribute('aria-expanded') !== 'true') await page.locator(`#${buttonId}`).click()
}

async function freezeFade(page, currentTime = 180) {
  return page.evaluate(async currentTime => {
    const animation = document.getAnimations().find(animation => animation.effect?.target instanceof HTMLIFrameElement)
    if (!animation) throw new Error('交叠动画未创建')
    animation.pause()
    await animation.ready
    animation.currentTime = currentTime
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    window.__testFade = animation
    return { duration: animation.effect.getTiming().duration, opacity: Number(getComputedStyle(animation.effect.target).opacity) }
  }, currentTime)
}

try {
  const { page, errors } = await boot()
  await page.waitForFunction(id => document.getElementById(id)?.contentWindow.__bsState?.().frames > 0, cosmicId)
  await openPanel(page)

  // 故意拦住新页面加载：旧实现会立刻将当前画面缩到 1px，这条断言必须失败。
  let releaseOcean
  const oceanGate = new Promise(resolve => { releaseOcean = resolve })
  await page.route('**/extension/skin.html?*', async route => { await oceanGate; await route.continue() })
  await select(page, 'ocean')
  const retained = await page.locator(`#${cosmicId}`).evaluate(frame => ({ opacity: getComputedStyle(frame).opacity, width: frame.clientWidth, height: frame.clientHeight }))
  assert.deepEqual(retained, { opacity: '1', width: 900, height: 600 }, '目标首帧未就绪时，旧画面必须保持全尺寸且不透明')
  record({ scenario: 'prepare-keeps-current-full-size-frame', result: 'PASS', retained })
  releaseOcean()
  await page.unroute('**/extension/skin.html?*')
  await waitPhase(page, 'crossfade')
  const fade = await freezeFade(page)
  assert.equal(fade.duration, 550)
  assert.ok(fade.opacity > 0 && fade.opacity < 1)
  await page.waitForFunction(id => document.getElementById(id).contentWindow.__bsState().paused, cosmicId)
  const stopped = await renderer(page, cosmicId)
  await page.waitForTimeout(180)
  assert.equal((await renderer(page, cosmicId)).frames, stopped.frames)
  assert.equal((await renderer(page, cosmicId)).phases[0], stopped.phases[0])
  await capture(page, 'crossfade-middle')
  await page.locator(`#${panelId} .bs-close`).click()
  assert.equal(await frames(page).count(), 2, '关闭面板不能提前删除尚在交叠的旧帧')
  await page.evaluate(() => __testFade.play())
  await settled(page, 'ocean')
  assert.equal(await frames(page).count(), 1)
  record({ scenario: 'crossfade-freezes-old-and-cleans-up-after-panel-close', result: 'PASS', fade, stopped })

  await openPanel(page)
  await select(page, 'horizon')
  await waitPhase(page, 'crossfade')
  await freezeFade(page, 260)
  const beforeResize = await renderer(page, oceanId)
  await page.setViewportSize({ width: 960, height: 640 })
  await page.waitForFunction(({ oceanId, cosmicId, frames }) => {
    const old = document.getElementById(oceanId), next = document.getElementById(cosmicId)
    return old.clientWidth === 960 && next.clientWidth === 960 && old.contentWindow.__bsState().frames > frames
  }, { oceanId, cosmicId, frames: beforeResize.frames })
  assert.equal((await renderer(page, oceanId)).paused, true)
  await capture(page, 'crossfade-resize')
  await page.evaluate(() => __testFade.play())
  await settled(page, 'horizon')
  const identity = await page.locator(`#${cosmicId}`).evaluateHandle(frame => frame)
  await select(page, 'vortex')
  await page.waitForFunction(id => {
    const current = document.getElementById(id).contentWindow.__bsState()
    return current.transitioning && current.view > .1 && current.view < .9
  }, cosmicId)
  assert.equal(await identity.evaluate(frame => frame === document.getElementById('__dsh-backspace-cosmos__')), true)
  assert.equal(await frames(page).count(), 1)
  assert.equal(await page.locator(`#${cosmicId}`).evaluate(frame => frame.getAnimations().length), 0)
  assert.equal((await state(page)).route, 'native')
  await settled(page, 'vortex')
  assert.deepEqual((await renderer(page, cosmicId)).params, seed)
  record({ scenario: 'resize-repaints-frozen-frame-and-native-view-bypasses-crossfade', result: 'PASS' })
  await capture(page, 'vortex-complete')

  await select(page, 'ocean')
  await waitPhase(page, 'crossfade')
  const beforeReverse = await freezeFade(page, 220)
  await select(page, 'horizon')
  const afterReverse = await page.evaluate(() => Number(getComputedStyle(document.getElementById('__dsh-backspace__')).opacity))
  assert.ok(afterReverse <= beforeReverse.opacity + .03, '反向交叠不能先跳到目标全显')
  await select(page, 'ocean')
  await select(page, 'vortex')
  await settled(page, 'vortex')
  assert.equal(await frames(page).count(), 1)
  record({ scenario: 'rapid-reversal-keeps-current-blend-and-last-selection-wins', result: 'PASS', beforeReverse, afterReverse })

  await select(page, 'ocean')
  await settled(page, 'ocean')
  await page.evaluate(() => { __holdReady = true; __heldReady = [] })
  await select(page, 'horizon')
  await page.waitForFunction(() => __heldReady.length > 0)
  assert.equal((await state(page)).phase, 'preparing')
  await page.evaluate(() => {
    const held = __heldReady[0]
    for (const event of [
      { source: window, origin: held.origin, data: held.data },
      { source: held.source, origin: 'https://untrusted.invalid', data: held.data },
      { ...held, data: { ...held.data, requestId: held.data.requestId + 1000 } },
    ]) dispatchEvent(new MessageEvent('message', event))
  })
  assert.equal((await state(page)).phase, 'preparing', '伪造来源、origin、requestId 不得确认首帧')
  await select(page, 'vortex')
  await setRange(page.locator(`#${panelId}-cosmos-glow-range`), 32)
  await page.waitForFunction(() => __heldReady.some(item => item.data.requestId !== __heldReady[0].data.requestId))
  await page.evaluate(() => dispatchEvent(new MessageEvent('message', __heldReady[0])))
  assert.equal((await state(page)).phase, 'preparing', '旧请求迟到的首帧不能覆盖新选择')
  await page.waitForFunction(id => {
    const current = document.getElementById(id).contentWindow.__bsState()
    return current.drawnSkin === 'vortex' && current.params.glow === 32
  }, cosmicId)
  await page.waitForFunction(() => __heldReady.some(item => item.state?.drawnSkin === 'vortex' && item.state.params.glow === 32))
  await page.evaluate(() => { __holdReady = false; dispatchEvent(new MessageEvent('message', __heldReady.findLast(item => item.state?.drawnSkin === 'vortex' && item.state.params.glow === 32))) })
  await settled(page, 'vortex')
  assert.equal((await renderer(page, cosmicId)).params.glow, 32)
  record({ scenario: 'latest-configured-first-frame-and-message-trust-boundary', result: 'PASS' })

  await select(page, 'ocean')
  await waitPhase(page, 'crossfade')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction(({ cosmicId, oceanId }) => [cosmicId, oceanId].every(id => document.getElementById(id).contentWindow.__bsState().paused), { cosmicId, oceanId })
  const hiddenFrames = await frames(page).evaluateAll(nodes => nodes.map(frame => frame.contentWindow.__bsState().frames))
  const hiddenTime = await page.evaluate(() => document.getAnimations().find(a => a.effect?.target instanceof HTMLIFrameElement)?.currentTime)
  await page.waitForTimeout(250)
  assert.deepEqual(await frames(page).evaluateAll(nodes => nodes.map(frame => frame.contentWindow.__bsState().frames)), hiddenFrames)
  assert.equal(await page.evaluate(() => document.getAnimations().find(a => a.effect?.target instanceof HTMLIFrameElement)?.currentTime), hiddenTime)
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) })
  await settled(page, 'ocean')
  record({ scenario: 'document-visibility-pauses-renderers-and-compositor', result: 'PASS', hiddenFrames })

  await select(page, 'horizon')
  await settled(page, 'horizon')
  await page.locator(`#${panelId} .bs-close`).click()
  await page.waitForFunction(id => document.getElementById(id).contentWindow.__bsState().frameCap === 10, cosmicId)
  const workingBefore = await renderer(page, cosmicId)
  await page.waitForTimeout(1200)
  const workingAfter = await renderer(page, cosmicId)
  assert.ok(workingAfter.frames - workingBefore.frames >= 8 && workingAfter.frames - workingBefore.frames <= 16)
  assert.equal(workingAfter.renderScale, 1)
  assert.deepEqual(workingAfter.drawingBuffer, [960, 640])
  assert.deepEqual(workingAfter.params, { ...seed, glow: 32 })
  record({ scenario: 'steady-state-restores-native-resolution-and-background-budget', result: 'PASS', frames: workingAfter.frames - workingBefore.frames })

  await openPanel(page)
  await page.route('**/extension/skin.html?*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await select(page, 'ocean')
  await page.waitForFunction(() => Boolean(controller.getTransitionState().error), null, { timeout: 12000 })
  assert.equal((await state(page)).visible, 'horizon')
  assert.equal(await page.evaluate(() => controller.getState().skin), 'horizon')
  assert.equal(await frames(page).count(), 1)
  assert.equal((await renderer(page, cosmicId)).paused, false)
  await page.unroute('**/extension/skin.html?*')
  record({ scenario: 'first-frame-timeout-retains-old-scene-and-selection', result: 'PASS' })

  await select(page, 'ocean')
  await waitPhase(page, 'crossfade')
  await freezeFade(page)
  await page.locator(`#${panelId}-enabled`).uncheck()
  assert.equal(await frames(page).count(), 0)
  assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.effect?.target instanceof HTMLIFrameElement).length), 0)
  await page.locator(`#${panelId}-enabled`).check()
  await settled(page, 'ocean')

  await select(page, 'horizon')
  await waitPhase(page, 'crossfade')
  await freezeFade(page, 240)
  await select(page, 'ocean')
  await page.frameLocator(`#${oceanId}`).locator('body').evaluate(() => parent.postMessage({ type: 'bs-surface-error', surface: 'ocean', reason: '验收：反向交叠的基底失效' }, location.origin))
  await settled(page, 'horizon')
  const promoted = await page.evaluate(() => ({
    visible: controller.getTransitionState().visible,
    current: controller.getState().skin,
    stored: getStored().skin,
    selected: document.querySelector('[data-skin][aria-selected="true"]').dataset.skin,
  }))
  assert.deepEqual(promoted, { visible: 'horizon', current: 'horizon', stored: 'horizon', selected: 'horizon' })
  const promotedFrames = (await renderer(page, cosmicId)).frames
  await page.waitForFunction(({ cosmicId, promotedFrames }) => {
    const current = document.getElementById(cosmicId).contentWindow.__bsState()
    return !current.paused && current.frames > promotedFrames
  }, { cosmicId, promotedFrames })
  record({ scenario: 'failed-base-promotes-incoming-and-restores-selection-storage-ui', result: 'PASS', promoted })
  await page.evaluate(() => controller.stop())
  assert.equal(await frames(page).count(), 0)
  assert.deepEqual(errors, [])
  record({ scenario: 'disable-and-stop-release-animation-and-both-frames', result: 'PASS' })
  await page.close()

  const reduced = await boot('horizon', 'reduce')
  await settled(reduced.page, 'horizon')
  await openPanel(reduced.page)
  await select(reduced.page, 'ocean')
  await waitPhase(reduced.page, 'crossfade')
  const shortFade = await freezeFade(reduced.page, 40)
  assert.equal(shortFade.duration, 150)
  await reduced.page.evaluate(() => __testFade.play())
  await settled(reduced.page, 'ocean')
  assert.deepEqual(reduced.errors, [])
  await reduced.page.close()
  record({ scenario: 'reduced-motion-short-crossfade', result: 'PASS', duration: shortFade.duration })

  const duplicate = await boot('horizon', 'no-preference', false)
  assert.equal(await frames(duplicate.page).count(), 0)
  const originalButton = await duplicate.page.locator(`#${buttonId}`).evaluateHandle(button => button)
  await duplicate.page.evaluate(async () => {
    let stored = { ...BackspaceSkinCore.DEFAULTS, skin: 'ocean', enabled: true, autoCycle: true }
    let listener
    window.updateDuplicateStored = patch => { stored = { ...stored, ...patch }; listener?.(patch) }
    window.duplicateController = BackspaceSkinCore.createController({
      assetUrl: path => `/extension/${path}`,
      storage: { get: async () => stored, set: async patch => { stored = { ...stored, ...patch } } },
      listen: callback => { listener = callback; return () => { listener = null } },
    })
    await duplicateController.start()
  })
  assert.equal(await frames(duplicate.page).count(), 0, '重复入口不能在先占 UI 的控制器尚禁用时创建无人握手的帧')
  assert.equal((await duplicate.page.evaluate(() => duplicateController.getTransitionState())).frameCount, 0)
  await openPanel(duplicate.page)
  await duplicate.page.locator(`#${panelId}-enabled`).check()
  await settled(duplicate.page, 'horizon')
  const beforeDuplicateUpdate = await duplicate.page.evaluate(cosmicId => {
    const frame = document.getElementById(cosmicId)
    frame.contentWindow.__duplicateMessages = []
    frame.contentWindow.addEventListener('message', event => frame.contentWindow.__duplicateMessages.push(event.data))
    return document.getElementById(BackspaceSkinCore.IDS.glass).textContent
  }, cosmicId)
  await duplicate.page.evaluate(async () => {
    updateDuplicateStored({ skin: 'vortex', enabled: false, glass: 90, p: { cosmos: { glow: 2, ring: 3, turb: 4, warm: 5, spin: 6, stars: 7, parallax: 8, pulse: 9 } } })
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  assert.deepEqual((await renderer(duplicate.page, cosmicId)).params, seed)
  assert.deepEqual(await duplicate.page.locator(`#${cosmicId}`).evaluate(frame => frame.contentWindow.__duplicateMessages), [], '重复入口的外部配置更新不能向已占用的渲染器发消息')
  assert.equal(await duplicate.page.evaluate(() => document.getElementById(BackspaceSkinCore.IDS.glass).textContent), beforeDuplicateUpdate)
  await duplicate.page.evaluate(() => duplicateController.stop())
  assert.equal(await frames(duplicate.page).count(), 1)
  assert.equal(await originalButton.evaluate(button => button === document.getElementById('__dsh-backspace-btn__')), true)
  await select(duplicate.page, 'vortex')
  await settled(duplicate.page, 'vortex')
  await duplicate.page.evaluate(() => controller.stop())
  assert.equal(await frames(duplicate.page).count(), 0)
  assert.deepEqual(duplicate.errors, [])
  await duplicate.page.close()
  record({ scenario: 'disabled-owner-retains-ui-and-rejects-duplicate-controller-updates', result: 'PASS' })
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ status: 'PASS', results }, null, 2))
  console.log(`PASS: ${results.length} formal skin-transition scenarios`)
} catch (error) {
  const diagnostic = lastPage && !lastPage.isClosed() ? await lastPage.evaluate(() => ({
    state: window.controller?.getTransitionState?.(),
    frames: [...document.querySelectorAll('iframe')].map(frame => ({ id: frame.id, src: frame.src, style: frame.style.cssText, state: frame.contentWindow.__bsState?.() })),
  })).catch(() => null) : null
  if (lastPage && !lastPage.isClosed()) await capture(lastPage, 'failure').catch(() => {})
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), results, diagnostic, errors: lastErrors }, null, 2))
  throw error
} finally { await browser.close(); await server.close() }
