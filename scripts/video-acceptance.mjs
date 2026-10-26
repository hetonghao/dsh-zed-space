import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/video-background/acceptance')
await mkdir(output, { recursive: true })
const sample = resolve(output, 'sample.mp4')
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', sample])
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true, args: chromiumArgs() })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.setDefaultTimeout(5000)
const results = []
const errors = []
page.on('pageerror', error => errors.push(String(error)))
try {
  await page.route('**/dsh-zed-space/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/dsh-zed-space/', 'native-dist/')
    const body = await readFile(resolve(root, path))
    await route.fulfill({ body, contentType: path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript' })
  })
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
  await page.addScriptTag({ content: await readFile(resolve(root, 'native-dist/loader.js'), 'utf8') })
  await page.getByRole('button', { name: 'Zed Space Skin 皮肤设置', exact: true }).click()
  await page.getByRole('tab', { name: '本地视频', exact: true }).click()
  await page.waitForFunction(() => {
    const button = document.querySelector('.bs-video-import')
    return button && !button.disabled
  })
  await page.locator('#__dsh-backspace-panel__-video-files').setInputFiles(sample)
  const choice = page.getByRole('checkbox', { name: '启用 sample', exact: true })
  await choice.waitFor()
  await choice.check()
  await page.waitForFunction(() => {
    const video = document.querySelector('#__dsh-backspace-video__')?.contentDocument?.querySelector('video')
    return video && !video.paused && video.videoWidth === 320
  })
  assert.equal(await choice.isChecked(), true)
  assert.equal(await page.locator('.bs-video-grid img').count(), 1)
  results.push({ scenario: '本地导入、缩略图与选择播放', result: 'PASS' })
  await page.locator('#__dsh-backspace-panel__-video-files').setInputFiles({ name: 'second.mp4', mimeType: 'text/plain', buffer: await readFile(sample) })
  await page.getByRole('checkbox', { name: '启用 second', exact: true }).check()
  assert.equal(await choice.isChecked(), false, 'only one video is enabled')
  await page.getByRole('button', { name: '重命名 second', exact: true }).click()
  const rename = page.getByRole('textbox', { name: '重命名 second', exact: true })
  await rename.fill('我的视频 <img src=x onerror=alert(1)>')
  await rename.press('Enter')
  const renamed = '我的视频 <img src=x onerror=alert(1)>'
  await page.getByRole('checkbox', { name: `启用 ${renamed}`, exact: true }).waitFor()
  await page.reload()
  await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
  await page.addScriptTag({ content: await readFile(resolve(root, 'native-dist/loader.js'), 'utf8') })
  await page.getByRole('button', { name: 'Zed Space Skin 皮肤设置', exact: true }).click()
  await page.getByRole('checkbox', { name: `启用 ${renamed}`, exact: true }).waitFor()
  assert.equal(await page.getByRole('checkbox', { name: `启用 ${renamed}`, exact: true }).isChecked(), true)
  assert.equal(await page.locator('.bs-video-grid img').count(), 2)
  assert.equal(await page.locator('.bs-video-grid img[src="x"]').count(), 0)
  results.push({ scenario: '多视频互斥、伪造 MIME 仍读取真实容器、重命名与重启恢复', result: 'PASS' })
  await page.getByRole('button', { name: `移除 ${renamed}`, exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.bs-video-grid img').length === 1)
  await page.waitForFunction(() => {
    const frame = document.querySelector('#__dsh-backspace__')
    return frame && getComputedStyle(frame).opacity === '1'
  })
  assert.equal(await page.frameLocator('#__dsh-backspace-video__').locator('video').count(), 0)
  await page.reload()
  await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
  await page.addScriptTag({ content: await readFile(resolve(root, 'native-dist/loader.js'), 'utf8') })
  await page.getByRole('button', { name: 'Zed Space Skin 皮肤设置', exact: true }).click()
  await page.getByRole('checkbox', { name: '启用 sample', exact: true }).waitFor()
  assert.equal(await page.locator('.bs-video-grid img').count(), 1)
  assert.equal(await page.getByRole('checkbox', { name: '启用 sample', exact: true }).isChecked(), false)
  results.push({ scenario: '移除当前视频回退海面、重启后不恢复已移除素材、其余素材保留', result: 'PASS' })
  const makeVideo = (name, input, seconds, codec, extra = []) => {
    const path = resolve(output, name)
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', input, '-t', seconds, '-c:v', codec, ...extra, '-y', path])
    return path
  }
  const long = makeVideo('long.mp4', 'color=size=16x16:rate=1', '31', 'libx264')
  const wide = makeVideo('wide.mp4', 'color=size=2000x1080:rate=1', '1', 'libx264')
  const vp8 = makeVideo('vp8.webm', 'color=size=320x180:rate=1', '1', 'libvpx')
  const audio = resolve(output, 'audio.mp4')
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '1', '-c:a', 'aac', '-y', audio])
  const validBytes = await readFile(sample)
  const broken = Buffer.from(validBytes)
  broken.writeUInt32BE(0x7fffffff, broken.indexOf('moov') - 4)
  await page.setViewportSize({ width: 1280, height: 720 })
  for (const [name, buffer, message] of [
    ['empty.mp4', Buffer.alloc(0), /文件为空/],
    ['large.mp4', Buffer.alloc(32 * 1024 * 1024 + 1), /32 MB/],
    ['renamed-image.mp4', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'base64'), /MP4 或 WebM/],
    ['bad-moov.mp4', broken, /MP4 或 WebM/],
    ['truncated.mp4', validBytes.subarray(0, 128), /MP4 或 WebM/],
    ['long.mp4', await readFile(long), /0–30 秒/],
    ['wide.mp4', await readFile(wide), /1920×1080/],
    ['vp8.webm', await readFile(vp8), /H.264、VP9 或 AV1/],
    ['audio.mp4', await readFile(audio), /没有有效视频轨/],
  ]) {
    const started = performance.now()
    await page.locator('#__dsh-backspace-panel__-video-files').setInputFiles({ name, mimeType: 'video/mp4', buffer })
    await page.getByRole('alert').filter({ hasText: message }).waitFor()
    const errorBox = await page.getByRole('alert').filter({ hasText: message }).boundingBox()
    const footerBox = await page.locator('.bs-footer').boundingBox()
    assert.ok(errorBox.y >= 0 && errorBox.y + errorBox.height <= footerBox.y + 1, 'import errors must be readable above the fixed footer')
    assert.equal(await page.locator('.bs-video-grid img').count(), 1, `${name} must not overwrite the library`)
    if (['empty.mp4', 'bad-moov.mp4', 'truncated.mp4', 'renamed-image.mp4'].includes(name)) assert.ok(performance.now() - started < 3000, `${name} rejection must be bounded`)
    results.push({ scenario: `拒绝 ${name}`, result: 'PASS' })
  }
  const vp9 = makeVideo('vp9.webm', 'testsrc2=size=320x180:rate=2', '1', 'libvpx-vp9')
  await page.locator('#__dsh-backspace-panel__-video-files').setInputFiles([
    { name: 'valid-vp9.webm', mimeType: 'text/plain', buffer: await readFile(vp9) },
    { name: 'broken.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(0) },
    { name: '<img src=x onerror=alert(1)>.mp4', mimeType: 'video/mp4', buffer: validBytes },
  ])
  await page.getByRole('checkbox', { name: '启用 <img src=x onerror=alert(1)>', exact: true }).waitFor()
  assert.equal(await page.locator('.bs-video-grid img').count(), 3)
  assert.equal(await page.locator('.bs-video-grid img[src="x"]').count(), 0)
  await page.getByRole('checkbox', { name: '启用 valid-vp9', exact: true }).check()
  await page.waitForFunction(() => {
    const video = document.querySelector('#__dsh-backspace-video__')?.contentDocument?.querySelector('video')
    return video && !video.paused
  })
  results.push({ scenario: '批量导入遇到坏文件仍继续、VP9 播放、文件名按纯文本显示', result: 'PASS' })
  assert.deepEqual(errors, [])
} catch (error) {
  console.error(await page.locator('.bs-video-group').textContent())
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true })
  throw error
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  await browser.close()
  await server.close()
}
console.log(`PASS: ${results.length} video scenarios`)
