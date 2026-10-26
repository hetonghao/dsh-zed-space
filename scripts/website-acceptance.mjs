import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory, setRange, waitForOcean, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(process.env.BACKSPACE_SCREENSHOTS || resolve(root, 'output/playwright/website'))
await mkdir(output, { recursive: true })
const server = await serveDirectory(resolve(root, 'pages-dist'))
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true, args: chromiumArgs() })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const results = []
try {
  const page = await context.newPage()
  const failures = watchPageErrors(page, 'website')
  const failedResponses = []
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(server.url)) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.goto(server.url, { waitUntil: 'domcontentloaded' })
  const ocean = await waitForOcean(page, '#ocean-frame')
  await page.locator('#renderer-status.ready').waitFor()
  assert.equal(await page.locator('#hero-title').innerText(), 'Zed Space Skin')
  assert.equal(await page.locator('.brand-mark img').count(), 2)
  assert.equal(await page.locator('#install [data-copy]').count(), 0, 'unpublished candidate must not offer copy-and-install commands')
  assert.match(await page.locator('#install').innerText(), /npm、GitHub Release、插件市场和新版 Pages 均未发布/)
  const repo = await page.locator('.nav-github').getAttribute('href')
  assert.equal(repo, 'https://github.com/hetonghao/dsh-zed-space')
  const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))
  for (const href of links) {
    if (href.startsWith('#')) assert.equal(await page.locator(href).count(), 1, `missing section: ${href}`)
    else assert.equal(new URL(href).hostname, 'github.com')
    assert.equal(href.includes('/dsh-backspace'), false)
    assert.equal(href.includes('/releases/download/'), false)
  }
  results.push({ scenario: 'brand-candidate-status-and-navigation', result: 'PASS', links })
  await page.locator('[data-preset="sunset"]').click()
  await page.waitForFunction(() => Math.abs(document.querySelector('#ocean-frame').contentWindow.__bsState().daylight - 18) < .02)
  const sunset = await ocean.locator('body').evaluate(() => globalThis.__bsState())
  assert.ok(Math.abs(sunset.sea - .91) < .02)
  await setRange(page.locator('#transparency'), 74)
  assert.equal(await page.locator('#transparency-output').textContent(), '74%')
  assert.equal(await page.locator('html').evaluate(el => el.style.getPropertyValue('--glass-alpha')), '0.26')
  await page.locator('[data-preset="calm"]').click()
  results.push({ scenario: 'live-renderer-presets-and-transparency', result: 'PASS', daylight: sunset.daylight, sea: sunset.sea })
  await page.locator('#faq summary').nth(1).click()
  assert.equal(await page.locator('#faq details').nth(1).getAttribute('open'), '')
  assert.match(await page.locator('#faq details').nth(1).innerText(), /共享壁纸库属于规划/)
  await page.locator('#faq summary').nth(1).press('Enter')
  assert.equal(await page.locator('#faq details').nth(1).getAttribute('open'), null)
  for (const lang of ['zh', 'en']) {
    if (lang === 'en') await page.locator('#language-toggle').click()
    assert.equal(await page.locator('html').getAttribute('lang'), lang === 'zh' ? 'zh-CN' : 'en')
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['dark', 'light']) {
        await page.locator(`[data-theme-choice="${theme}"]`).click()
        assert.equal(await page.locator('html').getAttribute('data-ui-theme'), theme)
        await page.waitForFunction(() => [...document.querySelectorAll('.harness-capture')].every(img => img.complete && img.naturalWidth > 0))
        await page.locator('#gallery').scrollIntoViewIfNeeded()
        await page.waitForFunction(() => [...document.querySelectorAll('#gallery img')].every(img => img.complete && img.naturalWidth > 0))
        assert.equal(await page.locator('#gallery img').count(), 4)
        for (const section of await page.locator('.reveal').all()) {
          await section.scrollIntoViewIfNeeded()
          await page.waitForTimeout(250)
        }
        await page.locator('footer').scrollIntoViewIfNeeded()
        await page.waitForTimeout(700)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        const dock = await page.locator('.control-dock').boundingBox()
        const capture = await page.locator('.harness-window').boundingBox()
        assert.ok(capture.y >= dock.y + dock.height, 'capture must not overlap the control dock')
        const name = `${lang}-${width}-${theme}`
        await page.screenshot({ path: resolve(output, `${name}-end.png`) })
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
        await page.waitForTimeout(350)
        await page.screenshot({ path: resolve(output, `${name}-top.png`) })
        await page.screenshot({ path: resolve(output, `${name}-full.png`), fullPage: true })
        results.push({ scenario: name, result: 'PASS', horizontalOverflow: false, artifact: `${name}-full.png` })
      }
    }
  }
  assert.match(await page.title(), /Zed Space Skin/)
  assert.match(await page.locator('#install').innerText(), /not published/)
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(failures, [])
  await writeFile(resolve(output, 'website-results.json'), JSON.stringify({ status: 'PASS', results, failedResponses, failures }, null, 2))
  console.log('PASS: brand, status, navigation, ocean controls, FAQ, gallery, Chinese/English × 390/1440 × dark/light preview')
} finally {
  await context.close()
  await browser.close()
  await server.close()
  await writeFile(resolve(output, 'website-cleanup.json'), JSON.stringify({ contextClosed: true, browserClosed: true, serverClosed: true, actualHarnessAccessed: false }, null, 2))
}
