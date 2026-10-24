// 三皮肤结构的静态护栏：面板描述、皮肤源码、包清单三处必须互相对得上，
// 否则「滑杆动了但没效果」这类问题只会在人工点到时才发现。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import horizon from '../shared/skins/horizon.js'
import vortex from '../shared/skins/vortex.js'
import accretion, { SCENE_PROPS } from '../shared/skins/accretion.js'

const COSMIC = [horizon, vortex]
const COSMIC_IDS = ['horizon', 'vortex']

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const text = async (relative) => readFile(resolve(root, relative), 'utf8')

// 解析 shared/skin-core.js 里 SKIN-PARAMS 区块，得到面板真正会渲染的参数
function panelSkins(source) {
  const block = source.slice(
    source.indexOf('// SKIN-PARAMS-BEGIN'),
    source.indexOf('// SKIN-PARAMS-END'),
  )
  const skins = {}
  let current = null
  for (const line of block.split('\n')) {
    const id = line.match(/\bid: '(\w+)'/)
    if (id) { current = id[1]; skins[current] = []; continue }
    const param = line.match(/\{ key: '(\w+)', min: (-?\d+), max: (-?\d+), def: (-?\d+)/)
    if (param && current) skins[current].push({ key: param[1], min: +param[2], max: +param[3], def: +param[4] })
  }
  return skins
}

test('面板参数与皮肤源码的 props 完全一致', async () => {
  const skins = panelSkins(await text('shared/skin-core.js'))
  assert.deepEqual(Object.keys(skins).sort(), ['ocean', ...COSMIC_IDS].sort())
  for (const skin of COSMIC) {
    const panel = skins[skin.id].map(({ key, min, max, def }) => ({ key, min, max, def }))
    assert.deepEqual(panel, skin.props.map(({ key, min, max, def }) => ({ key, min, max, def })), skin.id)
  }
  // 海面沿用 1.2.6 的两个参数与默认值，行为不能被改
  assert.deepEqual(skins.ocean, [{ key: 'sea', min: 0, max: 100, def: 50 }, { key: 'time', min: 0, max: 100, def: 55 }])
})

test('每个皮肤参数都有中英文案，且按皮肤限定来源', async () => {
  const source = await text('shared/skin-core.js')
  // 'skinId.key' 形式的文案优先级更高：同一个 key 在不同皮肤里可以是不同的东西。
  for (const skin of COSMIC) {
    for (const prop of skin.props) {
      for (const lang of ['zh', 'en']) {
        const start = source.indexOf('params: {', source.indexOf(`${lang}: {`))
        const table = source.slice(start, source.indexOf('},', start))
        const scoped = new RegExp(`'${skin.id}\\.${prop.key}': '`)
        const bare = new RegExp(`\\b${prop.key}: '`)
        assert.ok(scoped.test(table) || bare.test(table), `${skin.id}.${prop.key} 缺少 ${lang} 文案`)
      }
    }
  }
})

test('两个视角共用一个场景和一套预览参数', () => {
  assert.equal(accretion.id, 'accretion')
  assert.deepEqual(accretion.props, SCENE_PROPS)
  assert.equal(SCENE_PROPS.length, 8)
  assert.equal(new Set(SCENE_PROPS.map(prop => prop.key)).size, 8)
  assert.match(accretion.fragment, /void\s+main\s*\(\s*\)/)
  for (const prop of SCENE_PROPS) {
    assert.ok(prop.def >= prop.min && prop.def <= prop.max, prop.key)
    assert.ok(prop.label, prop.key)
    // 旋转速度由渲染器积分为连续相位，不在 shader 中乘累计时间。
    if (prop.key === 'spin') continue
    const uniform = `u${prop.key[0].toUpperCase()}${prop.key.slice(1)}`
    assert.ok(accretion.fragment.includes(uniform), `共享场景未使用 ${uniform}`)
  }
  for (const skin of COSMIC) assert.equal(skin.fragment, undefined, `${skin.id} 不再维护独立场景`)
})

test('宇宙皮肤是纯代码：没有网络请求、图片和视频', async () => {
  for (const file of ['shared/cosmos.js', 'shared/skins/accretion.js', ...COSMIC.map((s) => `shared/skins/${s.id}.js`), 'extension/cosmos.html']) {
    // 注释里可以提到参考片文件名，运行时引用不行
    const source = (await text(file))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '')
    assert.doesNotMatch(source, /\b(fetch|XMLHttpRequest|createImageBitmap|new Image)\s*\(/, file)
    assert.doesNotMatch(source, /\.(mp4|webm|png|jpe?g|gif|webp)\b/i, file)
  }
})

test('三条安装路径都带上了新皮肤产物', async () => {
  const pkg = JSON.parse(await text('package.json'))
  for (const entry of ['native-dist/cosmos.html', 'native-dist/cosmos.js', 'native-dist/skins/**/*']) {
    assert.ok(pkg.files.includes(entry), entry)
  }
  assert.deepEqual(pkg.dependencies ?? {}, {})
  assert.deepEqual(Object.keys(pkg.devDependencies), ['playwright'])

  const manifest = JSON.parse(await text('extension/manifest.json'))
  const resources = manifest.web_accessible_resources[0].resources
  for (const entry of ['cosmos.html', 'cosmos.js', 'skins/*']) assert.ok(resources.includes(entry), entry)

  const installer = await text('native-dist/install-skin.sh')
  assert.match(installer, /cosmos\.js/)
  assert.match(installer, /skins/)

  for (const target of ['extension/cosmos.js', 'native-dist/cosmos.js', 'harness-plugin/assets/cosmos.js']) {
    assert.deepEqual(await readFile(resolve(root, target)), await readFile(resolve(root, 'shared/cosmos.js')), target)
  }
  for (const skin of [...COSMIC, accretion]) {
    for (const dir of ['extension', 'native-dist', 'harness-plugin/assets']) {
      const target = `${dir}/skins/${skin.id}.js`
      assert.deepEqual(await readFile(resolve(root, target)), await readFile(resolve(root, `shared/skins/${skin.id}.js`)), target)
    }
  }
})

test('存储适配器为每张皮肤的独立配置各留一条记录', async () => {
  for (const file of ['shared/native-entry.js', 'shared/extension-entry.js', 'scripts/build-dsh-bundle.mjs']) {
    const source = await text(file)
    assert.match(source, /skinSkinParams|bsSkinParams/, file)
    assert.match(source, /skinSkin|bsSkin\b/, file)
  }
  assert.match(await text('plugin/client.js'), /bsSkinParams/)
  assert.match(await text('extension/content.js'), /skinSkinParams/)
})
