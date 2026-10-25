import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, setRange, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/cosmic-performance')
await mkdir(output, { recursive: true })
const source = await readFile(resolve(process.argv[2] || root, 'shared/skin-core.js'), 'utf8')
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const evidence = []
const panel = '#__dsh-backspace-panel__'
const fixture = `<html><body><script>
window.messages = [];
addEventListener('message', event => {
  messages.push(event.data);
  if (event.data.type === 'bs-prepare') parent.postMessage({ type: 'bs-frame-ready', surface: location.pathname.includes('cosmos') ? 'cosmos' : 'ocean', requestId: event.data.requestId }, location.origin);
});
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
      listen: notify => { window.updateStored = patch => {
        localStorage.setItem('test-backspace', JSON.stringify({ ...read(), ...patch }))
        notify(patch)
      }; return () => { delete window.updateStored } },
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
const glassStyle = page => page.locator('#__dsh-backspace-glass__').textContent()
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
  const migratedGlass = await glassStyle(page)
  assert.deepEqual(migrated.p.cosmos, { glow: 83, ring: 55, turb: 85, warm: 60, spin: 50, stars: 28, parallax: 63, pulse: 70 })
  assert.deepEqual(migrated.p.horizon, legacyHorizon)
  assert.deepEqual(migrated.p.vortex, legacyVortex)
  for (const id of ['horizon', 'vortex']) {
    assert.deepEqual(migrated.p.views[id], { params: migrated.p.cosmos, autoCycle: false }, `${id} starts with the existing shared settings`)
  }
  for (const id of ['ocean', 'horizon', 'vortex']) assert.deepEqual(migrated.p.general[id], { glass: 63, chatCustom: true, chatOpacity: 84 }, `${id} inherits existing general settings`)
  assert.deepEqual((await saved(page)).p, migrated.p, 'migration must persist before selecting another view')
  const frameUrl = new URL(await page.locator('#__dsh-backspace-cosmos__').getAttribute('src'), server.url)
  assert.equal(frameUrl.searchParams.get('controls'), 'shared')
  assert.equal(frameUrl.searchParams.get('glow'), '83')
  await page.locator('#__dsh-backspace-btn__').click()
  assert.equal(await page.locator(`${panel}-cosmos input[type=range]`).count(), 8)
  assert.equal(await page.locator(`${panel} .bs-skin-group:not(.bs-video-group)`).count(), 2, 'both views must share one control group')
  const frameIdentity = await page.locator('#__dsh-backspace-cosmos__').evaluateHandle(frame => frame)
  const controlIdentity = await page.locator(`${panel}-cosmos-glow-range`).evaluateHandle(input => input)
  await setRange(page.locator(`${panel}-cosmos-glow-range`), 91)
  await setRange(page.locator(`${panel}-cosmos-spin-range`), 0)
  await setRange(page.locator(`${panel}-glass-range`), 61)
  await setRange(page.locator(`${panel}-chat-range`), 82)
  await page.locator(`${panel}-chat`).uncheck()
  const horizonGlass = await glassStyle(page)
  assert.notEqual(horizonGlass, migratedGlass, 'editing general settings changes the host glass stylesheet')
  await page.locator('[data-skin=vortex]').click()
  assert.equal(await glassStyle(page), migratedGlass, 'switching to unmodified Vortex restores its own host glass')
  await waitMessage(page, 'vortex')
  assert.equal(await frameIdentity.evaluate(frame => frame === document.querySelector('#__dsh-backspace-cosmos__')), true)
  assert.equal(await controlIdentity.evaluate(input => input === document.querySelector('#__dsh-backspace-panel__-cosmos-glow-range')), true)
  assert.equal(await page.locator(`${panel}-cosmos-glow-range`).inputValue(), '83')
  assert.equal(await page.locator(`${panel}-cosmos-spin-range`).inputValue(), '50')
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '63')
  assert.equal(await page.locator(`${panel}-chat`).isChecked(), true)
  assert.equal(await page.locator(`${panel}-chat-range`).inputValue(), '84')
  await setRange(page.locator(`${panel}-glass-range`), 77)
  await setRange(page.locator(`${panel}-chat-range`), 96)
  const vortexGlass = await glassStyle(page)
  assert.notEqual(vortexGlass, horizonGlass)
  await page.waitForFunction(() => {
    const messages = document.querySelector('#__dsh-backspace-cosmos__').contentWindow.messages
    return messages.some(message => message.type === 'bs-skin' && message.skin === 'vortex' && message.params.glow === 83 && message.params.spin === 50)
  })
  const adjusted = await state(page)
  await page.reload()
  await start(page)
  assert.deepEqual(await state(page), adjusted, 'independent values and active view must survive host reload')
  assert.equal(await glassStyle(page), vortexGlass, 'reloaded host uses the active skin’s glass settings')
  await page.locator('#__dsh-backspace-btn__').click()
  await page.locator('[data-skin=horizon]').click()
  await waitMessage(page, 'horizon')
  assert.equal(await glassStyle(page), horizonGlass, 'returning to Horizon restores its actual glass and conversation styling')
  assert.equal((await state(page)).p.views.horizon.params.glow, 91)
  assert.equal((await state(page)).p.views.horizon.params.spin, 0)
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '61')
  assert.equal(await page.locator(`${panel}-chat`).isChecked(), false)
  assert.equal(await page.locator(`${panel}-chat-row`).isVisible(), false)
  assert.equal((await state(page)).chatOpacity, 82)
  assert.deepEqual((await state(page)).p.views.vortex, migrated.p.views.vortex, 'editing Horizon must not change Vortex')
  await page.locator('[data-skin=ocean]').click()
  assert.equal(await glassStyle(page), migratedGlass, 'Ocean has retained its own glass appearance')
  assert.equal(await page.locator(`${panel}-sea-range`).inputValue(), '24')
  assert.equal(await page.locator(`${panel}-time-range`).inputValue(), '72')
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '63')
  assert.equal(await page.locator(`${panel}-chat`).isChecked(), true)
  assert.equal(await page.locator(`${panel}-chat-range`).inputValue(), '84')
  await setRange(page.locator(`${panel}-sea-range`), 67)
  await page.locator('[data-skin=vortex]').click()
  const afterOcean = await state(page)
  assert.equal(await glassStyle(page), vortexGlass)
  assert.deepEqual(afterOcean.p.cosmos, adjusted.p.cosmos)
  assert.deepEqual(afterOcean.p.views, adjusted.p.views, 'editing Ocean must not change either cosmic skin')
  assert.equal(afterOcean.sea, 67)
  assert.equal(afterOcean.glass, 77)
  assert.equal(afterOcean.chatOpacity, 96)
  assert.deepEqual(afterOcean.p.general, { video: { glass: 63, chatCustom: true, chatOpacity: 84 }, ocean: { glass: 63, chatCustom: true, chatOpacity: 84 }, horizon: { glass: 61, chatCustom: false, chatOpacity: 82 }, vortex: { glass: 77, chatCustom: true, chatOpacity: 96 } })
  await page.evaluate(() => { document.documentElement.lang = 'zh-CN' })
  await page.getByText('吸积涡旋 · 独立配置', { exact: true }).waitFor()
  await page.evaluate(() => { document.documentElement.lang = 'en' })
  await page.getByText('Accretion Vortex · Skin settings', { exact: true }).waitFor()
  await page.locator(`${panel} .bs-reset`).click()
  await page.locator(`${panel} .bs-reset-confirm:popover-open`).waitFor()
  assert.deepEqual(await state(page), afterOcean, 'opening confirmation must not restore settings')
  await page.locator(`${panel} .bs-confirm-restore`).click()
  await page.waitForFunction(() => controller.getState().p.views.vortex.params.glow === 70)
  const restored = await state(page)
  const restoredGlass = await glassStyle(page)
  assert.notEqual(restoredGlass, vortexGlass, 'resetting general settings also updates the actual host glass stylesheet')
  assert.deepEqual(restored, {
    ...afterOcean,
    glass: 70, chatCustom: true, chatOpacity: 90,
    p: {
      ...afterOcean.p,
      general: { ...afterOcean.p.general, vortex: { glass: 70, chatCustom: true, chatOpacity: 90 } },
      views: {
        ...afterOcean.p.views,
        vortex: { params: { glow: 70, ring: 55, turb: 55, warm: 60, spin: 50, stars: 45, parallax: 55, pulse: 70 }, autoCycle: true },
      },
    },
  }, 'confirmed reset changes the current skin’s effects and general settings; archives, other skins and main switch stay intact')
  assert.equal(await page.locator(`${panel} .bs-reset`).isDisabled(), true, 'the restored skin cannot reset again')
  await page.evaluate(() => {
    const current = controller.getState()
    updateStored({ p: { ...current.p, general: { ...current.p.general, vortex: { glass: 42, chatCustom: false, chatOpacity: 98 } } } })
  })
  assert.deepEqual([(await state(page)).glass, (await state(page)).chatCustom, (await state(page)).chatOpacity], [42, false, 98])
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '42')
  assert.equal(await page.locator(`${panel}-chat`).isChecked(), false)
  assert.equal(await page.locator(`${panel}-chat-row`).isVisible(), false)
  assert.equal(await page.locator(`${panel} .bs-reset`).isEnabled(), true)
  assert.notEqual(await glassStyle(page), restoredGlass, 'external general profile updates repaint the host')
  await page.evaluate(() => {
    const current = controller.getState()
    updateStored({ p: { ...current.p, general: { ...current.p.general, vortex: { glass: 70, chatCustom: true, chatOpacity: 90 } } } })
  })
  assert.equal(await page.locator(`${panel}-chat`).isChecked(), true)
  assert.equal(await page.locator(`${panel}-chat-range`).inputValue(), '90')
  assert.equal(await page.locator(`${panel} .bs-reset`).isDisabled(), true)
  assert.equal(await glassStyle(page), restoredGlass, 'external restoration returns the host to its default appearance')
  assert.deepEqual((await state(page)).p.general.horizon, { glass: 61, chatCustom: false, chatOpacity: 82 })
  await page.evaluate(() => updateStored({ glass: 58, chatCustom: false, chatOpacity: 75 }))
  assert.deepEqual((await state(page)).p.general.vortex, { glass: 58, chatCustom: false, chatOpacity: 75 }, 'legacy top-level listener patches update only the current profile')
  assert.deepEqual((await state(page)).p.general.horizon, { glass: 61, chatCustom: false, chatOpacity: 82 })
  assert.deepEqual((await state(page)).p.general.ocean, { glass: 63, chatCustom: true, chatOpacity: 84 })
  assert.equal(await page.locator(`${panel}-glass-range`).inputValue(), '58')
  assert.equal(await page.locator(`${panel}-chat`).isChecked(), false)
  assert.equal(await page.locator(`${panel} .bs-reset`).isEnabled(), true)
  assert.deepEqual(errors, [])
  evidence.push({ scenario: 'external-general-profile-sync-updates-controls-and-reset-state', result: 'PASS', final: await state(page) })
  evidence.push({ scenario: 'independent-controls-migration-switch-persistence-confirmed-reset', result: 'PASS', migrated, adjusted, afterOcean, restored })
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
    for (const id of ['horizon', 'vortex']) assert.deepEqual(result.p.views[id], { params: expected, autoCycle: true }, `${name}: ${id} migration`)
    assert.deepEqual(errors, [])
    evidence.push({ scenario: name, result: 'PASS', state: result })
    await page.close()
  }
  for (const [name, seed, expected] of [
    ['legacy-false-and-bounds', { skin: 'ocean', glass: 40, chatCustom: false, chatOpacity: 100 }, { glass: 40, chatCustom: false, chatOpacity: 100 }],
    ['legacy-general-clamps', { skin: 'horizon', glass: 150, chatCustom: true, chatOpacity: -5 }, { glass: 90, chatCustom: true, chatOpacity: 40 }],
  ]) {
    const { page, errors } = await boot(seed)
    const migrated = await state(page)
    for (const id of ['ocean', 'horizon', 'vortex']) assert.deepEqual(migrated.p.general[id], expected, `${name}: ${id}`)
    assert.deepEqual([migrated.glass, migrated.chatCustom, migrated.chatOpacity], [expected.glass, expected.chatCustom, expected.chatOpacity])
    assert.deepEqual((await saved(page)).p.general, migrated.p.general)
    await page.reload()
    await start(page)
    assert.deepEqual(await state(page), migrated, 'migrated general settings survive reload')
    assert.deepEqual(errors, [])
    evidence.push({ scenario: name, result: 'PASS', migrated })
    await page.close()
  }
  {
    const { page, errors } = await boot({ skin: 'horizon', glass: 64, chatCustom: false, chatOpacity: 85,
      p: { views: { horizon: { params: { glow: 26 }, autoCycle: false }, vortex: { params: { glow: 93 }, autoCycle: true } },
        general: { horizon: { glass: 89, chatCustom: true, chatOpacity: 41 } } } })
    const migrated = await state(page)
    assert.deepEqual(migrated.p.general.horizon, { glass: 89, chatCustom: true, chatOpacity: 41 }, 'an existing per-skin profile wins over legacy values')
    for (const id of ['ocean', 'vortex']) assert.deepEqual(migrated.p.general[id], { glass: 64, chatCustom: false, chatOpacity: 85 }, 'missing profiles inherit legacy values')
    assert.equal(migrated.p.views.horizon.params.glow, 26)
    assert.equal(migrated.p.views.horizon.autoCycle, false)
    assert.equal(migrated.p.views.vortex.params.glow, 93)
    assert.equal(migrated.p.views.vortex.autoCycle, true)
    assert.deepEqual(errors, [])
    evidence.push({ scenario: 'general-migration-retains-existing-general-and-effect-profiles', result: 'PASS', migrated })
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
