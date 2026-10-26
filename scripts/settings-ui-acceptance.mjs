import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, setRange, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/settings-ui')
const source = await readFile(resolve(process.argv[2] || root, 'shared/skin-core.js'), 'utf8')
const panel = '#__dsh-backspace-panel__'
const trigger = '#__dsh-backspace-btn__'
const tooltipSelector = `${panel}-help`
const cosmicKeys = ['glow', 'ring', 'turb', 'warm', 'spin', 'stars', 'parallax', 'pulse']
const cosmicDefaults = [70, 55, 55, 60, 50, 45, 55, 70]
const evidence = []
await mkdir(output, { recursive: true })
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.emulateMedia({ reducedMotion: 'no-preference' })
const errors = watchPageErrors(page, 'settings-ui')
await page.route('**/settings-ui-fixture/**', route => route.fulfill({
  contentType: 'text/html',
  body: `<html><body><script>
    addEventListener('message', ({ data }) => {
      if (data.type === 'bs-prepare') parent.postMessage({
        type: 'bs-frame-ready', surface: location.pathname.includes('cosmos') ? 'cosmos' : 'ocean', requestId: data.requestId,
      }, location.origin);
    });
    const token = new URLSearchParams(location.search).get('token');
    if (token) {
      addEventListener('message', ({ data }) => {
        if (data.type === 'bs-video') parent.postMessage({ type:'bs-video', token, requestId:data.requestId, ok:true, items:[], activeId:null }, location.origin);
      });
      parent.postMessage({type:'bs-video', token, event:'ready'}, location.origin);
    } else parent.postMessage({type:'bs-cosmos-ready'}, location.origin);
  </script></body></html>`,
}))

async function start() {
  await page.addScriptTag({ content: source })
  await page.evaluate(async () => {
    const read = () => JSON.parse(localStorage.getItem('settings-ui-test') || '{}')
    window.controller = BackspaceSkinCore.createController({
      assetUrl: path => `/settings-ui-fixture/${path}`,
      storage: {
        get: async defaults => ({ ...defaults, ...read() }),
        set: async patch => localStorage.setItem('settings-ui-test', JSON.stringify({ ...read(), ...patch })),
      },
    })
    await controller.start()
  })
}

async function inViewport(locator, label) {
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  assert.ok(box && box.width > 0 && box.height > 0, `${label} must be visible`)
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `${label} escaped viewport: ${JSON.stringify({ box, viewport })}`)
  return box
}

async function help(key) {
  await finishMotion()
  const button = page.locator(`${panel} .bs-help[data-help="${key}"]`)
  await button.hover()
  assert.equal(await button.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)',
    `${key}: help hover must highlight only the icon, without a background`)
  const tooltip = page.locator(tooltipSelector)
  await tooltip.waitFor({ state: 'visible' })
  const describedBy = await button.getAttribute('aria-describedby')
  assert.ok(describedBy, `${key} needs an accessible description`)
  assert.ok(await page.locator(`[id="${describedBy}"]`).textContent(), `${key} description must not be empty`)
  const tooltipBox = await inViewport(tooltip, `${key} tooltip`)
  const buttonBox = await button.boundingBox()
  assert.ok(tooltipBox.y < buttonBox.y, `${key} help must originate above its icon`)
  if (buttonBox.y >= tooltipBox.height + 20) {
    assert.ok(tooltipBox.y + tooltipBox.height <= buttonBox.y, `${key} help must open above its icon`)
  }
  return tooltip
}

async function setLocale(locale) {
  await page.evaluate(locale => { document.documentElement.lang = locale }, locale)
  const title = locale === 'zh-CN' ? 'Zed Space Skin 皮肤设置' : 'Zed Space Skin settings'
  await page.waitForFunction(({ trigger, title }) => document.querySelector(trigger).getAttribute('aria-label') === title, { trigger, title })
}

async function settleLayout() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function finishMotion() {
  await page.locator(panel).evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
  })
}

async function togglePanel() {
  return page.evaluate(async ({ trigger, panel }) => {
    document.querySelector(trigger).click()
    await new Promise(requestAnimationFrame)
    const element = document.querySelector(panel)
    return {
      display: getComputedStyle(element).display,
      expanded: document.querySelector(trigger).getAttribute('aria-expanded'),
      animations: element.getAnimations({ subtree: true }).map(animation => ({
        duration: animation.effect.getTiming().duration,
        frames: animation.effect.getKeyframes(),
      })),
    }
  }, { trigger, panel })
}

async function sampleResize(skin) {
  return page.evaluate(async ({ panel, skin }) => {
    const element = document.querySelector(panel)
    const measure = () => {
      const { height, top, bottom } = element.getBoundingClientRect()
      const general = element.querySelector('.bs-group').getBoundingClientRect()
      return {
        height, top, bottom, generalTop: general.top, generalBottom: general.bottom, generalHeight: general.height,
        skinHeight: element.querySelector('.bs-skin-region').getBoundingClientRect().height,
        footerBottom: element.querySelector('.bs-footer').getBoundingClientRect().bottom,
      }
    }
    const before = measure()
    element.querySelector(`[data-skin="${skin}"]`).click()
    const animations = element.getAnimations({ subtree: true }).filter(animation => {
      const frames = animation.effect.getKeyframes()
      return ['height', 'top'].some(key => frames.some(frame => frame[key] !== undefined) && frames[0][key] !== frames.at(-1)[key])
    })
    if (!animations.length) return { before, missingAnimation: true }
    for (const animation of animations) animation.pause()
    await Promise.all(animations.map(animation => animation.ready))
    const samples = []
    for (const fraction of [0, .25, .5, .75]) {
      for (const animation of animations) animation.currentTime = Number(animation.effect.getTiming().duration) * fraction
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      samples.push({ fraction, ...measure() })
    }
    for (const animation of animations) animation.play()
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
    await new Promise(requestAnimationFrame)
    return { before, samples, after: measure(), fixedHeights: [element, element.querySelector('.bs-skin-region'), element.querySelector('.bs-group')].map(node => node.style.height) }
  }, { panel, skin })
}

function noSpatialMotion(animations) {
  for (const animation of animations) {
    for (const property of ['transform', 'translate', 'rotate', 'scale', 'height', 'top']) {
      assert.ok(new Set(animation.frames.map(frame => frame[property]).filter(value => value !== undefined)).size <= 1,
        `reduced motion must not animate ${property}`)
    }
  }
}

try {
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
  await start()
  await page.locator(trigger).hover()
  const launcherTip = page.locator(`${trigger} .bs-launcher-tip`)
  await launcherTip.waitFor({ state: 'visible' })
  const launcherBox = await page.locator(trigger).boundingBox()
  const launcherTipBox = await inViewport(launcherTip, 'launcher tooltip')
  assert.ok(launcherTipBox.y + launcherTipBox.height <= launcherBox.y, 'launcher help must open upwards')
  assert.equal(await page.locator(trigger).getAttribute('title'), null, 'launcher must not show a second native tooltip')
  await page.mouse.move(1279, 0)
  assert.equal(await launcherTip.isVisible(), false, 'launcher tooltip must disappear immediately after leaving')
  evidence.push({ scenario: '黑洞入口提示向上显示、移开立即隐藏且无重复系统提示', result: 'PASS' })
  const opening = await togglePanel()
  await page.locator(`${panel}.open`).waitFor()
  assert.equal((await page.locator(`${panel} .bs-brand`).textContent()).trim(), 'Zed Space Skin')
  assert.deepEqual(await page.locator(`${panel} [role="tab"]`).evaluateAll(tabs => tabs.map(tab => tab.dataset.skin)), ['horizon', 'vortex', 'ocean', 'video'])
  assert.ok(opening.animations.some(animation => animation.duration > 0), 'opening the panel must animate')
  await finishMotion()
  const heading = page.locator(`${panel} .bs-skin-heading`)
  const enabled = page.locator(`${panel}-enabled`)
  assert.equal(await page.locator(`${panel} .bs-reset`).isDisabled(), true, 'a skin already at built-in defaults cannot reset')
  assert.equal(await enabled.getAttribute('aria-label'), '启用 Zed Space Skin 皮肤')
  const headingLabelBox = await heading.locator('label').boundingBox()
  const enabledBox = await enabled.boundingBox()
  assert.ok(enabledBox.x >= headingLabelBox.x + headingLabelBox.width && enabledBox.x - headingLabelBox.x - headingLabelBox.width <= 12,
    'enable switch must sit directly after the skin heading')
  assert.ok(Math.abs(enabledBox.y + enabledBox.height / 2 - headingLabelBox.y - headingLabelBox.height / 2) < 2,
    'skin heading and enable switch must align vertically')
  assert.equal(await page.locator(`${panel} [data-help="enable"]`).count(), 0, 'the old bottom enable row must be removed')
  assert.equal(await page.locator(`label[for="__dsh-backspace-panel__-chat"]`).textContent(), '对话面板独立调整')
  const skinHelp = heading.locator('[data-help="skinTitle"]')
  const idleHelpColor = await skinHelp.evaluate(element => getComputedStyle(element).color)
  await help('skinTitle')
  assert.equal(await page.locator(tooltipSelector).textContent(), '可控制完全开/关 Zed Space Skin')
  assert.equal(await page.locator(`${panel} .bs-group > .bs-group-title`).textContent(), '通用配置')
  assert.notEqual(await skinHelp.evaluate(element => getComputedStyle(element).color), idleHelpColor,
    'hover must visibly highlight the help icon')
  await page.keyboard.press('Escape')
  await enabled.uncheck()
  assert.equal((await page.evaluate(() => controller.getState())).enabled, false)
  assert.equal(await page.locator(panel).isVisible(), true, 'disabling skins must retain their settings panel')
  assert.equal(await page.locator(`${panel} .bs-reset`).isDisabled(), true, 'the global enable switch must not affect per-skin reset state')
  await setRange(page.locator(`${panel}-glass-range`), 65)
  assert.equal(await page.locator(`${panel} .bs-reset`).isEnabled(), true, 'changing only general settings makes this skin resettable')
  await setRange(page.locator(`${panel}-glass-range`), 70)
  assert.equal(await page.locator(`${panel} .bs-reset`).isDisabled(), true, 'returning general settings to defaults disables reset')
  await enabled.check()
  assert.equal((await page.evaluate(() => controller.getState())).enabled, true)
  evidence.push({ scenario: '顶部标题后的启用开关、可重新开启、通用皮肤提示、仅图标高亮及对话标签', result: 'PASS' })
  const closing = await togglePanel()
  assert.equal(closing.expanded, 'false')
  assert.notEqual(closing.display, 'none', 'exit motion must remain visible while it plays')
  assert.ok(closing.animations.some(animation => animation.duration > 0), 'closing the panel must animate')
  await page.locator(panel).waitFor({ state: 'hidden' })
  await togglePanel()
  await page.evaluate(async trigger => {
    for (let index = 0; index < 4; index++) {
      document.querySelector(trigger).click()
      await new Promise(requestAnimationFrame)
    }
  }, trigger)
  await finishMotion()
  assert.equal(await page.locator(trigger).getAttribute('aria-expanded'), 'true')
  assert.equal(await page.locator(panel).isVisible(), true, 'rapid reversals must leave the panel open')
  await page.locator('[data-skin="horizon"]').click()
  await finishMotion()
  const tabMotion = await page.evaluate(async panel => {
    const element = document.querySelector(panel)
    element.querySelector('[data-skin="vortex"]').click()
    await new Promise(requestAnimationFrame)
    return element.querySelector('.bs-tabs').getAnimations({ subtree: true }).map(animation => animation.effect.getKeyframes())
  }, panel)
  assert.ok(tabMotion.some(frames => new Set(frames.map(frame => frame.transform).filter(Boolean)).size > 1),
    'skin selection must move its visual indicator')
  await finishMotion()
  await page.locator('[data-skin="ocean"]').click()
  await finishMotion()
  evidence.push({ scenario: '黑洞优先排序、标题、面板开合与快速反转、皮肤切换动效', result: 'PASS' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await settleLayout()
  const sizeSamples = []
  for (const skin of ['horizon', 'ocean']) {
    const sample = await sampleResize(skin)
    assert.equal(sample.missingAnimation, undefined, `${skin}: changing panel height must animate`)
    const { before, samples, after } = sample
    assert.ok(Math.abs(after.height - before.height) > 20, `${skin}: the test must exercise different natural heights`)
    assert.ok(Math.abs(after.skinHeight - before.skinHeight) > 20, `${skin}: the changing height belongs to the independent skin region`)
    for (const frame of [...samples, after]) {
      assert.ok(Math.abs(frame.bottom - before.bottom) < 1, `${skin}: panel bottom stays anchored: ${JSON.stringify(sample)}`)
      assert.ok(Math.abs(frame.footerBottom - before.footerBottom) < 1, `${skin}: footer stays anchored: ${JSON.stringify(sample)}`)
      assert.ok(Math.abs(frame.generalTop - before.generalTop) < 1 && Math.abs(frame.generalBottom - before.generalBottom) < 1,
        `${skin}: unchanged general settings must not jump during resizing: ${JSON.stringify(sample)}`)
    }
    for (const frame of samples.filter(frame => frame.fraction > 0)) {
      assert.ok(frame.skinHeight > Math.min(before.skinHeight, after.skinHeight) && frame.skinHeight < Math.max(before.skinHeight, after.skinHeight),
        `${skin}: independent region height must interpolate: ${JSON.stringify(sample)}`)
    }
    assert.deepEqual(sample.fixedHeights, ['', '', ''], 'completed motion restores natural heights for all regions')
    sizeSamples.push({ skin, ...sample })
  }
  evidence.push({ scenario: '海面与黑洞独立区域双向伸缩，通用配置在各采样时刻保持位置', result: 'PASS', samples: sizeSamples })
  const motionBox = await page.locator(panel).boundingBox()
  const motionTop = Math.min(sizeSamples[0].before.top, sizeSamples[0].after.top)
  const motionClip = { x: motionBox.x, y: motionTop, width: motionBox.width, height: motionBox.y + motionBox.height - motionTop }
  await page.screenshot({ path: resolve(output, 'region-resize-before.png'), clip: motionClip })
  await page.evaluate(async panel => {
    const element = document.querySelector(panel)
    element.querySelector('[data-skin="horizon"]').click()
    const animations = element.getAnimations({ subtree: true }).filter(animation => animation.effect.getKeyframes().some(frame => frame.height !== undefined))
    for (const animation of animations) animation.pause()
    await Promise.all(animations.map(animation => animation.ready))
    for (const animation of animations) animation.currentTime = Number(animation.effect.getTiming().duration) / 2
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }, panel)
  await page.screenshot({ path: resolve(output, 'region-resize-middle.png'), clip: motionClip })
  await page.locator(panel).evaluate(async element => {
    const animations = element.getAnimations({ subtree: true })
    for (const animation of animations) animation.play()
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
  })
  await settleLayout()
  await page.screenshot({ path: resolve(output, 'region-resize-after.png'), clip: motionClip })
  await page.locator('[data-skin="ocean"]').click()
  await finishMotion()

  await page.locator('[data-skin="horizon"]').click()
  await finishMotion()
  const sameHeightAnimations = await page.evaluate(async panel => {
    const element = document.querySelector(panel)
    element.querySelector('[data-skin="vortex"]').click()
    await new Promise(requestAnimationFrame)
    return element.getAnimations({ subtree: true }).flatMap(animation => animation.effect.getKeyframes()).filter(frame => frame.height !== undefined)
  }, panel)
  assert.deepEqual(sameHeightAnimations, [], 'equal-height cosmic views must not restart size motion')
  await page.locator(`${panel}-chat`).uncheck()
  await finishMotion()
  const generalSamples = []
  for (const skin of ['horizon', 'vortex']) {
    const sample = await sampleResize(skin)
    assert.equal(sample.missingAnimation, undefined, 'different per-skin conversation toggles should animate the general region')
    assert.ok(Math.abs(sample.after.generalHeight - sample.before.generalHeight) > 20)
    for (const frame of sample.samples.filter(frame => frame.fraction > 0)) {
      assert.ok(frame.generalHeight > Math.min(sample.before.generalHeight, sample.after.generalHeight) && frame.generalHeight < Math.max(sample.before.generalHeight, sample.after.generalHeight),
        `general region should interpolate when its own controls differ: ${JSON.stringify(sample)}`)
      assert.ok(Math.abs(frame.skinHeight - sample.before.skinHeight) < 1, 'equal-size cosmic controls should stay at their natural size')
    }
    assert.deepEqual(sample.fixedHeights, ['', '', ''])
    generalSamples.push({ skin, ...sample })
  }
  await page.locator(`${panel}-chat`).check()
  await finishMotion()
  evidence.push({ scenario: '两黑洞通用配置展开状态不同时，仅变化区域平滑伸缩', result: 'PASS', samples: generalSamples })
  await page.locator('[data-skin="ocean"]').click()
  await finishMotion()
  const oceanHeight = (await page.locator(panel).boundingBox()).height
  await page.evaluate(async panel => {
    for (const skin of ['horizon', 'ocean', 'horizon', 'ocean']) {
      document.querySelector(`${panel} [data-skin="${skin}"]`).click()
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
  }, panel)
  await finishMotion()
  assert.ok(Math.abs((await page.locator(panel).boundingBox()).height - oceanHeight) < 1,
    'rapid reversals must finish at the selected skin’s natural height')
  assert.equal(await page.locator(panel).evaluate(element => element.style.height), '')
  await togglePanel()
  await page.locator(panel).waitFor({ state: 'hidden' })
  const openingResize = await page.evaluate(async ({ panel, trigger }) => {
    document.querySelector(trigger).click()
    const element = document.querySelector(panel)
    const opening = element.getAnimations().find(animation => animation.effect.getKeyframes().some(frame => frame.transform !== undefined))
    if (!opening) return { missingOpening: true }
    opening.pause()
    await opening.ready
    opening.currentTime = 0
    element.querySelector('[data-skin="horizon"]').click()
    opening.play()
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return { height: element.getBoundingClientRect().height, cssHeight: parseFloat(getComputedStyle(element).height), transform: getComputedStyle(element).transform, fixedHeight: element.style.height }
  }, { panel, trigger })
  assert.equal(openingResize.missingOpening, undefined)
  assert.ok(Math.abs(openingResize.height - sizeSamples.find(item => item.skin === 'horizon').after.height) < 1,
    `switching during the opening scale must finish at the natural height: ${JSON.stringify(openingResize)}`)
  assert.equal(openingResize.transform, 'none')
  assert.equal(openingResize.fixedHeight, '')
  evidence.push({ scenario: '面板开场缩放尚未结束时切换皮肤，终点仍为自然高度', result: 'PASS', sample: openingResize })
  await page.locator('[data-skin="ocean"]').click()
  await finishMotion()
  await page.evaluate(({ panel, trigger }) => {
    document.querySelector(`${panel} [data-skin="horizon"]`).click()
    document.querySelector(trigger).click()
  }, { panel, trigger })
  await page.locator(panel).waitFor({ state: 'hidden' })
  assert.equal(await page.locator(panel).evaluate(element => element.getAnimations({ subtree: true }).length), 0,
    'closing mid-resize must clean up the size animation')
  await togglePanel()
  await finishMotion()
  assert.equal(await page.locator(panel).evaluate(element => element.style.height), '')
  evidence.push({ scenario: '同高视角不重复伸缩、快速切换与伸缩途中关闭清理', result: 'PASS' })

  await page.locator('[data-skin="ocean"]').click()
  await finishMotion()
  await page.evaluate(panel => document.querySelector(`${panel} [data-skin="horizon"]`).click(), panel)
  await page.setViewportSize({ width: 390, height: 400 })
  await settleLayout()
  await inViewport(page.locator(panel), 'panel resized during height motion')
  assert.equal(await page.locator(panel).evaluate(element => element.getAnimations({ subtree: true }).some(animation =>
    animation.effect.getKeyframes().some(frame => frame.height !== undefined))), false,
  'viewport resize must cancel obsolete height motion')
  for (const skin of ['ocean', 'horizon']) {
    await page.locator(`[data-skin="${skin}"]`).click()
    await finishMotion()
    await inViewport(page.locator(panel), `${skin} settings in a short viewport`)
    const scrollState = await page.locator(panel).evaluate(element => {
      const scroller = element.querySelector('.bs-scroll')
      scroller.scrollTop = scroller.scrollHeight
      return {
        scrollTop: scroller.scrollTop, maxScroll: scroller.scrollHeight - scroller.clientHeight,
        fixedHeights: [element, element.querySelector('.bs-skin-region'), element.querySelector('.bs-group')].map(node => node.style.height),
      }
    })
    assert.ok(scrollState.scrollTop > 0 && Math.abs(scrollState.scrollTop - scrollState.maxScroll) < 1, 'short-view content remains scrollable after switching from a scrolled view')
    assert.deepEqual(scrollState.fixedHeights, ['', '', ''])
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await settleLayout()
  await page.locator('[data-skin="ocean"]').click()
  await finishMotion()
  evidence.push({ scenario: '高度过渡途中缩窗与短视口切换保持面板可见', result: 'PASS' })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  noSpatialMotion((await togglePanel()).animations)
  await page.locator(panel).waitFor({ state: 'hidden' })
  noSpatialMotion((await togglePanel()).animations)
  const reducedTabs = await page.evaluate(async panel => {
    const element = document.querySelector(panel)
    element.querySelector('[data-skin="horizon"]').click()
    await new Promise(requestAnimationFrame)
    return element.getAnimations({ subtree: true }).map(animation => ({ frames: animation.effect.getKeyframes() }))
  }, panel)
  noSpatialMotion(reducedTabs)
  await finishMotion()
  await page.locator('[data-skin="ocean"]').click()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  evidence.push({ scenario: '减少动态效果偏好下保留状态变化且无位移动画', result: 'PASS' })

  await help('reset')
  const immediatelyHidden = await page.locator(`${panel} .bs-help[data-help="reset"]`).evaluate(async button => {
    button.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    await new Promise(requestAnimationFrame)
    return document.querySelector('[role="tooltip"]').hidden
  })
  assert.equal(immediatelyHidden, true, 'pointerleave must hide help by the next frame without a timer')
  await page.locator(`${panel} .bs-help[data-help="reset"]`).click()
  await page.locator(tooltipSelector).waitFor({ state: 'visible' })
  await page.mouse.move(1279, 0)
  assert.equal(await page.locator(tooltipSelector).isVisible(), false,
    'clicked help must not stay open merely because its icon still has focus')
  const readableTooltip = await help('reset')
  const readableBox = await readableTooltip.boundingBox()
  await page.mouse.move(readableBox.x + readableBox.width / 2, readableBox.y + readableBox.height / 2, { steps: 10 })
  assert.equal(await readableTooltip.isVisible(), true, 'moving directly into help must keep its content readable')
  await page.mouse.move(1279, 0)
  assert.equal(await readableTooltip.isVisible(), false, 'leaving the help content must also hide it immediately')
  evidence.push({ scenario: '提示向上弹出、移开立即隐藏、点击后的鼠标移开同样隐藏', result: 'PASS' })

  for (const key of ['skinTitle', 'sea', 'time', 'autoCycle', 'glass', 'chatCustom', 'chatOpacity', 'reset']) {
    await help(key)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator(tooltipSelector).isVisible(), false)
    assert.equal(await page.locator(panel).isVisible(), true, 'Escape dismisses help before the panel')
  }
  evidence.push({ scenario: '逐项说明、可访问描述、提示范围与 Escape', result: 'PASS' })

  const daylight = page.locator(`${panel}-time-range`)
  await daylight.focus()
  await page.keyboard.press('ArrowRight')
  assert.equal((await page.evaluate(() => controller.getState())).time, 56)
  assert.equal(await page.locator(`${panel}-cycle`).isChecked(), false)
  assert.equal(await page.locator(`${panel}-ocean ${panel}-cycle`).count(), 1, 'day cycle belongs to Ocean settings')
  assert.equal(await page.locator(`${panel} .bs-group ${panel}-cycle`).count(), 0, 'day cycle must not appear among common settings')
  await page.locator(`${panel}-chat`).uncheck()
  assert.equal(await page.locator(`${panel}-chat-row`).isVisible(), false)
  await page.locator(`${panel}-chat`).check()
  await setRange(page.locator(`${panel}-chat-range`), 84)
  await setRange(page.locator(`${panel}-glass-range`), 63)
  await page.locator('[data-skin="horizon"]').click()
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '70', 'Ocean glass must not change Horizon')
  assert.equal(await page.locator(`${panel}-chat-range`).inputValue(), '90', 'Ocean conversation opacity must not change Horizon')
  await setRange(page.locator(`${panel}-glass-range`), 59)
  await setRange(page.locator(`${panel}-chat-range`), 87)
  assert.equal(await page.locator(`${panel}-cycle`).isVisible(), false)
  assert.equal(await page.locator(`${panel}-cosmos ${panel}-cosmos-cycle`).isVisible(), true)
  assert.equal(await page.locator(`${panel}-cosmos-cycle`).isChecked(), true,
    'manual Ocean daylight must not disable cosmic light variation')
  await help('cosmicCycle')
  await page.keyboard.press('Escape')
  await page.locator(`${panel}-cosmos-cycle`).uncheck()
  assert.equal(await page.locator(`${panel} .bs-reset`).isEnabled(), true, 'a changed skin cycle makes reset available')
  await page.locator('[data-skin="ocean"]').click()
  await page.locator(`${panel}-cycle`).check()
  await page.locator('[data-skin="horizon"]').click()
  assert.equal(await page.locator(`${panel}-cosmos-cycle`).isChecked(), false,
    'enabling Ocean day cycle must not re-enable cosmic light variation')
  evidence.push({ scenario: '昼夜与光影开关归属各自皮肤参数区并独立控制', result: 'PASS' })
  for (const [index, key] of cosmicKeys.entries()) {
    await help(key)
    await page.keyboard.press('Escape')
    await setRange(page.locator(`${panel}-cosmos-${key}-range`), 20 + index)
  }
  await page.locator('[data-skin="vortex"]').click()
  for (const [index, key] of cosmicKeys.entries()) {
    assert.equal(await page.locator(`${panel}-cosmos-${key}-range`).inputValue(), String(cosmicDefaults[index]),
      'editing Horizon must preserve Vortex settings')
  }
  assert.equal(await page.locator(`${panel}-cosmos-cycle`).isChecked(), true, 'cosmic skins must also have independent light cycles')
  assert.equal(await page.locator(`${panel} .bs-reset`).isDisabled(), true, 'unchanged Vortex remains at defaults despite changed Ocean and Horizon glass settings')
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '70')
  assert.equal(await page.locator(`${panel}-chat-range`).inputValue(), '90')
  await setRange(page.locator(`${panel}-glass-range`), 81)
  await setRange(page.locator(`${panel}-chat-range`), 92)
  for (const [index, key] of cosmicKeys.entries()) await setRange(page.locator(`${panel}-cosmos-${key}-range`), 80 + index)
  await page.locator(`${panel}-cosmos-cycle`).uncheck()
  await page.locator('[data-skin="horizon"]').click()
  for (const [index, key] of cosmicKeys.entries()) {
    assert.equal(await page.locator(`${panel}-cosmos-${key}-range`).inputValue(), String(20 + index),
      'editing Vortex must preserve Horizon settings')
  }
  assert.equal(await page.locator(`${panel}-cosmos-cycle`).isChecked(), false)
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '59')
  assert.equal(await page.locator(`${panel}-chat-range`).inputValue(), '87')
  await page.locator('[data-skin="vortex"]').click()
  const adjusted = await page.evaluate(() => controller.getState())
  assert.deepEqual(adjusted.p.general, {
    ocean: { glass: 63, chatCustom: true, chatOpacity: 84 },
    horizon: { glass: 59, chatCustom: true, chatOpacity: 87 },
    vortex: { glass: 81, chatCustom: true, chatOpacity: 92 },
    video: { glass: 70, chatCustom: true, chatOpacity: 90 },
  }, 'all four skins save their own general settings')
  await page.reload()
  await start()
  assert.deepEqual(await page.evaluate(() => controller.getState()), adjusted)
  await page.locator(trigger).click()
  evidence.push({ scenario: '键盘调节、对话背景开关、三张皮肤分别保存、默认禁用态、切换与重载持久化', result: 'PASS', adjusted })

  await page.locator('[data-skin="ocean"]').click()
  for (const [key, skin] of [['ArrowRight', 'video'], ['ArrowRight', 'horizon'], ['ArrowRight', 'vortex'], ['ArrowRight', 'ocean'], ['ArrowLeft', 'vortex'], ['Home', 'horizon'], ['End', 'video']]) {
    await page.keyboard.press(key)
    const selected = page.locator(`[data-skin="${skin}"]`)
    assert.equal(await selected.getAttribute('aria-selected'), 'true')
    assert.equal(await selected.evaluate(element => document.activeElement === element), true)
    assert.equal(await page.locator(`${panel} [role="tab"][tabindex="0"]`).count(), 1)
    assert.equal((await page.evaluate(() => controller.getState())).skin, skin)
  }
  evidence.push({ scenario: '皮肤标签方向键、首尾键、循环切换与唯一 Tab 停靠点', result: 'PASS' })

  const colors = {}
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark'), theme)
    colors[theme] = await page.locator(panel).evaluate(element => getComputedStyle(element).backgroundColor)
    for (const locale of ['zh-CN', 'en']) {
      await setLocale(locale)
      for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 640 }, { width: 320, height: 568 }, { width: 1280, height: 400 }]) {
        await page.setViewportSize(viewport)
        await settleLayout()
        await page.waitForFunction(panel => {
          const rect = document.querySelector(panel).getBoundingClientRect()
          return rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1
        }, panel)
        const box = await inViewport(page.locator(panel), 'settings panel')
        const buttonBox = await inViewport(page.locator(trigger), 'settings launcher')
        if (viewport.width === 1280 && viewport.height === 800) {
          assert.ok(box.y + box.height <= buttonBox.y || box.y >= buttonBox.y + buttonBox.height,
            `settings must not cover their bottom-anchored launcher: ${JSON.stringify({ box, buttonBox })}`)
        }
        assert.ok(box.width <= 360, 'settings should remain a compact panel')
        assert.equal(await page.locator(`${panel} .bs-scroll`).evaluate(element => element.scrollWidth > element.clientWidth), false)
        await page.locator('[data-skin="ocean"]').click()
        await page.locator(`${panel} .bs-scroll`).evaluate(element => { element.scrollTop = 0 })
        await page.mouse.move(viewport.width - 1, 0)
        const name = `${theme}-${locale}-${viewport.width}${viewport.height === 400 ? 'x400' : ''}`
        await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' })
        await help('reset')
        await page.screenshot({ path: resolve(output, `${name}-tooltip.png`), animations: 'disabled' })
        await page.keyboard.press('Escape')
        await page.locator('[data-skin="horizon"]').click()
        await inViewport(page.locator(panel), 'cosmic settings panel')
        await page.locator(`${panel} .bs-scroll`).evaluate(element => { element.scrollTop = 0 })
        await page.screenshot({ path: resolve(output, `${name}-cosmos.png`), animations: 'disabled' })
        evidence.push({ scenario: `${theme} / ${locale} / ${viewport.width}×${viewport.height}`, result: 'PASS', panel: box })
      }
    }
  }
  assert.notEqual(colors.light, colors.dark, 'panel palette must follow the host theme')

  await page.setViewportSize({ width: 320, height: 568 })
  await settleLayout()
  const topTooltip = await help('skinTitle')
  const topBox = await topTooltip.boundingBox()
  const topTargetBox = await page.locator(`${panel} .bs-help[data-help="skinTitle"]`).boundingBox()
  await page.mouse.move(topTargetBox.x + topTargetBox.width / 2, topBox.y + topBox.height / 2, { steps: 10 })
  assert.equal(await topTooltip.isVisible(), true, 'top-edge help remains readable when the pointer moves into it')
  await page.screenshot({ path: resolve(output, 'top-help.png'), animations: 'disabled' })
  await page.mouse.move(319, 567)
  assert.equal(await topTooltip.isVisible(), false, 'leaving help must hide it immediately')
  evidence.push({ scenario: '顶端精简说明向上显示、可移入阅读并立即移出关闭', result: 'PASS' })
  await page.locator(`${panel} .bs-close`).focus()
  const visited = []
  for (let index = 0; index < 50; index++) {
    await page.keyboard.press('Tab')
    await settleLayout()
    const key = await page.evaluate(() => document.activeElement?.dataset.help)
    if (!key) continue
    const tooltip = page.locator(tooltipSelector)
    assert.equal(await tooltip.isVisible(), true, `${key}: focus help must survive automatic scrolling`)
    await inViewport(tooltip, `${key} keyboard tooltip`)
    await inViewport(page.locator(`${panel} .bs-help[data-help="${key}"]`), `${key} focused help`)
    visited.push({ key, scrollTop: await page.locator(`${panel} .bs-scroll`).evaluate(element => element.scrollTop) })
    if (key === 'chatOpacity') await page.screenshot({ path: resolve(output, 'keyboard-scrolled-help.png'), animations: 'disabled' })
    if (key === 'reset') break
  }
  assert.deepEqual(visited.map(item => item.key), ['skinTitle', ...cosmicKeys, 'cosmicCycle', 'glass', 'chatCustom', 'chatOpacity', 'reset'])
  for (const key of ['spin', 'stars', 'cosmicCycle', 'glass', 'chatOpacity']) {
    assert.ok(visited.find(item => item.key === key)?.scrollTop > 0, `${key} must exercise an automatically scrolled help target`)
  }
  evidence.push({ scenario: '320px 窄屏真实 Tab 遍历与自动滚动后的焦点提示', result: 'PASS', visited })

  const keyboardHelp = page.locator(`${panel} .bs-help[data-help="glow"]`)
  await keyboardHelp.focus()
  await page.locator(tooltipSelector).waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  assert.equal(await page.locator(tooltipSelector).isVisible(), false)
  await page.keyboard.press('Escape')
  await page.locator(panel).waitFor({ state: 'hidden' })
  assert.equal(await page.locator(trigger).evaluate(element => element === document.activeElement), true)
  await page.locator(trigger).click()
  await page.locator(`${panel} .bs-help[data-help="skinTitle"]`).click()
  await page.locator(tooltipSelector).waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  const resetButton = page.locator(`${panel} .bs-reset`)
  const confirmation = page.locator(`${panel} .bs-reset-confirm`)
  const cancelReset = confirmation.locator('.bs-confirm-cancel')
  const confirmReset = confirmation.locator('.bs-confirm-restore')
  const beforeReset = await page.evaluate(() => controller.getState())
  await resetButton.click()
  await confirmation.waitFor({ state: 'visible' })
  assert.deepEqual(await page.evaluate(() => controller.getState()), beforeReset, 'opening confirmation must not reset anything')
  assert.equal(await resetButton.getAttribute('aria-expanded'), 'true')
  assert.equal(await cancelReset.evaluate(element => element === document.activeElement), true, 'confirmation should focus the non-destructive action')
  const confirmationBox = await inViewport(confirmation, 'reset confirmation at 320px')
  const resetButtonBox = await resetButton.boundingBox()
  assert.ok(confirmationBox.y + confirmationBox.height <= resetButtonBox.y, 'reset confirmation must open above its button')
  await page.screenshot({ path: resolve(output, 'reset-confirmation-narrow.png'), animations: 'disabled' })
  await page.keyboard.press('Shift+Tab')
  assert.equal(await confirmReset.evaluate(element => element === document.activeElement), true)
  await page.keyboard.press('Tab')
  assert.equal(await cancelReset.evaluate(element => element === document.activeElement), true)
  await cancelReset.click()
  assert.equal(await confirmation.isVisible(), false)
  assert.equal(await resetButton.evaluate(element => element === document.activeElement), true)
  assert.deepEqual(await page.evaluate(() => controller.getState()), beforeReset, 'cancel must preserve settings')
  await resetButton.click()
  await page.keyboard.press('Escape')
  assert.equal(await confirmation.isVisible(), false)
  assert.equal(await page.locator(panel).isVisible(), true, 'Escape must dismiss confirmation before the panel')
  assert.equal(await resetButton.evaluate(element => element === document.activeElement), true)
  assert.deepEqual(await page.evaluate(() => controller.getState()), beforeReset, 'Escape must preserve settings')
  await resetButton.click()
  await page.locator(`${panel} .bs-brand`).click()
  assert.equal(await confirmation.isVisible(), false, 'clicking outside the bubble must dismiss it')
  assert.equal(await page.locator(panel).isVisible(), true)
  assert.deepEqual(await page.evaluate(() => controller.getState()), beforeReset, 'light dismissal must preserve settings')
  await resetButton.click()
  await page.locator('[data-skin="ocean"]').click()
  assert.equal(await confirmation.isVisible(), false, 'changing skins must dismiss the stale confirmation')
  await page.locator('[data-skin="horizon"]').click()
  assert.deepEqual(await page.evaluate(() => controller.getState()), beforeReset, 'changing skins must not apply a pending reset')
  await finishMotion()
  await resetButton.click()
  await confirmReset.click()
  assert.equal(await confirmation.isVisible(), false)
  await page.waitForFunction(() => controller.getState().p.views.horizon.params.glow === 70)
  const afterReset = await page.evaluate(() => controller.getState())
  assert.equal(afterReset.skin, 'horizon')
  assert.deepEqual(afterReset.p.views.horizon, { params: Object.fromEntries(cosmicKeys.map((key, index) => [key, cosmicDefaults[index]])), autoCycle: true })
  assert.deepEqual(afterReset.p.views.vortex, beforeReset.p.views.vortex, 'resetting Horizon must preserve Vortex')
  assert.deepEqual(afterReset.p.general.horizon, { glass: 70, chatCustom: true, chatOpacity: 90 })
  assert.deepEqual(afterReset.p.general.ocean, beforeReset.p.general.ocean)
  assert.deepEqual(afterReset.p.general.vortex, beforeReset.p.general.vortex)
  assert.deepEqual([afterReset.glass, afterReset.chatCustom, afterReset.chatOpacity], [70, true, 90])
  for (const key of ['sea', 'time', 'autoCycle', 'enabled']) {
    assert.equal(afterReset[key], beforeReset[key], `resetting Horizon must preserve ${key}`)
  }
  assert.equal(await resetButton.isDisabled(), true, 'confirmed reset must disable the now-unnecessary reset action')
  await page.locator('[data-skin="vortex"]').click()
  assert.equal(await resetButton.isEnabled(), true, 'Vortex remains independently modified')
  await page.locator('[data-skin="horizon"]').click()
  assert.equal(await resetButton.isDisabled(), true, 'Horizon remains independently at defaults')
  await page.reload()
  await start()
  assert.deepEqual(await page.evaluate(() => controller.getState()), afterReset, 'per-skin reset and unaffected values must survive reload')
  await page.locator(trigger).click()
  assert.deepEqual(errors, [])
  evidence.push({ scenario: '向上恢复确认气泡、窄屏范围、取消与 Escape 焦点、外点关闭、Tab 循环、切皮肤撤销及仅恢复当前皮肤', result: 'PASS', beforeReset, afterReset })
  evidence.push({ scenario: '键盘提示、点击提示、恢复默认、关闭焦点归还、无控制台错误', result: 'PASS' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await setLocale('zh-CN')
  await settleLayout()
  for (const [theme, skin] of [['light', 'ocean'], ['dark', 'horizon']]) {
    await page.evaluate(theme => document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark'), theme)
    await page.locator(`[data-skin="${skin}"]`).click()
    await finishMotion()
    await page.locator(`${panel} .bs-scroll`).evaluate(element => { element.scrollTop = 0 })
    await settleLayout()
    assert.equal(await page.locator(`${panel} .bs-scroll`).evaluate(element => element.scrollHeight > element.clientHeight), false,
      'desktop preview must show every setting')
    await page.mouse.move(1439, 0)
    await page.locator(panel).screenshot({ path: resolve(output, `panel-${theme}.png`), animations: 'disabled' })
  }
  for (const skin of ['ocean', 'vortex']) {
    await page.locator(`[data-skin="${skin}"]`).click()
    await finishMotion()
    const before = await page.evaluate(() => controller.getState())
    assert.equal(await resetButton.isEnabled(), true, `${skin} still has its independently modified settings`)
    await resetButton.click()
    await confirmReset.click()
    await page.waitForFunction(panel => document.querySelector(`${panel} .bs-reset`).disabled, panel)
    const after = await page.evaluate(() => controller.getState())
    assert.equal(after.enabled, before.enabled, `${skin} reset must preserve the main switch`)
    assert.deepEqual([after.glass, after.chatCustom, after.chatOpacity], [70, true, 90])
    assert.deepEqual(after.p.general[skin], { glass: 70, chatCustom: true, chatOpacity: 90 })
    for (const other of ['ocean', 'horizon', 'vortex'].filter(id => id !== skin)) {
      assert.deepEqual(after.p.general[other], before.p.general[other], `${skin} reset preserves ${other} general settings`)
    }
    if (skin === 'ocean') {
      assert.deepEqual([after.sea, after.time, after.autoCycle], [50, 55, true])
      assert.deepEqual(after.p.views, before.p.views, 'Ocean reset must preserve both cosmic skins')
    } else {
      assert.deepEqual(after.p.views.vortex, { params: Object.fromEntries(cosmicKeys.map((key, index) => [key, cosmicDefaults[index]])), autoCycle: true })
      assert.deepEqual(after.p.views.horizon, before.p.views.horizon)
      assert.deepEqual([after.sea, after.time, after.autoCycle], [before.sea, before.time, before.autoCycle])
    }
    evidence.push({ scenario: `${skin} 独立恢复效果与通用配置，保留其他皮肤及总开关`, result: 'PASS', before, after })
  }
  const legacyCosmos = Object.fromEntries(cosmicKeys.map((key, index) => [key, 30 + index]))
  await page.evaluate(legacyCosmos => {
    controller.stop()
    localStorage.setItem('settings-ui-test', JSON.stringify({ skin: 'horizon', autoCycle: false, sea: 28, time: 73, glass: 40, chatCustom: false, chatOpacity: 100, p: { cosmos: legacyCosmos } }))
  }, legacyCosmos)
  await start()
  const migrated = await page.evaluate(() => controller.getState())
  for (const skin of ['horizon', 'vortex']) assert.deepEqual(migrated.p.views[skin], { params: legacyCosmos, autoCycle: false }, 'old shared cosmic settings must seed both independent skins')
  assert.deepEqual(migrated.p.cosmos, legacyCosmos, 'migration retains the old shared settings archive')
  for (const skin of ['ocean', 'horizon', 'vortex']) assert.deepEqual(migrated.p.general[skin], { glass: 40, chatCustom: false, chatOpacity: 100 }, 'legacy general settings, including false and boundary values, migrate to every skin')
  assert.deepEqual([migrated.sea, migrated.time, migrated.autoCycle], [28, 73, false])
  await page.locator(trigger).click()
  await setRange(page.locator(`${panel}-cosmos-glow-range`), 89)
  await setRange(page.locator(`${panel}-glass-range`), 88)
  await page.locator(`${panel}-chat`).check()
  await setRange(page.locator(`${panel}-chat-range`), 44)
  const migratedAndEdited = await page.evaluate(() => controller.getState())
  await page.reload()
  await start()
  assert.deepEqual(await page.evaluate(() => controller.getState()), migratedAndEdited)
  assert.equal(migratedAndEdited.p.views.horizon.params.glow, 89)
  assert.deepEqual(migratedAndEdited.p.views.vortex, { params: legacyCosmos, autoCycle: false })
  assert.deepEqual(migratedAndEdited.p.general.horizon, { glass: 88, chatCustom: true, chatOpacity: 44 })
  for (const skin of ['ocean', 'vortex']) assert.deepEqual(migratedAndEdited.p.general[skin], { glass: 40, chatCustom: false, chatOpacity: 100 })
  evidence.push({ scenario: '旧共享参数与关闭光影迁移为两份独立配置，编辑一张后重载仍隔离', result: 'PASS', migrated, migratedAndEdited })
  assert.deepEqual(errors, [])
  await writeFile(resolve(output, 'evidence.json'), JSON.stringify(evidence, null, 2))
  console.log(`PASS: ${evidence.length} settings UI scenarios; screenshots: ${output}`)
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {})
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, completed: evidence }, null, 2))
  throw error
} finally {
  await browser.close()
  await server.close()
}
