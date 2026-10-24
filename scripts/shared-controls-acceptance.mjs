import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, setRange, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/cosmic-performance')
await mkdir(output, { recursive: true })
const source = await readFile(resolve(root, 'shared/skin-core.js'), 'utf8')
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const evidence = []
const panel = '#__dsh-backspace-panel__'
const fixture = `<html><body><script>
window.messages = [];
addEventListener('message', event => messages.push(event.data));
parent.postMessage({ type: 'bs-cosmos-ready' }, location.origin);
</script></body></html>`

async function start(page) {
  await page.addScriptTag({ content: source })
  await page.evaluate(async () => {
    const read = () => JSON.parse(localStorage.getItem('test-backspace') || '{}')
    window.controller = BackspaceSkinCore.createController({
      assetUrl: path => `/host-controls-fixture/${path}`,
      storage: {
        get: async defaults => ({ ...defaults, ...read() }),
        set: async patch => localStorage.setItem('test-backspace', JSON.stringify({ ...read(), ...patch })),
      },
    })
    await controller.start()
  })
}
async function boot(seed) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = watchPageErrors(page, 'shared-host-controls')
  await page.route('**/host-controls-fixture/*.html?*', route => route.fulfill({ contentType: 'text/html', body: fixture }))
  await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
  await page.evaluate(seed => localStorage.setItem('test-backspace', JSON.stringify(seed)), seed)
  await start(page)
  return { page, errors }
}
const state = page => page.evaluate(() => controller.getState())
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('test-backspace')))
const waitMessage = (page, skin) => page.waitForFunction(skin => {
  const messages = document.querySelector('#__dsh-backspace-cosmos__')?.contentWindow.messages || []
  return messages.some(message => message.type === 'bs-skin' && message.skin === skin)
}, skin)

try {
  const legacyHorizon = { glow: 83, curl: 80, hue: -31, stars: 28, drift: 30, pull: 63 }
  const legacyVortex = { spin: 18, ring: 84, turb: 32, warm: 41, pulse: 52, parallax: 72 }
  const { page, errors } = await boot({ skin: 'horizon', sea: 24, time: 72, glass: 63, autoCycle: false, chatCustom: true, chatOpacity: 84,
    p: { horizon: legacyHorizon, vortex: legacyVortex } })
  const migrated = await state(page)
  assert.deepEqual(migrated.p.cosmos, { glow: 83, ring: 55, turb: 85, warm: 60, spin: 50, stars: 28, parallax: 63, pulse: 70 })
  assert.deepEqual(migrated.p.horizon, legacyHorizon)
  assert.deepEqual(migrated.p.vortex, legacyVortex)
  assert.deepEqual((await saved(page)).p, migrated.p, 'migration must persist before selecting another view')
  const frameUrl = new URL(await page.locator('#__dsh-backspace-cosmos__').getAttribute('src'), server.url)
  assert.equal(frameUrl.searchParams.get('controls'), 'shared')
  assert.equal(frameUrl.searchParams.get('glow'), '83')
  await page.locator('#__dsh-backspace-btn__').click()
  assert.equal(await page.locator(`${panel}-cosmos input[type=range]`).count(), 8)
  assert.equal(await page.locator(`${panel} .bs-skin-group`).count(), 2, 'both views must share one control group')
  const frameIdentity = await page.locator('#__dsh-backspace-cosmos__').evaluateHandle(frame => frame)
  const controlIdentity = await page.locator(`${panel}-cosmos-glow-range`).evaluateHandle(input => input)
  await setRange(page.locator(`${panel}-cosmos-glow-range`), 91)
  await setRange(page.locator(`${panel}-cosmos-spin-range`), 0)
  await page.locator('[data-skin=vortex]').click()
  await waitMessage(page, 'vortex')
  assert.equal(await frameIdentity.evaluate(frame => frame === document.querySelector('#__dsh-backspace-cosmos__')), true)
  assert.equal(await controlIdentity.evaluate(input => input === document.querySelector('#__dsh-backspace-panel__-cosmos-glow-range')), true)
  assert.equal(await page.locator(`${panel}-cosmos-glow-range`).inputValue(), '91')
  assert.equal(await page.locator(`${panel}-cosmos-spin-range`).inputValue(), '0')
  await page.waitForFunction(() => {
    const messages = document.querySelector('#__dsh-backspace-cosmos__').contentWindow.messages
    return messages.some(message => message.type === 'bs-skin' && message.skin === 'vortex' && message.params.glow === 91 && message.params.spin === 0)
  })
  const adjusted = await state(page)
  await page.reload()
  await start(page)
  assert.deepEqual(await state(page), adjusted, 'shared values and active view must survive host reload')
  await page.locator('#__dsh-backspace-btn__').click()
  await page.locator('[data-skin=horizon]').click()
  await waitMessage(page, 'horizon')
  assert.equal((await state(page)).p.cosmos.glow, 91)
  assert.equal((await state(page)).p.cosmos.spin, 0)
  await page.locator('[data-skin=ocean]').click()
  assert.equal(await page.locator(`${panel}-sea-range`).inputValue(), '24')
  assert.equal(await page.locator(`${panel}-time-range`).inputValue(), '72')
  await setRange(page.locator(`${panel}-sea-range`), 67)
  await page.locator('[data-skin=vortex]').click()
  const afterOcean = await state(page)
  assert.deepEqual(afterOcean.p.cosmos, adjusted.p.cosmos)
  assert.equal(afterOcean.sea, 67)
  assert.equal(afterOcean.glass, 63)
  assert.equal(afterOcean.chatOpacity, 84)
  await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
  await page.getByText('宇宙共用参数', { exact: true }).waitFor()
  await page.evaluate(() => { document.documentElement.lang = 'en' })
  await page.getByText('Shared cosmic settings', { exact: true }).waitFor()
  await page.locator(`${panel} .bs-reset`).click()
  await page.waitForFunction(() => controller.getState().p.cosmos.glow === 70)
  assert.equal((await state(page)).skin, 'vortex')
  assert.deepEqual((await state(page)).p.horizon, legacyHorizon, 'reset must not delete archived legacy settings')
  assert.deepEqual((await state(page)).p.vortex, legacyVortex)
  assert.deepEqual(errors, [])
  evidence.push({ scenario: 'shared-controls-migration-switch-persistence-ocean-reset', result: 'PASS', migrated, adjusted, afterOcean })
  await frameIdentity.dispose()
  await controlIdentity.dispose()
  await page.close()

  for (const [name, seed, expected] of [
    ['vortex-migration', { skin: 'vortex', p: { horizon: legacyHorizon, vortex: legacyVortex } }, { glow: 70, ring: 84, turb: 32, warm: 41, spin: 18, stars: 45, parallax: 72, pulse: 52 }],
    ['shared-wins-and-clamps', { skin: 'horizon', p: { cosmos: { glow: 140, ring: -1, spin: 'invalid', warm: 12, extra: 25 }, horizon: legacyHorizon } }, { glow: 100, ring: 0, turb: 55, warm: 12, spin: 50, stars: 45, parallax: 55, pulse: 70 }],
    ['horizon-speed-limits', { skin: 'horizon', p: { horizon: { drift: 100, curl: 100, hue: 52 } } }, { glow: 70, ring: 55, turb: 100, warm: 60, spin: 100, stars: 45, parallax: 55, pulse: 70 }],
    ['malformed-legacy', { skin: 'horizon', p: { cosmos: [], horizon: [] } }, { glow: 70, ring: 55, turb: 55, warm: 60, spin: 50, stars: 45, parallax: 55, pulse: 70 }],
  ]) {
    const { page, errors } = await boot(seed)
    const result = await state(page)
    assert.deepEqual(result.p.cosmos, expected, name)
    assert.deepEqual(errors, [])
    evidence.push({ scenario: name, result: 'PASS', state: result })
    await page.close()
  }
  for (const stage of ['migration', 'read', 'ready']) {
    const lifecyclePage = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const lifecycleErrors = watchPageErrors(lifecyclePage, `stopped-start-${stage}`);
    await lifecyclePage.route('**/host-controls-fixture/*.html?*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await lifecyclePage.goto(`${server.url}/tests/fixtures/harness/index.html`);
    await lifecyclePage.addScriptTag({ content: source });
    const lifecycle = await lifecyclePage.evaluate(async stage => {
      let stored = { ...BackspaceSkinCore.DEFAULTS, skin: 'horizon' };
      let subscriptions = 0, registrations = 0, hold = true;
      let release, entered;
      const gate = new Promise(resolve => { release = () => { hold = false; resolve(); }; });
      const blocked = new Promise(resolve => { entered = resolve; });
      const controller = BackspaceSkinCore.createController({
        assetUrl: path => `/host-controls-fixture/${path}`,
        storage: {
          get: async () => {
            if (hold && stage === 'read') { entered(); await gate; }
            return stored;
          },
          set: async patch => {
            if (hold && stage === 'migration') { entered(); await gate; }
            stored = { ...stored, ...patch };
          },
        },
        listen: () => {
          registrations++;
          subscriptions++;
          return () => { subscriptions--; };
        },
      });
      const count = () => ({
        frames: document.querySelectorAll('#__dsh-backspace__, #__dsh-backspace-cosmos__').length,
        buttons: document.querySelectorAll('#__dsh-backspace-btn__').length,
        subscriptions, registrations,
      });
      if (stage === 'ready') document.body.remove();
      const pending = controller.start();
      if (stage !== 'ready') await blocked;
      controller.stop();
      if (stage === 'ready') {
        document.documentElement.append(document.createElement('body'));
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }
      release();
      await pending;
      const afterStop = count();
      await controller.start();
      const afterRestart = count();
      controller.stop();
      return { afterStop, afterRestart, afterFinalStop: count() };
    }, stage);
    assert.deepEqual(lifecycle.afterStop, { frames: 0, buttons: 0, subscriptions: 0, registrations: 0 }, `${stage}: a stopped pending start must not mount or subscribe`);
    assert.deepEqual(lifecycle.afterRestart, { frames: 1, buttons: 1, subscriptions: 1, registrations: 1 }, `${stage}: the same controller must restart normally`);
    assert.deepEqual(lifecycle.afterFinalStop, { frames: 0, buttons: 0, subscriptions: 0, registrations: 1 }, `${stage}: restart must retain normal cleanup`);
    assert.deepEqual(lifecycleErrors, []);
    evidence.push({ scenario: `stop-during-${stage}-then-restart`, result: 'PASS', ...lifecycle });
    await lifecyclePage.close();
  }
  await writeFile(resolve(output, 'host-controls.json'), JSON.stringify(evidence, null, 2))
  console.log(`PASS: ${evidence.length} shared host control scenarios`)
} finally {
  await browser.close()
  await server.close()
}
