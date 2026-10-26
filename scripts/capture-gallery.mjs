import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'docs/screenshots')
const evidence = resolve(process.env.BACKSPACE_GALLERY_OUTPUT || resolve(root, 'output/playwright/gallery'))
await mkdir(output, { recursive: true })
await mkdir(evidence, { recursive: true })
const sample = resolve(evidence, 'local-video-demo.mp4')
execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=12', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', sample])
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true, args: chromiumArgs() })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const errors = []
const results = []
page.on('pageerror', error => errors.push(String(error)))
try {
  await page.route('**/dsh-zed-space/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/dsh-zed-space/', 'native-dist/')
    await route.fulfill({ body: await readFile(resolve(root, path)), contentType: path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript' })
  })
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.evaluate(() => {
    document.documentElement.lang = 'zh-CN'
    document.querySelector('.welcome h1').textContent = 'Zed Space Skin'
    document.querySelector('.welcome p').textContent = '动态背景与界面皮肤 · 隔离验收界面'
    document.querySelector('.history').innerHTML = '<div>海洋与宇宙双视角</div><div>每场景独立参数</div><div>本地视频库</div>'
    document.querySelector('.details').innerHTML = '<h2>隔离验收界面</h2><p>真实插件代码渲染</p><p>非原生 Harness 实拍</p>'
    document.querySelector('.prompt').textContent = '此界面仅用于验收与场景展示。'
  })
  await page.addScriptTag({ content: await readFile(resolve(root, 'native-dist/loader.js'), 'utf8') })
  await page.locator('#__dsh-backspace-btn__').click()
  const setTheme = async dark => {
    await page.evaluate(dark => {
      document.body.toggleAttribute('data-ds-dark-theme', dark)
      document.documentElement.style.setProperty('--dsw-alias-bg-base', dark ? '#141b24' : '#fff')
      document.documentElement.style.setProperty('--dsw-alias-bg-layer-1', dark ? '#172231' : '#f7f8fa')
      document.documentElement.style.setProperty('--dsw-specific-sidebar-fill', dark ? '#172231' : '#f5f6f8')
      document.body.style.color = dark ? '#e8f2fa' : '#17202a'
      for (const node of document.querySelectorAll('.welcome p')) node.style.color = 'inherit'
    }, dark)
  }
  const capture = async (skin, name, dark = true) => {
    await setTheme(dark)
    await page.locator(`[data-skin="${skin}"]`).click()
    await page.waitForFunction(skin => {
      const id = skin === 'ocean' ? '__dsh-backspace__' : '__dsh-backspace-cosmos__'
      const frame = document.getElementById(id)
      const state = frame?.contentWindow.__bsState?.()
      return state?.frames > 2 && (skin === 'ocean' || state.drawnSkin === skin && !state.transitioning) && Number(getComputedStyle(frame).opacity) === 1
    }, skin, { timeout: 45000 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: resolve(output, name) })
    results.push({ scenario: `${skin}-${dark ? 'dark' : 'light'}`, result: 'PASS', artifact: `docs/screenshots/${name}` })
  }
  await capture('ocean', 'zed-ocean.png')
  await capture('horizon', 'zed-horizon.png')
  await capture('horizon', 'zed-horizon-light.png', false)
  await capture('vortex', 'zed-vortex.png')
  await page.getByRole('tab', { name: '本地视频', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.bs-video-import')?.disabled)
  await page.locator('#__dsh-backspace-panel__-video-files').setInputFiles(sample)
  await page.getByRole('checkbox', { name: '启用 local-video-demo', exact: true }).check()
  await page.waitForFunction(() => {
    const video = document.querySelector('#__dsh-backspace-video__')?.contentDocument?.querySelector('video')
    return video && !video.paused && video.videoWidth === 640
  })
  await page.screenshot({ path: resolve(output, 'zed-video.png') })
  results.push({ scenario: 'local-video-import-and-play', result: 'PASS', artifact: 'docs/screenshots/zed-video.png' })
  assert.deepEqual(errors, [])
  await writeFile(resolve(evidence, 'gallery-results.json'), JSON.stringify({ status: 'PASS', source: 'tests/fixtures/harness/index.html + native-dist/loader.js', actualHarnessAccessed: false, results }, null, 2))
  console.log('PASS: 5 captures of real runtime in isolated fixture; local video imported and playing')
} finally {
  await context.close()
  await browser.close()
  await server.close()
  await rm(sample, { force: true })
  await writeFile(resolve(evidence, 'gallery-cleanup.json'), JSON.stringify({ browserClosed: true, contextClosed: true, serverClosed: true, temporaryVideoRemoved: true, actualHarnessAccessed: false }, null, 2))
}
