import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory } from '../scripts/browser-support.mjs'

const root = resolve(import.meta.dirname, '..')

test('发现页不可用时可返回本地视频，服务恢复后可以重试进入', { timeout: 45000 }, async () => {
  const server = await serveDirectory(root)
  const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    page.setDefaultTimeout(12000)
    let available = false
    await page.route('https://zed-space.ai-cove.com/wallpapers?*', route => available
      ? route.fulfill({ contentType: 'text/html', body: `<script>const q=new URLSearchParams(location.search);parent.postMessage({channel:'zed-space-market',version:1,session:q.get('session'),type:'ready'},q.get('parentOrigin'))</script>` })
      : route.abort('connectionrefused'))
    await page.goto(`${server.url}/tests/fixtures/generic/index.html`)
    await page.addScriptTag({ path: resolve(root, 'shared/market-download.js') })
    await page.addScriptTag({ path: resolve(root, 'shared/market-client.js') })
    await page.evaluate(() => {
      const entry = document.createElement('button')
      entry.id = 'open-market'; entry.textContent = '发现官方精美动态皮肤'; document.body.append(entry)
      window.libraryCalls = 0
      const unused = () => { libraryCalls++; throw new Error('unavailable page must not touch the video library') }
      window.market = ZedSpaceMarket.create({ assetUrl: path => path, videoLibrary: { list: unused, import: unused, apply: unused }, onClose: () => entry.focus() })
      entry.onclick = () => market.open()
    })
    const unavailable = page.locator('.zs-market-connection[data-state="unavailable"]')
    await page.locator('#open-market').click()
    await unavailable.waitFor()
    assert.match(await unavailable.textContent(), /暂时无法连接官方动态皮肤平台/)
    assert.match(await unavailable.textContent(), /继续导入本地视频/)
    assert.equal(await page.locator('.zs-market iframe').evaluate(frame => frame.inert), true)
    assert.equal(await page.evaluate(() => libraryCalls), 0)
    await unavailable.getByRole('button', { name: '返回本地视频', exact: true }).click()
    assert.equal(await page.locator('.zs-market').count(), 0)
    assert.equal(await page.locator('#open-market').evaluate(button => button === document.activeElement), true)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')

    await page.locator('#open-market').click()
    await unavailable.waitFor()
    available = true
    await unavailable.getByRole('button', { name: '重试', exact: true }).click()
    await page.locator('.zs-market-connection[data-state="ready"]').waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.querySelector('.zs-market iframe')?.inert === false)
    assert.equal(await page.locator('.zs-market').count(), 1)
    assert.equal(await unavailable.count(), 0)
    assert.equal(await page.evaluate(() => libraryCalls), 0)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.zs-market').count(), 0)
    assert.equal(await page.locator('#open-market').evaluate(button => button === document.activeElement), true)
    await page.evaluate(() => market.dispose())
  } finally { await browser.close(); await server.close() }
})
