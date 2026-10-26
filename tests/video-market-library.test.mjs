import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory } from '../scripts/browser-support.mjs'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.omo/market-B-20261027/video-library')

test('真实视频库：来源验证、幂等、显式应用、失败回滚、关闭与停止生命周期', async () => {
  await mkdir(output, { recursive: true })
  const sample = resolve(output, 'sample.mp4')
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=size=32x32:rate=2', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', sample])
  const bytes = await readFile(sample)
  const source = { provider: 'zed-space', assetId: 'official-test', sha256: createHash('sha256').update(bytes).digest('hex') }
  const server = await serveDirectory(root)
  const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true, args: chromiumArgs() })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.route('**/shared/video.html?*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><script type="module" src="./video.js"></script>' }))
    await page.goto(`${server.url}/tests/fixtures/generic/index.html`)
    await page.addScriptTag({ path: resolve(root, 'shared/skin-core.js') })
    await page.evaluate(async () => {
      window.controller = BackspaceSkinCore.createController({
        assetUrl: file => `${location.origin}/shared/${file}`,
        locale: 'zh-CN', storage: { get: async defaults => ({ ...defaults, enabled: false }), set: async () => {} },
        onDiscoverVideos: () => { window.discovered = true },
      })
      await controller.start()
    })
    const result = await page.evaluate(async ({ bytes, source }) => {
      const file = new File([new Uint8Array(bytes)], 'official.mp4', { type: 'video/mp4' })
      const first = await controller.videoLibrary.import(file, source)
      const duplicate = await controller.videoLibrary.import(file, source)
      const stateAfterImport = controller.getState()
      const invalid = []
      for (const bad of [undefined, { ...source, sha256: '0'.repeat(64) }, { ...source, provider: 'other' }, { ...source, url: 'http://evil.test' }]) {
        try { await controller.videoLibrary.import(file, bad); invalid.push('accepted') } catch (error) { invalid.push(error.message) }
      }
      await controller.videoLibrary.apply(first.id)
      const selected = await controller.videoLibrary.list()
      let failedApply
      try { await controller.videoLibrary.apply('missing'); failedApply = false } catch { failedApply = true }
      const afterFailure = await controller.videoLibrary.list()
      return { first, duplicate, stateAfterImport, invalid, selected, failedApply, afterFailure, state: controller.getState() }
    }, { bytes: [...bytes], source })
    assert.equal(result.first.reused, false)
    assert.equal(result.duplicate.reused, true)
    assert.equal(result.first.id, result.duplicate.id)
    assert.equal(result.duplicate.items.length, 1)
    assert.equal(result.first.activeId, null)
    assert.equal(result.stateAfterImport.enabled, false)
    assert.deepEqual(result.invalid, ['source', 'hash', 'source', 'source'])
    assert.equal(result.selected.activeId, result.first.id)
    assert.equal(result.failedApply, true)
    assert.equal(result.afterFailure.activeId, result.first.id)
    assert.equal(result.state.skin, 'video')
    assert.equal(result.state.enabled, true)
    const rename = await page.evaluate(async ({ bytes, source, id }) => {
      const frame = document.querySelector('#__dsh-backspace-video__')
      const token = new URL(frame.src).searchParams.get('token')
      const reply = await new Promise(resolve => {
        const receive = event => {
          if (event.source !== frame.contentWindow || event.data.requestId !== 90001) return
          removeEventListener('message', receive); resolve(event.data)
        }
        addEventListener('message', receive)
        frame.contentWindow.postMessage({ type: 'bs-video', token, requestId: 90001, action: 'rename', name: '我的收藏', id, paused: false }, location.origin)
      })
      const imported = await controller.videoLibrary.import(new File([new Uint8Array(bytes)], 'changed.mp4'), source)
      return { renamed: reply.ok, name: imported.items[0].name, reused: imported.reused, activeId: imported.activeId }
    }, { bytes: [...bytes], source, id: result.first.id })
    assert.deepEqual(rename, { renamed: true, name: '我的收藏', reused: true, activeId: result.first.id })
    const damagedId = await page.evaluate(async ({ bytes, source }) => {
      return (await controller.videoLibrary.import(new File([new Uint8Array(bytes)], 'damaged.mp4'), { ...source, assetId: 'damaged' })).id
    }, { bytes: [...bytes], source })
    await page.frames().find(frame => frame.url().includes('/shared/video.html')).evaluate(async id => {
      const db = await new Promise(resolve => { const request = indexedDB.open('backspace-videos'); request.onsuccess = () => resolve(request.result) })
      await new Promise(resolve => {
        const tx = db.transaction('clips', 'readwrite'); tx.oncomplete = resolve
        const store = tx.objectStore('clips'); const request = store.getAll()
        request.onsuccess = () => { const clip = request.result.find(item => item.id === id); store.put({ ...clip, blob: new Blob(['corrupt']) }) }
      })
      db.close()
    }, damagedId)
    const damaged = await page.evaluate(async id => {
      let error
      try { await controller.videoLibrary.apply(id) } catch (failure) { error = failure.message }
      return { error, activeId: (await controller.videoLibrary.list()).activeId }
    }, damagedId)
    assert.ok(damaged.error)
    assert.equal(damaged.activeId, result.first.id)
    assert.equal(await page.frameLocator('#__dsh-backspace-video__').locator('video').evaluate(video => video.videoWidth), 32)
    const other = await page.context().newPage()
    await other.route('**/shared/video.html?*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><script type="module" src="./video.js"></script>' }))
    await other.goto(`${server.url.replace('127.0.0.1', 'localhost')}/tests/fixtures/generic/index.html`)
    await other.addScriptTag({ path: resolve(root, 'shared/skin-core.js') })
    const isolated = await other.evaluate(async ({ host, bytes, source }) => {
      const controller = BackspaceSkinCore.createController({ assetUrl: file => `${host}/shared/${file}`, storage: { get: async defaults => ({ ...defaults, enabled: false }), set: async () => {} } })
      await controller.start()
      const before = await controller.videoLibrary.list()
      const imported = await controller.videoLibrary.import(new File([new Uint8Array(bytes)], 'other.mp4'), source)
      const discovery = document.querySelector('.bs-video-discover') !== null
      controller.stop()
      return { count: before.items.length, id: imported.id, reused: imported.reused, discovery }
    }, { host: server.url, bytes: [...bytes], source })
    assert.equal(isolated.count, 0)
    assert.notEqual(isolated.id, result.first.id)
    assert.equal(isolated.reused, false)
    assert.equal(isolated.discovery, false)
    await other.close()
    await page.evaluate(() => controller.focusVideoDiscovery())
    assert.equal(await page.locator('.bs-video-discover').evaluate(element => element === document.activeElement), true)
    await page.getByRole('checkbox', { name: '启用 damaged', exact: true }).click()
    await page.locator('.bs-video-errors:not([hidden])').waitFor()
    assert.equal(await page.getByRole('checkbox', { name: '启用 我的收藏', exact: true }).isChecked(), true)
    await page.locator('.bs-video-discover').click()
    assert.equal(await page.evaluate(() => discovered), true)
    await page.locator('input[type=file]').setInputFiles(sample)
    await page.getByRole('checkbox', { name: '启用 sample', exact: true }).waitFor()
    assert.equal(await page.locator('.bs-video-tile').count(), 3)
    await page.screenshot({ path: resolve(output, 'library.png') })
    const stopped = await page.evaluate(async () => {
      controller.stop()
      try { await controller.videoLibrary.list(); return false } catch { return document.querySelector('#__dsh-backspace-video__') === null }
    })
    assert.equal(stopped, true)
    await page.route('**/shared/video.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 250))
      await route.continue()
    })
    const pending = await page.evaluate(async ({ bytes, source }) => {
      await controller.start()
      const operation = controller.videoLibrary.import(new File([new Uint8Array(bytes)], 'pending.mp4'), source)
      controller.focusVideoDiscovery()
      document.querySelector('.bs-close').click()
      const imported = await operation
      await new Promise(resolve => setTimeout(resolve, 20))
      const released = !document.querySelector('#__dsh-backspace-video__')
      const late = controller.videoLibrary.list().then(() => 'resolved', error => error.message)
      controller.stop()
      const cancelled = await late
      await new Promise(resolve => setTimeout(resolve, 300))
      return { reused: imported.reused, released, cancelled, noLateFrame: !document.querySelector('#__dsh-backspace-video__') }
    }, { bytes: [...bytes], source })
    assert.deepEqual(pending, { reused: true, released: true, cancelled: 'cancelled', noLateFrame: true })
    await writeFile(resolve(output, 'observables.json'), JSON.stringify({ result, rename, damaged, isolated, stopped, pending }, null, 2))
  } finally { await browser.close(); await server.close() }
})
