import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory, setRange, waitForOcean, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = await serveDirectory(root)
const browser = await chromium.launch({
  executablePath: await findChromeForTesting(chromium.executablePath()),
  headless: process.env.BACKSPACE_HEADLESS === '1', args: chromiumArgs(),
})
const baseline = process.env.BACKSPACE_DESKTOP_BASELINE === '1'
const output = resolve(root, 'output/playwright')
await mkdir(output, { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const failures = watchPageErrors(page, 'desktop')
  await page.route('**/dsh-zed-space/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `${server.url}/extension/${url.pathname.split('/dsh-zed-space/')[1]}${url.search}` })
    await route.fulfill({ response })
  })
  await page.goto(`${server.url}/tests/fixtures/desktop/index.html`)
  await page.evaluate(() => {
    localStorage.setItem('bsAutoCycle', 'false')
    localStorage.setItem('bsGlass', '40')
    // These combinations assert one shared glass across the three columns. The
    // product default now enables the independent conversation background, so
    // pin it off here rather than depending on the shipped default.
    localStorage.setItem('bsChatCustom', 'false')
    window.__ModuleLoader__ = { load({ factory }) {
      const plugin = factory(() => {})
      plugin.apply({ effect(fn) { window.stopBackspace = fn() } })
    } }
  })
  if (baseline) await page.addScriptTag({ content: execFileSync('git', ['show', 'v1.2.2:plugin/client.js'], { cwd: root, encoding: 'utf8' }) })
  else await page.addScriptTag({ path: resolve(root, 'plugin/client.js') })
  await waitForOcean(page)
  // The renderer fades its loading veil after marking the canvas ready.
  await page.waitForTimeout(1200)
  await page.screenshot({ path: resolve(output, baseline ? 'desktop-before.png' : 'desktop-dark-40.png') })
  await page.locator('#__dsh-backspace-btn__').click()
  let cases = 0
  for (const mode of ['advanced', 'extended']) {
    for (const material of ['transparent', 'off']) {
      for (const dark of [true, false]) {
        for (const glass of [40, 65, 90]) {
          await page.evaluate(({ mode, material, dark }) => {
            document.body.dataset.dshDesktopMode = mode
            document.body.dataset.dshDesktopMaterial = material
            document.body.toggleAttribute('data-ds-dark-theme', dark)
          }, { mode, material, dark })
          await setRange(page.locator('#__dsh-backspace-panel__-glass-range'), glass)
          const paints = await page.evaluate(() => {
            const color = el => getComputedStyle(el).backgroundColor
            const alpha = el => {
              const rgba = color(el).match(/[\d.]+/g).map(Number)
              return rgba.length === 4 ? rgba[3] : 1
            }
            const effective = selector => {
              let total = 0
              for (let el = document.querySelector(selector); el && el !== document.body; el = el.parentElement) {
                total = 1 - (1 - total) * (1 - alpha(el))
              }
              return total
            }
            return {
              columns: ['.sidebarRoot', '.conversationRoot', '.detailsRoot'].map(effective),
              composer: alpha(document.querySelector('.composer')),
              dialog: alpha(document.querySelector('dialog')),
            }
          })
          const expected = dark ? Math.max(.4, glass / 100 - .12) : glass / 100
          for (const value of paints.columns) assert.ok(Math.abs(value - expected) < .005,
            `${mode}/${material}/${dark ? 'dark' : 'light'}/${glass}: columns ${JSON.stringify(paints.columns)} expected ${expected}`)
          assert.ok(paints.composer > .3 && paints.dialog > .3, 'interactive surfaces retain their fill')
          cases++
        }
      }
    }
  }
  // Independent conversation background: the conversation gets its own
  // opacity, while the sidebar and details columns keep the workspace glass.
  // The details column is the one that regressed while developing this: it
  // carries a nested fill, so it must stay at exactly one layer.
  const measure = (page) => page.evaluate(() => {
    const alpha = (element) => {
      const values = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]
      return values.length === 4 ? values[3] : 1
    }
    const effective = (selector) => {
      let total = 0
      for (let node = document.querySelector(selector); node && node !== document.body; node = node.parentElement) {
        total = 1 - (1 - total) * (1 - alpha(node))
      }
      return total
    }
    return {
      conversation: effective('.conversationRoot'),
      sidebar: effective('.sidebarRoot'),
      details: effective('.detailsRoot'),
    }
  })
  const chatBox = page.locator('#__dsh-backspace-panel__-chat')
  const chatSlider = page.locator('#__dsh-backspace-panel__-chat-range')
  await page.evaluate(() => {
    document.body.dataset.dshDesktopMode = 'advanced'
    document.body.dataset.dshDesktopMaterial = 'transparent'
    document.body.toggleAttribute('data-ds-dark-theme', true)
  })
  await setRange(page.locator('#__dsh-backspace-panel__-glass-range'), 40)
  const sharedPaints = await measure(page)
  for (const [key, value] of Object.entries(sharedPaints)) {
    assert.ok(Math.abs(value - .4) < .005, `shared glass: ${key} ${JSON.stringify(sharedPaints)}`)
  }
  assert.equal(await chatSlider.isVisible(), false, 'conversation slider is hidden by default')
  await chatBox.check()
  assert.equal(await chatSlider.isVisible(), true, 'conversation slider appears with its switch')
  for (const [percent, expected] of [[100, 1], [65, .65], [40, .4]]) {
    await setRange(chatSlider, percent)
    const paints = await measure(page)
    assert.ok(Math.abs(paints.conversation - expected) < .02,
      `${percent}%: conversation ${JSON.stringify(paints)} expected ${expected}`)
    for (const key of ['sidebar', 'details']) {
      assert.ok(Math.abs(paints[key] - .4) < .02, `${percent}%: ${key} keeps the workspace glass ${JSON.stringify(paints)}`)
    }
    // One layer only: no nested fill may compound on top of the column paint.
    assert.ok(paints.conversation <= expected + .02, `${percent}%: conversation does not compound ${JSON.stringify(paints)}`)
  }
  await chatBox.uncheck()
  assert.equal(await chatSlider.isVisible(), false, 'conversation slider hides when the switch is off')
  const restored = await measure(page)
  for (const [key, value] of Object.entries(restored)) {
    assert.ok(Math.abs(value - .4) < .005, `switch off restores shared glass: ${key} ${JSON.stringify(restored)}`)
  }

  // Live controls, overlay interaction, and full CSS restoration on disposal.
  await setRange(page.locator('#__dsh-backspace-panel__-glass-range'), 40)
  await page.locator('#__dsh-backspace-panel__ .bs-close').click()
  await page.screenshot({ path: resolve(output, 'desktop-light-40.png') })
  await page.locator('.settings button').click()
  assert.equal(await page.locator('dialog').isVisible(), true)
  await page.locator('dialog button').click()
  await page.locator('textarea').fill('Desktop glass regression')
  assert.equal(await page.locator('textarea').inputValue(), 'Desktop glass regression')
  await page.locator('#__dsh-backspace-btn__').click()
  await page.locator('#__dsh-backspace-panel__-enabled').uncheck()
  assert.equal(await page.locator('#__dsh-backspace-glass__').count(), 0)
  assert.equal(await page.locator('#__dsh-backspace__').count(), 0)
  await page.locator('#__dsh-backspace-panel__-enabled').check()
  await waitForOcean(page)
  assert.equal(await page.locator('#__dsh-backspace__').count(), 1)
  await page.evaluate(() => window.stopBackspace())
  assert.equal(await page.locator('#__dsh-backspace-glass__').count(), 0)
  assert.equal(await page.locator('#__dsh-backspace-btn__').count(), 0)
  assert.deepEqual(failures, [])
  console.log(`✓ Desktop shell: ${cases} mode/material/theme/opacity combinations, controls, dialogs, disable and disposal`)
} finally {
  await browser.close()
  await server.close()
}
