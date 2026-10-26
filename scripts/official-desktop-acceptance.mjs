import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { chromiumArgs, findChromeForTesting, serveDirectory, setRange, waitForOcean, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = await serveDirectory(root)
const browser = await chromium.launch({
  executablePath: await findChromeForTesting(chromium.executablePath()),
  headless: process.env.BACKSPACE_HEADLESS === '1', args: chromiumArgs(),
})

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const failures = watchPageErrors(page, 'official desktop')
  await page.route('**/dsh-zed-space/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `${server.url}/extension/${url.pathname.split('/dsh-zed-space/')[1]}${url.search}` })
    await route.fulfill({ response })
  })
  await page.goto(`${server.url}/tests/fixtures/official-desktop/index.html`)
  await page.evaluate(() => {
    localStorage.setItem('bsAutoCycle', 'false')
    localStorage.setItem('bsGlass', '40')
    // This block asserts one shared glass across all three columns. The product
    // default now ships the independent conversation background switched on, so
    // the baseline is pinned explicitly here instead of relying on defaults.
    localStorage.setItem('bsChatCustom', 'false')
    window.__ModuleLoader__ = { load({ factory }) {
      const plugin = factory(() => {})
      plugin.apply({ effect(fn) { window.stopBackspace = fn() } })
    } }
  })
  await page.addScriptTag({ path: resolve(root, 'plugin/client.js') })
  await waitForOcean(page)

  for (const platform of ['darwin', 'windows']) {
    for (const dark of [true, false]) {
      for (const glass of [40, 90]) {
      await setRange(page.locator('#__dsh-backspace-panel__-glass-range'), glass)
      await page.evaluate(({ platform, dark }) => {
        document.documentElement.toggleAttribute('data-windows-titlebar', platform === 'windows')
        if (platform === 'darwin') document.documentElement.dataset.platform = 'darwin'
        else delete document.documentElement.dataset.platform
        document.body.toggleAttribute('data-ds-dark-theme', dark)
        document.querySelector('.settings').classList.add('open')
      }, { platform, dark })
      const paints = await page.evaluate(() => {
        const alpha = selector => {
          const values = getComputedStyle(document.querySelector(selector)).backgroundColor.match(/[\d.]+/g).map(Number)
          return values.length === 4 ? values[3] : 1
        }
        const effective = selector => {
          let result = 0
          for (let node = document.querySelector(selector); node && node !== document.body; node = node.parentElement) {
            const values = getComputedStyle(node).backgroundColor.match(/[\d.]+/g).map(Number)
            const value = values.length === 4 ? values[3] : 1
            result = 1 - (1 - result) * (1 - value)
          }
          return result
        }
        // Floating Harness UI reads these two tokens: layer-1 backs the
        // hover preview card (edited-file diff popover) and layer-2 backs
        // dialogs and floating dock windows. Probe the tokens directly so the
        // assertion cannot drift with whichever element happens to use them.
        const tokenAlpha = variable => {
          const probe = document.createElement('div')
          probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:8px;height:8px'
          probe.style.backgroundColor = `var(${variable})`
          document.body.append(probe)
          const values = getComputedStyle(probe).backgroundColor.match(/[\d.]+/g).map(Number)
          probe.remove()
          return values.length === 4 ? values[3] : 1
        }
        return {
          columns: ['.sidebar', '.conversation', '[data-dockkit-content]'].map(effective),
          composer: alpha('.composer'),
          settings: alpha('[data-shortcut-modal="settings"]'),
          marketplace: alpha('.marketplace'),
          pluginDialog: alpha('.plugin-dialog'),
        }
      })
      const expected = dark ? Math.max(.4, glass / 100 - .12) : glass / 100
      for (const value of paints.columns) assert.ok(Math.abs(value - expected) < .005,
        `${platform}/${dark ? 'dark' : 'light'}: columns ${JSON.stringify(paints.columns)} expected ${expected}`)
      assert.ok(paints.composer >= .96, `composer keeps its own readable surface, got ${paints.composer}`)
      assert.ok(paints.settings >= .96, 'settings stays legible over the ocean')
      assert.ok(paints.marketplace >= .96, 'marketplace keeps a readable overlay token')
      assert.ok(paints.pluginDialog >= .96, 'sibling configuration dialog has an independent surface')
      assert.equal(await page.locator('[data-shell-overlay]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
      if (process.env.OSS_SCREENSHOTS && platform === 'windows' && glass === 40) {
        await page.screenshot({ path: `${process.env.OSS_SCREENSHOTS}/overlay-${dark ? 'dark' : 'light'}.png` })
      }
      }
    }
  }
  await page.evaluate(() => window.stopBackspace())
  assert.equal(await page.locator('#__dsh-backspace-glass__').count(), 0)
  assert.deepEqual(failures, [])
  console.log('✓ Official Desktop 0.2.x shell: unified columns and readable settings in macOS/Windows light/dark modes')

  // Independent conversation background: the center column has its own
  // opacity, while the sidebars keep the workspace glass.
  const box = page.locator('#__dsh-backspace-panel__-chat')
  const slider = page.locator('#__dsh-backspace-panel__-chat-range')
  await page.addScriptTag({ path: resolve(root, 'plugin/client.js') })
  await waitForOcean(page)
  await page.locator('#__dsh-backspace-btn__').click()
  // The rotation above leaves the glass slider on its last value. Pin it back
  // to the documented 40% so this block measures the sidebar baseline it
  // asserts, instead of inheriting whatever the previous loop ended on.
  await setRange(page.locator('#__dsh-backspace-panel__-glass-range'), 40)
  // The slider stays out of the way until the switch enables it.
  assert.equal(await slider.isVisible(), false, 'slider is hidden while the conversation follows the glass')
  await box.check()
  assert.equal(await slider.isVisible(), true, 'slider appears once the switch is on')
  // The default conversation opacity is a product setting, not a constant:
  // read it from the shared source so retuning it cannot silently pass.
  const documentedChatOpacity = Number(
    (await readFile(resolve(root, 'shared/skin-core.js'), 'utf8'))
      .match(/chatOpacity:\s*(\d+)/)?.[1],
  )
  assert.equal(
    await slider.inputValue(),
    String(documentedChatOpacity),
    'the switch opens on the documented default opacity',
  )
  // 100% is the contract the feature is built on: the column must be
  // indistinguishable from unthemed Harness. Drive the slider there explicitly
  // so a retuned default cannot weaken this check.
  await setRange(slider, 100)
  for (const dark of [true, false]) {
    await page.evaluate((dark) => { document.body.toggleAttribute('data-ds-dark-theme', dark) }, dark)
    const paints = await page.evaluate(() => {
      const column = document.querySelector('div:has(> [data-shell-overlay]) > :nth-child(2)')
      const style = getComputedStyle(column)
      const alphaOf = (element) => {
        const values = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]
        return values.length === 4 ? values[3] : 1
      }
      const effective = (selector) => {
        let total = 0
        for (let node = document.querySelector(selector); node && node !== document.body; node = node.parentElement) {
          total = 1 - (1 - total) * (1 - alphaOf(node))
        }
        return total
      }
      // Resolve the paint to RGB too: alpha alone cannot tell a correct
      // dark column from a light one, and a theme-prefix bug once painted the
      // dark-mode conversation white while every alpha assertion still passed.
      const channels = style.backgroundColor.match(/[\d.]+/g).map(Number)
      const rgb = style.backgroundColor.startsWith('color(')
        ? channels.slice(0, 3).map((value) => Math.round(value * 255))
        : channels.slice(0, 3)
      return {
        background: style.backgroundColor,
        rgb,
        token: style.getPropertyValue('--dsw-alias-bg-base').trim(),
        sidebar: effective('.sidebar'),
        details: effective('[data-dockkit-content]'),
        conversation: effective('div:has(> [data-shell-overlay]) > :nth-child(2)'),
      }
    })
    const theme = dark ? 'dark' : 'light'
    assert.ok(!paints.background.startsWith('rgba(0, 0, 0, 0)'), `100% stays opaque: ${JSON.stringify(paints)}`)
    assert.ok(paints.token === '#151517' || paints.token === '#fff', `100% uses the static palette: ${JSON.stringify(paints)}`)
    assert.deepEqual(paints.rgb, dark ? [21, 21, 23] : [255, 255, 255],
      `${theme}: the conversation keeps Harness's own colour ${JSON.stringify(paints)}`)
    assert.ok(Math.abs(paints.sidebar - .4) < .02, `sidebar keeps the workspace glass: ${JSON.stringify(paints)}`)
    assert.ok(Math.abs(paints.details - .4) < .02, `details keeps the workspace glass: ${JSON.stringify(paints)}`)

    // Every step below 100% must be a genuinely lower conversation opacity
    // while the sidebars stay put.
    for (const percent of [40, 65, documentedChatOpacity]) {
      await setRange(slider, percent)
      const stepped = await page.evaluate(() => {
        const column = document.querySelector('div:has(> [data-shell-overlay]) > :nth-child(2)')
        const alphaOf = (element) => {
          const values = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]
          return values.length === 4 ? values[3] : 1
        }
        const effective = (selector) => {
          let total = 0
          for (let node = document.querySelector(selector); node && node !== document.body; node = node.parentElement) {
            total = 1 - (1 - total) * (1 - alphaOf(node))
          }
          return total
        }
        const channels = getComputedStyle(column).backgroundColor.match(/[\d.]+/g).map(Number)
        return {
          conversation: effective('div:has(> [data-shell-overlay]) > :nth-child(2)'),
          sidebar: effective('.sidebar'),
          rgb: getComputedStyle(column).backgroundColor.startsWith('color(')
            ? channels.slice(0, 3).map((value) => Math.round(value * 255))
            : channels.slice(0, 3),
        }
      })
      assert.ok(Math.abs(stepped.conversation - percent / 100) < .02,
        `${theme}/${percent}%: conversation ${JSON.stringify(stepped)}`)
      assert.deepEqual(stepped.rgb, dark ? [21, 21, 23] : [255, 255, 255],
        `${theme}/${percent}%: the hue is Harness's own ${JSON.stringify(stepped)}`)
      assert.ok(Math.abs(stepped.sidebar - .4) < .02, `sidebar unaffected at ${percent}%: ${JSON.stringify(stepped)}`)
    }
    await setRange(slider, 100)
  }
  // Switching it off must be identical to the shared-glass default.
  await box.uncheck()
  assert.equal(await slider.isVisible(), false, 'slider hides again when the switch is off')
  const shared = await page.evaluate(() => {
    const alphaOf = (element) => {
      const values = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1]
      return values.length === 4 ? values[3] : 1
    }
    const effective = (selector) => {
      let total = 0
      for (let node = document.querySelector(selector); node && node !== document.body; node = node.parentElement) {
        total = 1 - (1 - total) * (1 - alphaOf(node))
      }
      return total
    }
    return {
      conversation: effective('div:has(> [data-shell-overlay]) > :nth-child(2)'),
      sidebar: effective('.sidebar'),
    }
  })
  assert.ok(Math.abs(shared.conversation - .4) < .02, `conversation follows the glass when off: ${JSON.stringify(shared)}`)
  assert.ok(Math.abs(shared.sidebar - .4) < .02, `sidebar follows the glass when off: ${JSON.stringify(shared)}`)
  console.log('✓ Independent conversation background: 40-100% slider, native at 100%, sidebars unaffected')
} finally {
  await browser.close()
  await server.close()
}
