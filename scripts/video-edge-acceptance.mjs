import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/video-background/edges')
await mkdir(output, { recursive: true })
const sample = resolve(output, 'sample.mp4')
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '1', '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-y', sample])
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true, args: chromiumArgs() })
const loader = await readFile(resolve(root, 'native-dist/loader.js'), 'utf8')
const results = []
async function boot(fault) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.route('**/dsh-zed-space/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/dsh-zed-space/', 'native-dist/')
    let body = await readFile(resolve(root, path))
    // 在 iframe 实际文档加载模块之前注入浏览器故障，避开初始 about:blank 的时序。
    if (fault && path.endsWith('/video.html')) body = Buffer.from(body.toString().replace('<head>', `<head><script>(${fault.toString()})()</script>`))
    await route.fulfill({ body, contentType: path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript' })
  })
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
  await page.addScriptTag({ content: loader })
  await page.getByRole('button', { name: 'Zed Space Skin 皮肤设置', exact: true }).click()
  await page.getByRole('tab', { name: '本地视频', exact: true }).click()
  await ready(page)
  return { context, page, errors }
}
const ready = page => page.waitForFunction(() => {
  const button = document.querySelector('.bs-video-import')
  return button && !button.disabled
})
const importFile = async (page, file = sample) => {
  await page.locator('#__dsh-backspace-panel__-video-files').setInputFiles(file)
  await ready(page)
}
try {
  for (const [name, fault, message] of [
    ['metadata-timeout', () => {
      if (location.pathname.endsWith('/video.html')) Object.defineProperty(HTMLMediaElement.prototype, 'src', { set() {}, get() { return '' } })
    }, /读取视频超时/],
    ['infinite-duration', () => {
      if (location.pathname.endsWith('/video.html')) Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get() { return Infinity } })
    }, /0–30 秒/],
    ['zero-video-track', () => {
      if (location.pathname.endsWith('/video.html')) Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get() { return 0 } })
    }, /没有有效视频轨/],
    ['storage-quota', () => {
      if (location.pathname.endsWith('/video.html')) IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError') }
    }, /本地存储不可用或空间不足/],
  ]) {
    const { context, page, errors } = await boot(fault)
    const start = performance.now()
    await importFile(page)
    try { await page.getByRole('alert').filter({ hasText: message }).waitFor() }
    catch (error) {
      console.error(name, await page.locator('.bs-video-group').textContent(), errors)
      throw error
    }
    if (name === 'metadata-timeout') assert.ok(performance.now() - start < 3800, 'metadata timeout plus UI delivery stays bounded')
    assert.equal(await page.locator('.bs-video-grid img').count(), 0)
    assert.equal(await page.locator('#__dsh-backspace__').evaluate(frame => getComputedStyle(frame).opacity), '1')
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: name, result: 'PASS' })
  }
  {
    const { context, page, errors } = await boot(() => {
      if (location.pathname.endsWith('/video.html')) HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    })
    await importFile(page)
    await page.getByRole('checkbox', { name: '启用 sample', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: /播放被浏览器阻止/ }).waitFor()
    assert.equal(await page.locator('#__dsh-backspace__').evaluate(frame => getComputedStyle(frame).opacity), '1')
    assert.equal(await page.getByRole('checkbox', { name: '启用 sample', exact: true }).isChecked(), false)
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: 'autoplay-rejection-falls-back-without-unhandled-rejection', result: 'PASS' })
  }
  {
    const rotated = resolve(output, 'portrait.mp4')
    execFileSync('ffmpeg', ['-v', 'error', '-display_rotation', '90', '-i', sample, '-c', 'copy', '-y', rotated])
    const { context, page, errors } = await boot()
    await importFile(page, rotated)
    await page.getByRole('checkbox', { name: '启用 portrait', exact: true }).check()
    await ready(page)
    const media = await page.frameLocator('#__dsh-backspace-video__').locator('video').evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, muted: video.muted, fit: getComputedStyle(video).objectFit }))
    assert.deepEqual(media, { width: 180, height: 320, muted: true, fit: 'cover' })
    await page.evaluate(() => {
      const frame = document.querySelector('#__dsh-backspace-video__')
      const id = document.querySelector('.bs-video-grid input').dataset.videoId
      const token = new URL(frame.src).searchParams.get('token')
      frame.contentWindow.postMessage({ type: 'bs-video', token: 'wrong', requestId: 999, action: 'remove', id, paused: false }, location.origin)
      const sibling = document.createElement('iframe')
      document.body.append(sibling)
      sibling.contentWindow.eval(`parent.document.querySelector('#__dsh-backspace-video__').contentWindow.postMessage(${JSON.stringify({ type: 'bs-video', token, requestId: 1000, action: 'select', id: null, paused: false })}, parent.location.origin)`)
      window.postMessage({ type: 'bs-video', token, event: 'failure', code: 'missing' }, location.origin)
    })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await page.getByRole('alert').filter({ hasText: /本机找不到/ }).count(), 0)
    await page.getByRole('button', { name: '重命名 portrait', exact: true }).click()
    const input = page.getByRole('textbox', { name: '重命名 portrait', exact: true })
    await input.fill('安全的竖屏视频')
    await input.press('Enter')
    await ready(page)
    assert.equal(await page.getByRole('checkbox', { name: '启用 安全的竖屏视频', exact: true }).isChecked(), true)
    await page.getByRole('button', { name: '重命名 安全的竖屏视频', exact: true }).click()
    const cancelInput = page.getByRole('textbox', { name: '重命名 安全的竖屏视频', exact: true })
    await cancelInput.fill('取消此修改')
    await cancelInput.press('Escape')
    assert.equal(await page.getByRole('checkbox', { name: '启用 安全的竖屏视频', exact: true }).isChecked(), true)
    assert.equal(await page.getByRole('alert').filter({ hasText: /本机找不到/ }).count(), 0)
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: 'portrait-metadata-muted-playback-invalid-messages-and-rename-cancel', result: 'PASS' })
  }
  {
    const av1 = resolve(output, 'av1.mp4')
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=320x180:rate=1', '-t', '1', '-c:v', 'libsvtav1', '-preset', '12', '-svtav1-params', 'lp=2', '-crf', '50', '-y', av1], { stdio: 'pipe' })
    const { context, page, errors } = await boot()
    await importFile(page, av1)
    await page.getByRole('checkbox', { name: '启用 av1', exact: true }).check()
    await ready(page)
    assert.equal(await page.frameLocator('#__dsh-backspace-video__').locator('video').evaluate(video => !video.paused), true)
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: 'av1-import-and-playback', result: 'PASS' })
  }
  {
    const { context, page, errors } = await boot()
    await importFile(page)
    await page.getByRole('switch', { name: '启用 Zed Space Skin 皮肤', exact: true }).uncheck()
    await ready(page)
    await importFile(page, { name: 'while-disabled.mp4', mimeType: 'video/mp4', buffer: await readFile(sample) })
    await page.getByRole('checkbox', { name: '启用 while-disabled', exact: true }).check()
    await ready(page)
    assert.equal(await page.frameLocator('#__dsh-backspace-video__').locator('video').evaluate(video => video.paused), true, 'the global switch must prevent playback even while managing files')
    await page.getByRole('switch', { name: '启用 Zed Space Skin 皮肤', exact: true }).check()
    await page.waitForFunction(() => !document.querySelector('#__dsh-backspace-video__').contentDocument.querySelector('video').paused)
    await page.getByRole('switch', { name: '启用 Zed Space Skin 皮肤', exact: true }).uncheck()
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    assert.equal(await page.locator('#__dsh-backspace-video__').count(), 0)
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: 'disabled-management-does-not-play-and-closing-releases-media', result: 'PASS' })
  }
  {
    const { context, page, errors } = await boot()
    await importFile(page)
    await page.getByRole('checkbox', { name: '启用 sample', exact: true }).check()
    await ready(page)
    await page.frameLocator('#__dsh-backspace-video__').locator('body').evaluate(() => {
      IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError') }
    })
    await importFile(page, { name: 'quota.mp4', mimeType: 'video/mp4', buffer: await readFile(sample) })
    await page.getByRole('alert').filter({ hasText: /空间不足/ }).waitFor()
    assert.equal(await page.locator('.bs-video-grid img').count(), 1)
    assert.equal(await page.getByRole('checkbox', { name: '启用 sample', exact: true }).isChecked(), false)
    await page.reload()
    await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
    await page.addScriptTag({ content: loader })
    await page.getByRole('button', { name: 'Zed Space Skin 皮肤设置', exact: true }).click()
    await page.getByRole('checkbox', { name: '启用 sample', exact: true }).check()
    await ready(page)
    assert.equal(await page.frameLocator('#__dsh-backspace-video__').locator('video').evaluate(video => !video.paused), true)
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: 'quota-failure-preserves-existing-file-and-allows-recovery', result: 'PASS' })
  }
  {
    const { context, page, errors } = await boot()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await importFile(page)
    await page.getByRole('checkbox', { name: '启用 sample', exact: true }).check()
    await ready(page)
    assert.deepEqual(await page.frameLocator('#__dsh-backspace-video__').locator('video').evaluate(video => ({ paused: video.paused, width: video.videoWidth })), { paused: true, width: 320 })
    assert.equal(await page.locator('#__dsh-backspace-video__').evaluate(frame => getComputedStyle(frame).opacity), '1')
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: 'reduced-motion-keeps-a-visible-still-frame', result: 'PASS' })
  }
  for (const replacePlayer of [true, false]) {
    const { context, page, errors } = await boot()
    await importFile(page)
    await importFile(page, { name: 'next.mp4', mimeType: 'video/mp4', buffer: await readFile(sample) })
    await page.getByRole('checkbox', { name: '启用 sample', exact: true }).check()
    await ready(page)
    await page.frameLocator('#__dsh-backspace-video__').locator('body').evaluate(() => {
      const play = HTMLMediaElement.prototype.play
      let delay = true
      HTMLMediaElement.prototype.play = function () {
        const actual = play.call(this)
        if (!delay) return actual
        delay = false
        actual.catch(() => {})
        return new Promise((_resolve, reject) => { window.__testRejectStalePlay = name => reject(new DOMException('old playback', name)) })
      }
    })
    const toggle = page.getByRole('switch', { name: '启用 Zed Space Skin 皮肤', exact: true })
    await toggle.uncheck(); await toggle.check()
    if (replacePlayer) {
      await page.getByRole('checkbox', { name: '启用 next', exact: true }).check()
      await ready(page)
    } else { await toggle.uncheck(); await toggle.check() }
    await page.frameLocator('#__dsh-backspace-video__').locator('body').evaluate((_body, name) => window.__testRejectStalePlay(name), replacePlayer ? 'AbortError' : 'NotAllowedError')
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const selected = replacePlayer ? 'next' : 'sample'
    await page.getByRole('button', { name: `重命名 ${selected}`, exact: true }).click()
    const name = page.getByRole('textbox', { name: `重命名 ${selected}`, exact: true })
    await name.fill('保留启用状态'); await name.press('Enter'); await ready(page)
    assert.equal(await page.getByRole('checkbox', { name: '启用 保留启用状态', exact: true }).isChecked(), true, 'a stale play rejection must not clear the newer selection or playback attempt')
    assert.equal(await page.frameLocator('#__dsh-backspace-video__').locator('video').evaluate(video => !video.paused), true)
    assert.deepEqual(errors, [])
    await context.close()
    results.push({ scenario: replacePlayer ? 'stale-player-rejection-does-not-stop-new-video' : 'stale-resume-rejection-does-not-clear-new-play-attempt', result: 'PASS' })
  }
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await browser.close()
  await server.close()
}
console.log(`PASS: ${results.length} video edge scenarios`)
