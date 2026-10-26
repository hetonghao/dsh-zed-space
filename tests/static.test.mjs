import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bytes = relative => readFile(resolve(root, relative))
const text = async relative => (await bytes(relative)).toString('utf8')
const sha256 = async relative => createHash('sha256').update(await bytes(relative)).digest('hex')

test('the original showcase is preserved byte-for-byte', async () => {
  assert.equal(await sha256('site/index.html'), '69267b127c956a6cc6202fe0599d216b28cde92b4295a42400f6323e4c0353de')
  assert.equal(await sha256('site/main.js'), '078cbf59811870668e7d1840e70a6ce267038ded8b1e57e4077fbce7ccb5abb4')
})

test('the MV3 manifest keeps the minimum local-only permission surface', async () => {
  const manifest = JSON.parse(await text('extension/manifest.json'))
  assert.equal(manifest.manifest_version, 3)
  assert.deepEqual(manifest.permissions, ['storage'])
  assert.deepEqual(manifest.host_permissions, ['http://127.0.0.1/*', 'http://localhost/*'])
  assert.equal(manifest.content_scripts[0].all_frames, false)
  assert.ok(manifest.web_accessible_resources[0].resources.includes('skin.html'))
  assert.equal(manifest.chrome_url_overrides, undefined)
  assert.equal(manifest.action.default_popup, 'popup.html')
})

test('every install path is generated from the canonical renderer', async () => {
  for (const target of ['extension/ocean.js', 'native-dist/ocean.js', 'harness-plugin/assets/ocean.js']) {
    assert.deepEqual(await bytes(target), await bytes('shared/ocean.js'), target)
  }
  for (const target of ['extension/styles.css', 'native-dist/styles.css', 'harness-plugin/assets/styles.css']) {
    assert.deepEqual(await bytes(target), await bytes('shared/styles.css'), target)
  }
  const extension = await text('extension/content.js')
  const native = await text('native-dist/loader.js')
  const core = await text('shared/skin-core.js')
  assert.ok(extension.includes(core))
  assert.ok(native.includes(core))
  assert.ok((await text('plugin/client.js')).includes(core))
})

test('the repository root is an installable DeepSeek Harness bundle', async () => {
  const pkg = JSON.parse(await text('package.json'))
  assert.equal(pkg.private, undefined)
  assert.deepEqual(pkg.publishConfig, { access: 'public' })
  assert.equal(pkg.publishConfig.access, 'public')
  assert.deepEqual(pkg.dsh.bundle, { patch: './cordis.patch.yml' })
  assert.deepEqual(pkg.dsh.client, { inject: [], platform: 'web' })
  assert.equal(pkg.main, 'plugin/index.js')
  assert.equal(pkg.exports['./client'], './plugin/client.js')
  assert.match(await text('cordis.patch.yml'), /id: dsh-zed-space[\s\S]*name: dsh-zed-space/)
  assert.match(await text('plugin/client.js'), /__ModuleLoader__\.load\(\{ id: "dsh-zed-space"/)
})

test('vendored three.js is local, patched and licensed', async () => {
  const webgpu = await text('shared/vendor/three.webgpu.js')
  const controls = await text('shared/vendor/addons/controls/OrbitControls.js')
  const bloom = await text('shared/vendor/addons/tsl/display/BloomNode.js')
  assert.match(webgpu, /from"\.\/three\.core\.js"/)
  assert.doesNotMatch(webgpu, /greggman|https?:\/\/[^\s]+webgpu.*debug/i)
  assert.match(controls, /from"\.\.\/\.\.\/three\.webgpu\.js"/)
  assert.match(bloom, /from"\.\.\/\.\.\/\.\.\/three\.webgpu\.js"/)
  assert.match(bloom, /from"\.\.\/\.\.\/\.\.\/three\.tsl\.js"/)
  assert.match(await text('shared/vendor/licenses/three-LICENSE.txt'), /MIT License/)
  assert.match(await text('shared/vendor/licenses/geist-OFL.txt'), /OPEN FONT LICENSE Version 1\.1/)
})

test('shared controller retains duplicate guards, a11y and resilient anchors', async () => {
  const core = await text('shared/skin-core.js')
  for (const required of [
    '__dsh-backspace__',
    '__dsh-backspace-btn__',
    'role',
    "event.key === 'Escape'",
    "event.key !== 'Tab'",
    '[data-slot="sidebar.settings"] button',
    '[data-testid="settings-trigger"]',
    '.VOzbGW_trigger',
    'MutationObserver',
    'prefers-reduced-motion',
  ]) assert.ok(core.includes(required), required)
})

test('the conversation panel has its own background opacity', async () => {
  const core = await text('shared/skin-core.js')
  // On by default at a milder opacity, and persisted as two independent values.
  assert.match(core, /chatCustom: true/)
  assert.match(core, /chatOpacity: 90/)
  assert.match(core, /chatCustom: raw\.chatCustom === true/)
  assert.match(core, /chatOpacity: clamp\(raw\.chatOpacity, CHAT_OPACITY_MIN, CHAT_OPACITY_MAX/)
  // The slider spans 40-100% and is bound to the switch that reveals it.
  assert.match(core, /CHAT_OPACITY_MIN = 40/)
  assert.match(core, /CHAT_OPACITY_MAX = 100/)
  assert.match(core, /min="\$\{CHAT_OPACITY_MIN\}" max="\$\{CHAT_OPACITY_MAX\}"/)
  assert.match(core, /chatRow\.hidden = !state\.chatCustom/)
  // 100% must stay Harness-native: the paint comes from Harness's own palette,
  // never from a hex value copied out of one build.
  assert.match(core, /var\(--dsw-static-neutral-bluish-950/)
  assert.match(core, /var\(--dsw-static-neutral-bluish-00/)
  assert.match(core, /if \(percent >= CHAT_OPACITY_MAX\) return nativeBase\(theme\)/)
  // Below 100% the same color is scaled, so every step is a real opacity.
  assert.match(core, /color-mix\(in srgb, \$\{nativeBase\(theme\)\} \$\{percent\}%, transparent\)/)
  assert.match(core, /glassCss\(state\.glass, state\.chatCustom, state\.chatOpacity\)/)
  // Switching the control off restores the shared workspace glass unchanged.
  assert.match(core, /const chat = chatCustom \? chatPercent\(chatOpacity\) : null/)
  assert.match(core, /const independent = chat !== null/)
  assert.match(core, /\$\{independent \? conversationCss\(chat\) : ''\}/)
  // Every supported shell keeps a documented conversation root.
  for (const root of ['.wSkVaW_root', '[data-slot="conversation"]', '.dshDesktopConversationSurface', '[data-shell-overlay]']) {
    assert.ok(core.includes(root), root)
  }
})

test('floating Harness surfaces stay opaque over the workspace glass', async () => {
  const core = await text('shared/skin-core.js')
  // Harness paints hover preview cards (the edited-file diff popover) with
  // --dsw-alias-bg-layer-1, and dialogs plus floating dock windows with
  // --dsw-alias-bg-layer-2. Both are opaque in its own palette; inheriting the
  // workspace glass alpha let the page behind show through their text.
  assert.match(core, /const ELEVATED_ALPHA = 0\.97/)
  assert.ok(core.includes('--dsw-alias-bg-layer-1: rgba(255, 255, 255, ${alpha(ELEVATED_ALPHA)}) !important;'))
  assert.ok(core.includes('--dsw-alias-bg-layer-2: rgba(255, 255, 255, ${alpha(ELEVATED_ALPHA)}) !important;'))
  assert.ok(core.includes('--dsw-alias-bg-layer-1: rgba(12, 16, 22, ${alpha(ELEVATED_ALPHA)}) !important;'))
  assert.ok(core.includes('--dsw-alias-bg-layer-2: rgba(16, 20, 27, ${alpha(ELEVATED_ALPHA)}) !important;'))
  // The workspace surface keeps the user's glass setting, so the ocean still
  // shows through the shell itself.
  assert.ok(core.includes('--dsw-alias-bg-base: rgba(255, 255, 255, ${alpha(light)}) !important;'))
  assert.ok(core.includes('--dsw-alias-bg-base: rgba(9, 12, 16, ${alpha(dark)}) !important;'))
  // Every generated install path carries the same rule.
  for (const target of ['plugin/client.js', 'extension/content.js', 'native-dist/loader.js']) {
    assert.match(await text(target), /const ELEVATED_ALPHA = 0\.97/, target)
  }
})

test('every install adapter persists the independent conversation background', async () => {
  for (const target of ['shared/native-entry.js', 'shared/extension-entry.js', 'scripts/build-dsh-bundle.mjs']) {
    const source = await text(target)
    assert.match(source, /chatCustom/, target)
    assert.match(source, /chatOpacity/, target)
  }
  assert.match(await text('plugin/client.js'), /bsChatCustom/)
  assert.match(await text('plugin/client.js'), /bsChatOpacity/)
  assert.match(await text('extension/content.js'), /skinChatCustom/)
  assert.match(await text('extension/content.js'), /skinChatOpacity/)
})

test('the browser extension injects only into a verified Harness page', async () => {
  const entry = await text('shared/extension-entry.js')
  assert.match(entry, /document\.title !== 'DeepSeek Harness'/)
  assert.match(entry, /document\.getElementById\('root'\)/)
  assert.ok(entry.includes('window\\.__DSH_BOOT__'))
})

test('the GitHub Pages website is an interactive local-only product demo', async () => {
  const html = await text('website/index.html')
  const app = await text('website/app.js')
  const workflow = await text('.github/workflows/pages.yml')
  for (const id of ['ocean-frame', 'sea-state', 'daylight', 'transparency']) {
    assert.match(html, new RegExp(`id="${id}"`), id)
  }
  assert.match(html, /class="harness-capture harness-capture-dark"/)
  assert.match(html, /class="harness-capture harness-capture-light"/)
  assert.match(html, /class="nav-github"[\s\S]*?<svg viewBox="0 0 16 16"/)
  assert.doesNotMatch(html, /class="demo-(?:sidebar|conversation|details)"/)
  assert.match(app, /type: 'bs-set'/)
  assert.match(app, /--capture-opacity/)
  assert.match(app, /parentOrigin: location\.origin/)
  assert.match(workflow, /actions\/deploy-pages@v4/)
  assert.deepEqual(await bytes('pages-dist/ocean.js'), await bytes('shared/ocean.js'))
  assert.deepEqual(await bytes('pages-dist/styles.css'), await bytes('shared/styles.css'))
  assert.deepEqual(await bytes('pages-dist/skin.html'), await bytes('website/skin.html'))
  assert.ok((await bytes('website/ocean-preview.jpg')).length < 150_000, 'Keep the first-paint ocean small')
  assert.match(html, /rel="preload" as="image" href="\.\/ocean-preview.jpg"/)
  assert.doesNotMatch(html, /\ssrc="[^"]+\.gif"/, 'Full recordings must not load before the ocean')
  for (const [, source] of html.matchAll(/src="(\.\/media\/[^"]+)"/g)) {
    assert.ok((await bytes(`pages-dist/${source}`)).length > 0, source)
  }
})

test('renderer contains the promised performance and security policies', async () => {
  const ocean = await text('shared/ocean.js')
  for (const required of [
    'document.hidden',
    "deviceMemory",
    "prefers-reduced-motion: reduce",
    "ev.source !== window.parent",
    "ev.origin !== SKIN_PARENT_ORIGIN",
    'Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP)',
    'REDUCED_MOTION ? 160 : 256',
    'TARGET_FPS',
    'renderScale',
    'p.sub(floor(p.div(289)).mul(289))',
    '__bsState',
  ]) assert.ok(ocean.includes(required), required)
})

test('native integration keeps modal overlays above every app column', async () => {
  const integration = await text('harness-plugin/integration/update-harness.mjs')
  assert.match(integration, /isolation: isolate; \/\* Backspace background stacking context \*\//)
  assert.match(integration, /z-index: -1/)
  assert.match(integration, /text = text\.replace/)
  assert.match(integration, /ui-backspace.*web-search-deepseek/)
})
