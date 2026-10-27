import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import test from 'node:test'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory } from '../scripts/browser-support.mjs'

const root = resolve(import.meta.dirname, '..')
const videoId = '__dsh-backspace-video__'
const shaderFixture = '<!doctype html><style>body{background:#123;margin:0}</style><script>addEventListener("message",({data})=>{if(data.type==="bs-prepare")parent.postMessage({type:"bs-frame-ready",surface:location.pathname.includes("cosmos")?"cosmos":"ocean",requestId:data.requestId},location.origin)})</script>'

async function setup(reducedMotion = 'no-preference') {
  const directory = await mkdtemp(join(tmpdir(), 'video-transition-test-'))
  const samples = ['red', 'blue'].map(color => {
    const path = join(directory, `${color}.mp4`)
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=${color}:size=64x36:rate=10`, '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', path])
    return path
  })
  const server = await serveDirectory(root)
  const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 700 }, reducedMotion })
  page.setDefaultTimeout(5000)
  await page.addInitScript(() => {
    window.fades = []
    window.liveBlobUrls = new Set()
    const createUrl = URL.createObjectURL.bind(URL)
    const revokeUrl = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = createUrl(blob); liveBlobUrls.add(url); return url }
    URL.revokeObjectURL = url => { liveBlobUrls.delete(url); revokeUrl(url) }
    const animate = Element.prototype.animate
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options)
      if (this instanceof HTMLIFrameElement || this instanceof HTMLVideoElement) {
        fades.push({ animation, target: this, count: document.querySelectorAll(this.tagName).length })
      }
      return animation
    }
  })
  await page.route('**/transition-fixture/skin.html?*', route => route.fulfill({ contentType: 'text/html', body: shaderFixture }))
  await page.route('**/transition-fixture/cosmos.html?*', route => route.fulfill({ contentType: 'text/html', body: shaderFixture }))
  const videoHtml = (await readFile(resolve(root, 'extension/video.html'), 'utf8')).replace('./video.js', '/shared/video.js')
  await page.route('**/transition-fixture/video.html?*', route => route.fulfill({ contentType: 'text/html', body: videoHtml }))
  await page.goto(`${server.url}/tests/fixtures/generic/index.html`)
  await page.addScriptTag({ path: resolve(root, 'shared/skin-core.js') })
  await page.evaluate(async () => {
    window.controller = BackspaceSkinCore.createController({
      assetUrl: path => `/transition-fixture/${path}`, locale: 'zh-CN',
      storage: { get: async defaults => ({ ...defaults, skin: 'ocean', enabled: true }), set: async () => {} },
    })
    await controller.start()
  })
  await page.waitForFunction(() => controller.getTransitionState().visible === 'ocean')
  await page.locator('#__dsh-backspace-btn__').click()
  await page.locator('[data-skin="video"]').click()
  await page.waitForFunction(() => !document.querySelector('.bs-video-import').disabled)
  await page.locator('input[type=file]').setInputFiles(samples)
  await page.waitForFunction(() => document.querySelectorAll('.bs-video-tile').length === 2 && !document.querySelector('.bs-video-import').disabled)
  return { page, close: async () => { await browser.close(); await server.close(); await rm(directory, { recursive: true, force: true }) } }
}

const ready = page => page.waitForFunction(() => !document.querySelector('.bs-video-import').disabled)
const clearFades = page => page.evaluate(() => { fades.length = 0 })
const fadeDetails = page => page.evaluate(() => fades.map(({ animation, target, count }) => ({
  count, target: target.id || target.tagName, duration: animation.effect.getTiming().duration,
  easing: animation.effect.getTiming().easing, keyframes: animation.effect.getKeyframes().map(({ opacity }) => opacity),
})))
const settle = page => page.waitForFunction(() => controller.getTransitionState().phase === 'idle')

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`本地视频与其他皮肤共用渐变，保留旧帧直到切换完成 (${reducedMotion})`, async () => {
    const { page, close } = await setup(reducedMotion)
    try {
      await clearFades(page)
      await page.getByRole('checkbox', { name: '启用 red', exact: true }).check()
      await ready(page)
      let fades = await fadeDetails(page)
      assert.equal(fades.length, 1, '海面 → 视频必须创建渐变，不能直接清空海面')
      assert.equal(fades[0].duration, reducedMotion === 'reduce' ? 150 : 550)
      assert.equal(fades[0].count, 2, '渐变开始时新旧背景必须同时存在')
      assert.equal(fades[0].easing, 'cubic-bezier(0.4, 0, 0.2, 1)')
      await settle(page)
      assert.equal((await page.evaluate(() => controller.getTransitionState())).visible, 'video')
      assert.equal(await page.frameLocator(`#${videoId}`).locator('video').evaluate(video => video.videoWidth), 64, '视频层进入过渡不能重载 iframe 丢掉已解码画面')
      for (const skin of ['ocean', 'horizon', 'vortex']) {
        await clearFades(page)
        await page.locator(`[data-skin="${skin}"]`).click()
        await page.waitForFunction(() => fades.length > 0)
        fades = await fadeDetails(page)
        assert.equal(fades[0].count, 2, `视频 → ${skin} 需要保留视频帧`)
        await settle(page)
        assert.equal(await page.locator(`#${videoId}`).count(), 0, '渐变完成后释放旧视频层')
        await clearFades(page)
        await page.locator('[data-skin="video"]').click()
        await ready(page)
        await settle(page)
        fades = await fadeDetails(page)
        assert.equal(fades.length, 1, `${skin} → 视频需要渐变`)
        assert.equal(fades[0].count, 2)
        assert.equal(await page.frameLocator(`#${videoId}`).locator('video').evaluate(video => video.videoWidth), 64)
      }
    } finally { await close() }
  })
}

test('本地视频之间保留旧播放器，使用同一时长与曲线渐变并清理资源', async () => {
  const { page, close } = await setup()
  try {
    await page.getByRole('checkbox', { name: '启用 red', exact: true }).check()
    await ready(page); await settle(page)
    await page.getByRole('checkbox', { name: '启用 blue', exact: true }).check()
    await ready(page)
    const frame = page.frameLocator(`#${videoId}`)
    const proof = await frame.locator('body').evaluate(() => fades.map(({ animation, count }) => ({ count, duration: animation.effect.getTiming().duration, easing: animation.effect.getTiming().easing })))
    assert.equal(proof.length, 1, '切换本地视频必须创建渐变，不能立即替换旧播放器')
    assert.deepEqual(proof[0], { count: 2, duration: 550, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' })
    await page.waitForFunction(id => document.getElementById(id).contentDocument.querySelectorAll('video').length === 1, videoId)
    const firstPlayer = await frame.locator('video').evaluate(video => video.src)
    await page.evaluate(async () => controller.videoLibrary.list())
    assert.equal(await frame.locator('video').evaluate(video => video.src), firstPlayer, '读取素材库不能重载正在播放的视频')
    await page.getByRole('checkbox', { name: '启用 red', exact: true }).check()
    await ready(page)
    await page.getByRole('checkbox', { name: '启用 blue', exact: true }).check()
    await ready(page)
    await page.waitForFunction(id => document.getElementById(id).contentDocument.querySelectorAll('video').length === 1, videoId)
    assert.equal(await page.getByRole('checkbox', { name: '启用 blue', exact: true }).isChecked(), true)
    assert.equal(await frame.locator('body').evaluate(() => liveBlobUrls.size), 1, '渐变结束后只保留当前视频的 Blob URL')
    await page.locator('#__dsh-backspace-panel__-enabled').uncheck()
    assert.equal(await frame.locator('video').evaluate(video => video.paused), true)
    await page.evaluate(() => controller.stop())
    assert.equal(await page.locator(`#${videoId}`).count(), 0)
  } finally { await close() }
})

test('视频交叠期间快速切换第三种皮肤、反向切回和关闭总开关', async () => {
  const { page, close } = await setup()
  const duringFade = async () => {
    await page.waitForFunction(() => controller.getTransitionState().phase === 'crossfade')
    await page.evaluate(() => {
      const animation = document.getAnimations().find(item => item.effect?.target instanceof HTMLIFrameElement)
      animation.pause(); animation.currentTime = 180
    })
  }
  try {
    await page.getByRole('checkbox', { name: '启用 red', exact: true }).check()
    await ready(page); await settle(page)
    await page.locator('[data-skin="ocean"]').click(); await duringFade()
    await page.locator('[data-skin="horizon"]').click()
    await page.waitForFunction(() => controller.getTransitionState().visible === 'horizon' && controller.getTransitionState().phase === 'idle')
    assert.equal((await page.evaluate(() => controller.getTransitionState())).frameCount, 1)
    assert.equal(await page.locator(`#${videoId}`).count(), 0)
    await page.locator('[data-skin="video"]').click()
    await ready(page); await settle(page)
    await page.locator('[data-skin="ocean"]').click(); await duringFade()
    await page.locator('[data-skin="video"]').click(); await settle(page)
    assert.equal((await page.evaluate(() => controller.getTransitionState())).visible, 'video')
    assert.equal(await page.frameLocator(`#${videoId}`).locator('video').evaluate(video => video.videoWidth), 64)
    await page.locator('[data-skin="ocean"]').click(); await duringFade()
    await page.locator('#__dsh-backspace-panel__-enabled').uncheck()
    assert.equal(await page.locator('iframe').count(), 0)
    await page.locator('#__dsh-backspace-panel__-enabled').check(); await settle(page)
    assert.equal((await page.evaluate(() => controller.getTransitionState())).visible, 'ocean')
  } finally { await close() }
})
