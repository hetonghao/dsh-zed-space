import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const installer = resolve(root, 'native-dist/install-skin.sh')
const bootstrapInstaller = resolve(root, 'install.sh')
const sourceInstaller = resolve(root, 'harness-plugin/install-into-harness.sh')

test('static bootstrap defaults to the current GitHub release', async () => {
  const script = await readFile(bootstrapInstaller, 'utf8')
  const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  assert.ok(script.includes(`BACKSPACE_VERSION="${'${'}BACKSPACE_VERSION:-v${version}}"`))
})

function run(...args) {
  const result = spawnSync('bash', [installer, ...args], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  return result.stdout
}

function runSourceInstaller(harness) {
  const result = spawnSync('bash', [sourceInstaller, harness], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  return result.stdout
}

function runBootstrap(archive, cwd, ...args) {
  const result = spawnSync('bash', [bootstrapInstaller, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, BACKSPACE_ARCHIVE_FILE: archive },
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  return result.stdout
}

async function createSourceArchive(fixture) {
  const archiveRoot = resolve(fixture, 'archive/dsh-zed-space-1.2.0')
  await mkdir(archiveRoot, { recursive: true })
  await cp(resolve(root, 'native-dist'), resolve(archiveRoot, 'native-dist'), { recursive: true })
  const archive = resolve(fixture, 'dsh-zed-space.tar.gz')
  const result = spawnSync('tar', ['-czf', archive, '-C', resolve(fixture, 'archive'), 'dsh-zed-space-1.2.0'], {
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  return archive
}

test('static installer is repeatable and preserves unrelated Harness updates', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'backspace-installer-'))
  const dist = resolve(fixture, 'dist')
  const index = resolve(dist, 'index.html')
  await mkdir(dist)
  await writeFile(index, '<!doctype html><html><head><title>Harness</title></head><body>app</body></html>')

  run('--dist', dist)
  let html = await readFile(index, 'utf8')
  assert.equal((html.match(/dsh-zed-space:begin/g) || []).length, 1)
  assert.match(html, /\/dsh-zed-space\/loader\.js/)
  await stat(resolve(dist, 'dsh-zed-space/vendor/three.webgpu.js'))
  assert.deepEqual(await readFile(resolve(dist, 'dsh-zed-space/icons/icon128.png')), await readFile(resolve(root, 'extension/icons/icon128.png')))
  await stat(`${index}.bs-backup`)

  html = html.replace('<title>Harness</title>', '<title>Harness upgraded</title><meta name="fixture" content="preserve">')
  await writeFile(index, html)
  run('--update', '--dist', dist)
  html = await readFile(index, 'utf8')
  assert.equal((html.match(/dsh-zed-space:begin/g) || []).length, 1)
  assert.match(html, /Harness upgraded/)
  assert.match(html, /name="fixture"/)

  const uninstallOutput = run('--uninstall', '--dist', dist)
  assert.match(uninstallOutput, /Restart Harness/)
  html = await readFile(index, 'utf8')
  assert.doesNotMatch(html, /dsh-zed-space/)
  assert.match(html, /Harness upgraded/)
  assert.match(html, /name="fixture"/)
  await assert.rejects(stat(resolve(dist, 'dsh-zed-space')))
})

test('dry-run discovers an explicit dist without changing it', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'backspace-dry-run-'))
  await writeFile(resolve(fixture, 'index.html'), '<html><head></head><body></body></html>')
  const before = await readFile(resolve(fixture, 'index.html'), 'utf8')
  const output = run('--dry-run', '--dist', fixture)
  assert.match(output, /Dry run complete/)
  assert.equal(await readFile(resolve(fixture, 'index.html'), 'utf8'), before)
})

test('GitHub bootstrap works from an unrelated directory and forwards installer options', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'backspace-bootstrap-'))
  const unrelatedCwd = resolve(fixture, 'unrelated-working-directory')
  const dist = resolve(fixture, 'dist')
  await mkdir(unrelatedCwd)
  await mkdir(dist)
  await writeFile(resolve(dist, 'index.html'), '<html><head></head><body>Harness</body></html>')
  const archive = await createSourceArchive(fixture)

  const output = runBootstrap(archive, unrelatedCwd, '--dist', dist)
  assert.match(output, /Zed Space Skin is installed/)
  await stat(resolve(dist, 'dsh-zed-space/loader.js'))
  assert.match(await readFile(resolve(dist, 'index.html'), 'utf8'), /dsh-zed-space:begin/)

  const uninstallOutput = runBootstrap(archive, unrelatedCwd, '--uninstall', '--dist', dist)
  assert.match(uninstallOutput, /Start Harness again/)
  await assert.rejects(stat(resolve(dist, 'dsh-zed-space')))
  assert.doesNotMatch(await readFile(resolve(dist, 'index.html'), 'utf8'), /dsh-zed-space/)
})

test('native source installer is repeatable and preserves overlay stacking', async () => {
  const harness = await mkdtemp(resolve(tmpdir(), 'backspace-harness-source-'))
  const files = {
    'AGENTS.md': '# fixture\n',
    'packages/client/ui-layout/src/client/index.ts': `type Slots = {\n    'shell.overlay': { kind: 'list'; scope: 'root' }\n}\nconst children = {\n        'shell.overlay': { kind: 'list', scope: 'root' },\n}\n`,
    'packages/client/ui-layout/src/client/AppFrame.tsx': `type Frame = PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>\nexport const frame = (\n    >\n      <div className={css.sidebarCol}>\n)\n`,
    'packages/client/ui-layout/src/client/AppFrame.module.css': `.frame {\n  position: relative; /* anchors the drag handles, which straddle column borders */\n}\n\n.backgroundLayer {\n  position: absolute;\n  inset: 0;\n  z-index: 0;\n  overflow: hidden;\n  pointer-events: none;\n}\n\n.sidebarCol,\n.centerCol,\n.detailsCol {\n  position: relative;\n  z-index: 1;\n}\n\n.sidebarCol {\n  min-width: 0;\n}\n`,
    'packages/host/apiproxy/src/api-proxy.ts': `const WEB_SETTINGS_NAMESPACES = [\n  'agent-loop', 'shell', 'locale', 'permission', 'ui-conversation', 'ui-theme', 'web-search-deepseek',\n] as const\n`,
    'tsconfig.client.json': `{\n  "references": [\n    { "path": "./packages/client/ui-layout" },\n    { "path": "./packages/client/ui-sidebar" }\n  ]\n}\n`,
    'packages/bundle/web-app/cordis.patch.yml': `    - id: ui-layout\n      name: '@deepseek-ai/dsh-client-ui-layout'\n\n    - id: ui-sidebar\n      name: '@deepseek-ai/dsh-client-ui-sidebar'\n`,
    'packages/bundle/web-app/package.json': `{"dependencies":{"@deepseek-ai/dsh-client-ui-layout":"workspace:^"}}\n`,
  }
  for (const [relative, content] of Object.entries(files)) {
    const target = resolve(harness, relative)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }

  runSourceInstaller(harness)
  for (const relative of ['packages/client/ui-backspace/package.json', 'packages/bundle/web-app/package.json', 'packages/bundle/web-app/cordis.patch.yml']) {
    const path = resolve(harness, relative)
    await writeFile(path, (await readFile(path, 'utf8')).replaceAll('dsh-zed-space', '@deepseek-ai/dsh-client-ui-backspace').replace('id: @deepseek-ai/dsh-client-ui-backspace', 'id: ui-backspace'))
  }
  runSourceInstaller(harness)
  for (const relative of ['packages/client/ui-backspace/package.json', 'packages/bundle/web-app/package.json', 'packages/bundle/web-app/cordis.patch.yml']) {
    const content = await readFile(resolve(harness, relative), 'utf8')
    assert.doesNotMatch(content, /@deepseek-ai\/dsh-client-ui-backspace/)
    assert.match(content, /dsh-zed-space/)
    if (relative.endsWith('.yml')) assert.equal((content.match(/id: dsh-zed-space/g) || []).length, 1)
  }

  const frame = await readFile(resolve(harness, 'packages/client/ui-layout/src/client/AppFrame.tsx'), 'utf8')
  assert.equal((frame.match(/renderSlot\('shell\.background'/g) || []).length, 1)
  const css = await readFile(resolve(harness, 'packages/client/ui-layout/src/client/AppFrame.module.css'), 'utf8')
  assert.match(css, /isolation: isolate/)
  assert.match(css, /\.backgroundLayer \{[\s\S]*z-index: -1/)
  assert.doesNotMatch(css, /\.sidebarCol,\n\.centerCol,\n\.detailsCol/)
  const proxy = await readFile(resolve(harness, 'packages/host/apiproxy/src/api-proxy.ts'), 'utf8')
  assert.equal((proxy.match(/ui-backspace/g) || []).length, 1)
  await stat(resolve(harness, 'packages/client/ui-backspace/src/client/BackspaceQuickControls.tsx'))
})

test('native source installer supports Harness 0.1.2 split client services', async () => {
  const harness = await mkdtemp(resolve(tmpdir(), 'backspace-harness-alpha3-'))
  const files = {
    'AGENTS.md': '# fixture\n',
    'packages/client/ui-layout/src/client/index.ts': `type Slots = {\n    'shell.overlay': { kind: 'list'; scope: 'root' }\n}\nconst children = {\n        'shell.overlay': { kind: 'list', scope: 'root' },\n}\n`,
    'packages/client/ui-layout/src/client/AppFrame.tsx': `type Frame = PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>\nexport const frame = (\n    >\n      <DocumentTitle productTitle={productTitle} />\n      <div className={css.sidebarCol}>\n)\n`,
    'packages/client/ui-layout/src/client/AppFrame.module.css': `.frame {\n  position: relative; /* anchors the drag handles, which straddle column borders */\n}\n\n.sidebarCol {\n  min-width: 0;\n}\n`,
    'tsconfig.client.json': `{\n  "references": [\n    { "path": "./packages/client/ui-layout" },\n    { "path": "./packages/client/ui-sidebar" }\n  ]\n}\n`,
    'packages/bundle/web-app/cordis.patch.yml': `    - id: ui-layout\n      name: '@deepseek-ai/dsh-client-ui-layout'\n\n    - id: ui-sidebar\n      name: '@deepseek-ai/dsh-client-ui-sidebar'\n`,
    'packages/bundle/web-app/package.json': `{"dependencies":{"@deepseek-ai/dsh-client-ui-layout":"workspace:^"}}\n`,
  }
  for (const [relative, content] of Object.entries(files)) {
    const target = resolve(harness, relative)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }

  runSourceInstaller(harness)

  const frame = await readFile(resolve(harness, 'packages/client/ui-layout/src/client/AppFrame.tsx'), 'utf8')
  assert.match(frame, /renderSlot\('shell\.background'/)
  assert.match(frame, /<DocumentTitle productTitle=/)
  const pkg = JSON.parse(await readFile(resolve(harness, 'packages/client/ui-backspace/package.json'), 'utf8'))
  assert.ok(!pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'))
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-client-runtime'], undefined)
  const tsconfig = JSON.parse(await readFile(resolve(harness, 'packages/client/ui-backspace/tsconfig.json'), 'utf8'))
  assert.ok(!tsconfig.references.some(reference => reference.path === '../runtime'))
})

for (const legacy of ['<!-- dsh-backspace:begin --><script src="/dsh-backspace/loader.js" defer></script><!-- dsh-backspace:end -->', '<!-- dsh-backspace:installed --><script type="module" src="/dsh-backspace/loader.js"></script>']) {
  test('upgrade removes legacy static loader and assets: ' + legacy, async () => {
    const dist = await mkdtemp(resolve(tmpdir(), 'zed-upgrade-'))
    await mkdir(resolve(dist, 'dsh-backspace'))
    await writeFile(resolve(dist, 'dsh-backspace/loader.js'), 'legacy')
    await writeFile(resolve(dist, 'index.html'), `<html><head>${legacy}</head><body>keep app</body></html>`)
    run('--update', '--dist', dist)
    const html = await readFile(resolve(dist, 'index.html'), 'utf8')
    assert.doesNotMatch(html, /dsh-backspace/)
    assert.equal((html.match(/loader\.js/g) || []).length, 1)
    assert.match(html, /dsh-zed-space\/loader\.js/)
    assert.match(html, /keep app/)
    await assert.rejects(stat(resolve(dist, 'dsh-backspace')))
    await stat(resolve(dist, 'dsh-zed-space/loader.js'))
  })
}
