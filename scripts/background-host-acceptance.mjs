import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, setRange, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/background-host')
await mkdir(output, { recursive: true })
const source = await readFile(resolve(root, process.argv[2] || 'shared/skin-core.js'), 'utf8')
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const evidence = []
const cosmosId = '__dsh-backspace-cosmos__'
const oceanId = '__dsh-backspace__'
const buttonId = '__dsh-backspace-btn__'
const panelId = '__dsh-backspace-panel__'
const fixture = `<html><body><script>
window.messages = [];
addEventListener('message', event => {
  messages.push(event.data);
  if (event.data.type === 'bs-prepare') requestAnimationFrame(() => requestAnimationFrame(() => parent.postMessage({
    type: 'bs-frame-ready', requestId: event.data.requestId,
    surface: location.pathname.includes('cosmos') ? 'cosmos' : 'ocean',
  }, location.origin)));
});
if (location.pathname.includes('cosmos')) parent.postMessage({ type: 'bs-cosmos-ready' }, location.origin);
</script></body></html>`
const messages = (page, id = cosmosId) => page.evaluate(id => document.getElementById(id).contentWindow.messages, id)
const settled = page => page.waitForFunction(() => controller.getTransitionState().phase === 'idle')
const clearMessages = (page, id = cosmosId) => page.evaluate(id => { document.getElementById(id).contentWindow.messages.length = 0 }, id)
const waitMessage = (page, id, type, key, value) => page.waitForFunction(({ id, type, key, value }) =>
  document.getElementById(id)?.contentWindow.messages?.some(message => message.type === type && message[key] === value), { id, type, key, value })

async function boot(skin = 'horizon', { delayOcean = false, legacyAnchor = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = watchPageErrors(page, 'background host')
  let releaseOcean, pendingOcean
  const oceanRequested = new Promise(resolve => { pendingOcean = resolve })
  const oceanGate = new Promise(resolve => { releaseOcean = resolve })
  await page.route('**/background-fixture/*.html?*', async route => {
    if (delayOcean && route.request().url().includes('/skin.html')) { pendingOcean(); await oceanGate }
    await route.fulfill({ contentType: 'text/html', body: fixture })
  })
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.evaluate(() => {
    const input = document.createElement('textarea'); input.id = 'chat-input'; document.querySelector('.conversation').append(input)
    const button = document.createElement('button'); button.id = 'chat-send'; button.textContent = 'Send'; document.querySelector('.conversation').append(button)
    const link = document.createElement('a'); link.id = 'chat-link'; link.href = '#'; link.textContent = 'Link'; document.querySelector('.conversation').append(link)
    const editor = document.createElement('div'); editor.id = 'chat-editor'; editor.contentEditable = 'true'; document.querySelector('.conversation').append(editor)
  })
  if (legacyAnchor) await page.evaluate(() => {
    const wrapper = document.querySelector('[data-slot="sidebar.settings"]')
    wrapper.removeAttribute('data-slot')
    const trigger = wrapper.querySelector('button')
    trigger.removeAttribute('data-testid')
    trigger.className = 'VOzbGW_trigger'
  })
  await page.addScriptTag({ content: source })
  await page.evaluate(async skin => {
    let stored = { ...BackspaceSkinCore.DEFAULTS, skin, autoCycle: false }
    window.controller = BackspaceSkinCore.createController({
      assetUrl: path => `/background-fixture/${path}`,
      storage: { get: async () => stored, set: async patch => { stored = { ...stored, ...patch } } },
    })
    await controller.start()
  }, skin)
  if (!delayOcean) await settled(page)
  return { page, errors, oceanRequested, releaseOcean }
}

try {
  const priority = await boot('horizon', { legacyAnchor: true })
  await waitMessage(priority.page, cosmosId, 'bs-preview', 'active', false)
  const promoted = await priority.page.evaluate(async buttonId => {
    await new Promise(requestAnimationFrame)
    const button = document.getElementById(buttonId)
    const before = button.getBoundingClientRect().left
    const formal = document.createElement('div')
    formal.dataset.slot = 'sidebar.settings'
    formal.style.cssText = 'position:fixed;left:350px;top:640px'
    formal.innerHTML = '<button style="width:40px;height:40px">Settings</button>'
    document.body.append(formal)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    return { before, after: button.getBoundingClientRect().left, expected: Math.round(formal.firstChild.getBoundingClientRect().right + 8) }
  }, buttonId)
  assert.equal(promoted.after, promoted.expected, 'a late official settings anchor must replace the cached legacy anchor')
  assert.notEqual(promoted.after, promoted.before)
  assert.deepEqual(priority.errors, [])
  evidence.push({ scenario: 'late-higher-priority-anchor', result: 'PASS', ...promoted })
  await priority.page.close()

  const { page, errors } = await boot()
  assert.equal(new URL(await page.locator(`#${cosmosId}`).getAttribute('src'), server.url).searchParams.get('preview'), '0')
  await waitMessage(page, cosmosId, 'bs-preview', 'active', false)
  const originalParams = await page.evaluate(() => controller.getState().p.cosmos)
  await clearMessages(page)
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      document.querySelector('#chat-input').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 600 + i, clientY: 600 }))
    }
    document.querySelector('#chat-input').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 629, clientY: 600 }))
    document.querySelector('#chat-input').value = 'normal typing'
    document.querySelector('#chat-input').dispatchEvent(new InputEvent('input', { bubbles: true, data: 'normal typing' }))
    document.querySelector('.conversation').dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }))
    await new Promise(requestAnimationFrame)
  })
  await waitMessage(page, cosmosId, 'bs-pointer', 'x', 629 / 1280 * 2 - 1)
  await waitMessage(page, cosmosId, 'bs-pulse', 'x', 629 / 1280 * 2 - 1)
  assert.equal((await messages(page)).filter(message => message.type === 'bs-pointer').length, 1, 'one frame of pointer events must coalesce to the latest position')
  assert.equal((await messages(page)).filter(message => message.type === 'bs-pulse').length, 1, 'background mode preserves configured primary-click pulse')
  assert.deepEqual(await page.evaluate(() => controller.getState().p.cosmos), originalParams)
  evidence.push({ scenario: 'background-budget-preserves-configured-interaction', result: 'PASS' })

  await page.locator(`#${buttonId}`).click()
  await waitMessage(page, cosmosId, 'bs-preview', 'active', true)
  await clearMessages(page)
  await page.evaluate(async () => {
    const target = document.querySelector('.welcome h1')
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 650, clientY: 250 }))
    await new Promise(requestAnimationFrame)
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 650, clientY: 250 }))
  })
  await waitMessage(page, cosmosId, 'bs-pointer', 'x', 650 / 1280 * 2 - 1)
  await waitMessage(page, cosmosId, 'bs-pulse', 'x', 650 / 1280 * 2 - 1)
  await clearMessages(page)
  await page.evaluate(() => {
    for (const selector of ['#chat-input', '#chat-send', '#chat-link', '#chat-editor']) {
      document.querySelector(selector).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    }
    document.querySelector('.welcome h1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2 }))
  })
  await page.waitForTimeout(30)
  assert.equal((await messages(page)).filter(message => message.type === 'bs-pulse').length, 4, 'ordinary primary clicks retain their pulse; the secondary click adds none')
  await clearMessages(page)
  await page.locator(`#${panelId}`).dispatchEvent('pointerdown', { button: 0 })
  await page.locator(`#${buttonId}`).dispatchEvent('pointerdown', { button: 0 })
  await page.waitForTimeout(30)
  assert.equal((await messages(page)).filter(message => message.type === 'bs-pulse').length, 0, 'Backspace controls retain their original pulse exclusion')
  const frameIdentity = await page.locator(`#${cosmosId}`).evaluateHandle(frame => frame)
  await page.locator('[data-skin=vortex]').click()
  await waitMessage(page, cosmosId, 'bs-skin', 'skin', 'vortex')
  assert.equal(await frameIdentity.evaluate(frame => frame === document.getElementById('__dsh-backspace-cosmos__')), true)
  await clearMessages(page)
  await page.evaluate(() => {
    document.querySelector('.welcome h1').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 900, clientY: 200 }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await waitMessage(page, cosmosId, 'bs-preview', 'active', false)
  await waitMessage(page, cosmosId, 'bs-pointer', 'x', 900 / 1280 * 2 - 1)
  assert.deepEqual(await page.evaluate(() => controller.getState().p.cosmos), originalParams, 'closing preview must not discount configured values')
  evidence.push({ scenario: 'preview-budget-and-unchanged-interaction', result: 'PASS' })
  await frameIdentity.dispose()

  await page.locator(`#${buttonId}`).click()
  await setRange(page.locator(`#${panelId}-cosmos-parallax-range`), 0)
  await setRange(page.locator(`#${panelId}-cosmos-pulse-range`), 0)
  await clearMessages(page)
  await page.evaluate(async () => {
    const target = document.querySelector('#chat-input')
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 1000, clientY: 200 }))
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 1000, clientY: 200 }))
    await new Promise(requestAnimationFrame)
  })
  await page.waitForTimeout(30)
  assert.equal((await messages(page)).filter(message => ['bs-pointer', 'bs-pulse'].includes(message.type)).length, 0, 'zero-strength effects must not send redundant interaction work')
  await setRange(page.locator(`#${panelId}-cosmos-parallax-range`), 55)
  await waitMessage(page, cosmosId, 'bs-pointer', 'x', 1000 / 1280 * 2 - 1)
  await setRange(page.locator(`#${panelId}-cosmos-pulse-range`), 70)
  await clearMessages(page)
  await page.evaluate(async () => {
    const target = document.querySelector('#chat-input')
    for (let i = 0; i < 15; i++) target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 1000, clientY: 200 }))
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 1000, clientY: 200 }))
    await new Promise(requestAnimationFrame)
  })
  await waitMessage(page, cosmosId, 'bs-pulse', 'x', 1000 / 1280 * 2 - 1)
  assert.equal((await messages(page)).filter(message => message.type === 'bs-pointer').length, 0, 'identical pointer coordinates must not repeat')
  await page.keyboard.press('Escape')
  evidence.push({ scenario: 'zero-strength-suppression-and-current-pointer-restore', result: 'PASS' })

  await page.locator(`#${buttonId}`).click()
  await page.evaluate(() => controller.setSkin('ocean'))
  await waitMessage(page, oceanId, 'bs-pause', 'paused', false)
  await waitMessage(page, cosmosId, 'bs-pause', 'paused', true)
  await page.waitForFunction(id => Number(getComputedStyle(document.getElementById(id)).opacity) > 0.2, oceanId)
  const oceanIdentity = await page.locator(`#${oceanId}`).evaluateHandle(frame => frame)
  await clearMessages(page, oceanId)
  await page.evaluate(() => controller.setSkin('horizon'))
  await waitMessage(page, oceanId, 'bs-pause', 'paused', true)
  await clearMessages(page, oceanId)
  await page.evaluate(() => controller.setSkin('ocean'))
  await waitMessage(page, oceanId, 'bs-pause', 'paused', false)
  assert.equal(await oceanIdentity.evaluate(frame => frame === document.getElementById('__dsh-backspace__')), true)
  assert.equal(await page.locator(`#${oceanId}, #${cosmosId}`).count(), 2, 'reversing an active handoff reuses both layers')
  evidence.push({ scenario: 'inactive-ocean-pause-and-reuse', result: 'PASS' })
  const oldCosmos = await page.locator(`#${cosmosId}`).evaluateHandle(frame => frame)
  const preservedParams = await page.evaluate(() => controller.getState().p.cosmos)
  await page.keyboard.press('Escape')
  await settled(page)
  assert.equal(await page.locator(`#${cosmosId}`).count(), 0, 'closing ocean preview must release the inactive cosmos renderer')
  assert.equal(await page.locator(`#${oceanId}`).count(), 1)
  assert.equal(await oldCosmos.evaluate(frame => frame.onload), null, 'released frame must not retain its load handler')
  await page.locator(`#${buttonId}`).click()
  await setRange(page.locator(`#${panelId}-sea-range`), 67)
  await page.evaluate(() => controller.setSkin('horizon'))
  await waitMessage(page, cosmosId, 'bs-prepare', 'skin', 'horizon')
  await settled(page)
  assert.equal(await oldCosmos.evaluate(frame => frame === document.getElementById('__dsh-backspace-cosmos__')), false, 'switching back after release creates a fresh renderer')
  assert.deepEqual(await page.evaluate(() => controller.getState().p.cosmos), preservedParams)
  const rebuilt = await page.locator(`#${cosmosId}`).evaluateHandle(frame => frame)
  await page.evaluate(() => controller.setSkin('vortex'))
  await waitMessage(page, cosmosId, 'bs-skin', 'skin', 'vortex')
  assert.equal(await rebuilt.evaluate(frame => frame === document.getElementById('__dsh-backspace-cosmos__')), true, 'H/V still use the same rebuilt cosmic frame')
  await clearMessages(page)
  await oldCosmos.evaluate(frame => frame.dispatchEvent(new Event('load')))
  await page.waitForTimeout(30)
  assert.equal((await messages(page)).length, 0, 'an old frame load cannot send messages to the rebuilt renderer')
  await page.keyboard.press('Escape')
  assert.equal(await page.locator(`#${oceanId}`).count(), 0, 'closing cosmic preview must release the inactive ocean renderer')
  assert.equal(await page.locator(`#${cosmosId}`).count(), 1)
  await page.locator(`#${buttonId}`).click()
  await page.evaluate(() => controller.setSkin('ocean'))
  await waitMessage(page, oceanId, 'bs-pause', 'paused', false)
  assert.equal(await oceanIdentity.evaluate(frame => frame === document.getElementById('__dsh-backspace__')), false)
  assert.equal(new URL(await page.locator(`#${oceanId}`).getAttribute('src'), server.url).searchParams.get('sea'), '67')
  assert.deepEqual(await page.evaluate(() => controller.getState().p.cosmos), preservedParams)
  await page.keyboard.press('Escape')
  await settled(page)
  assert.equal(await page.locator(`#${oceanId}, #${cosmosId}`).count(), 1)
  evidence.push({ scenario: 'inactive-renderer-release-rebuild-and-parameter-preservation', result: 'PASS' })
  await oceanIdentity.dispose()
  await oldCosmos.dispose()
  await rebuilt.dispose()

  const placement = await page.evaluate(async buttonId => {
    const button = document.getElementById(buttonId)
    const before = button.getBoundingClientRect().toJSON()
    let styleWrites = 0
    const observer = new MutationObserver(records => { styleWrites += records.length })
    observer.observe(button, { attributes: true, attributeFilter: ['style'] })
    for (let i = 0; i < 15; i++) {
      const message = document.createElement('p'); message.textContent = `streaming chunk ${i}`
      document.querySelector('.conversation').append(message)
      await new Promise(requestAnimationFrame)
    }
    await new Promise(requestAnimationFrame)
    const after = button.getBoundingClientRect().toJSON()
    observer.disconnect()
    const anchor = document.querySelector('[data-slot="sidebar.settings"] button')
    const replacement = anchor.cloneNode(true); replacement.style.transform = 'translateX(40px)'; anchor.replaceWith(replacement)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    return { before, after, styleWrites, moved: button.getBoundingClientRect().toJSON() }
  }, buttonId)
  assert.equal(placement.styleWrites, 0, 'streamed messages must not repeatedly rewrite the fixed launcher position')
  assert.equal(placement.before.x, placement.after.x)
  assert.equal(placement.before.y, placement.after.y)
  assert.ok(placement.moved.x >= placement.after.x + 30, 'a replaced settings anchor must still reposition the launcher')
  evidence.push({ scenario: 'streaming-placement-and-anchor-replacement', result: 'PASS', ...placement })
  assert.deepEqual(errors, [])
  await page.close()

  const late = await boot('ocean', { delayOcean: true })
  await late.oceanRequested
  await late.page.locator(`#${buttonId}`).click()
  await late.page.evaluate(() => controller.setSkin('vortex'))
  await waitMessage(late.page, cosmosId, 'bs-preview', 'active', true)
  late.releaseOcean()
  await settled(late.page)
  assert.equal(await late.page.locator(`#${oceanId}`).count(), 0, 'cancelled cold starts cannot replace the selected scene')
  await clearMessages(late.page)
  await late.page.frameLocator(`#${cosmosId}`).locator('body').evaluate(() => window.parent.postMessage({ type: 'bs-cosmos-ready' }, location.origin))
  await late.page.waitForTimeout(30)
  assert.equal((await messages(late.page)).length, 0, 'legacy ready cannot restart a completed handoff')
  await late.page.keyboard.press('Escape')
  assert.equal(await late.page.locator(`#${oceanId}`).count(), 0)
  assert.equal(await late.page.locator(`#${cosmosId}`).count(), 1)
  assert.deepEqual(late.errors, [])
  evidence.push({ scenario: 'late-load-and-ready-resync', result: 'PASS' })
  await late.page.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(`PASS: ${evidence.length} background host scenarios`)
} finally {
  await browser.close()
  await server.close()
}
