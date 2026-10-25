import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { findChromeForTesting, serveDirectory, watchPageErrors } from './browser-support.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '.scratch/launcher-placement')
const source = await readFile(resolve(root, process.argv[2] || 'shared/skin-core.js'), 'utf8')
const trigger = '#__dsh-backspace-btn__'
const panel = '#__dsh-backspace-panel__'
await mkdir(output, { recursive: true })
const server = await serveDirectory(root)
const browser = await chromium.launch({ executablePath: await findChromeForTesting(chromium.executablePath()), headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = watchPageErrors(page, 'launcher placement')
const samples = []
const results = []
const fixture = official => `<!doctype html><html lang="zh-CN"><head><style>
*{box-sizing:border-box}body{margin:0;background:#12181e;color:#e7eef1;font:14px system-ui}
.shell{display:flex;height:100vh;padding:12px}.sidebar{position:relative;width:280px;flex:none;border-right:1px solid #71808b;background:#202c34;overflow:clip}.sidebar-inner{display:flex;flex-direction:column;height:100%;padding:18px;width:100%}.official .sidebar-inner{width:280px}
.history{flex:1}.history p{padding:12px 0}.settings{width:100%}.settings button{display:flex;align-items:center;gap:8px;width:100%;height:44px;padding:6px;border:0;border-radius:8px;color:inherit;background:#2d3a43}
.avatar{display:block;width:24px;height:24px;flex:none;border-radius:50%;background:#8fc9bb}.sidebar.collapsed .sidebar-inner{padding:18px 8px}.official .sidebar.collapsed .sidebar-inner{padding:18px}.collapsed .name{visibility:hidden}
#drag-handle{position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;touch-action:none;z-index:2}main{flex:1;padding:28px}#collapse{margin-bottom:20px}
</style></head><body><div id="root"><div class="shell${official ? ' official' : ''}">
<${official ? 'div' : 'aside'} class="sidebar${official ? '' : ' pI_x6G_sidebarCol'}" id="sidebar"><div class="sidebar-inner"><div class="history"><strong>Harness</strong><p>cable</p><p>继续电缆温度任务</p></div><div class="settings" data-slot="sidebar.settings"><button id="account" aria-label="账号菜单"><span class="avatar"></span><span class="name">HO</span></button></div></div><div id="drag-handle" role="separator" aria-label="侧边栏宽度" aria-orientation="vertical"></div></${official ? 'div' : 'aside'}>
<main><button id="collapse">展开 / 收起侧边栏</button><div id="messages">对话区</div></main>
${official ? '<div data-shell-overlay style="position:fixed;inset:0;pointer-events:none"></div>' : ''}
</div></div><script>
const sidebar=document.querySelector('#sidebar'),handle=document.querySelector('#drag-handle');
let dragging=false;window.resizeEvents=0;addEventListener('resize',()=>resizeEvents++);
handle.addEventListener('pointerdown',event=>{dragging=true;handle.setPointerCapture(event.pointerId)});
handle.addEventListener('pointermove',event=>{if(dragging)sidebar.style.width=Math.max(180,Math.min(520,event.clientX-sidebar.getBoundingClientRect().left))+'px'});
handle.addEventListener('pointerup',()=>{dragging=false});
document.querySelector('#collapse').onclick=()=>{const collapsed=sidebar.classList.toggle('collapsed');sidebar.style.width=collapsed?'${official ? 0 : 56}px':'280px'};
window.resizeObservers=[];const NativeResizeObserver=ResizeObserver;
window.ResizeObserver=class extends NativeResizeObserver{constructor(callback){super(callback);this.targets=new Set();resizeObservers.push(this)}observe(target,options){this.targets.add(target);super.observe(target,options)}unobserve(target){this.targets.delete(target);super.unobserve(target)}disconnect(){this.targets.clear();super.disconnect()}};
</script></body></html>`

const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const misplaced = item => Math.abs(item.gap - 13) > 1 || Math.abs(item.bottomGap - 13) > 1
async function sample(name) {
  await settle()
  const value = await page.evaluate(({ trigger, panel, name }) => {
    const sidebar = document.querySelector('#sidebar').getBoundingClientRect()
    const account = document.querySelector('#account').getBoundingClientRect()
    const conversation = document.querySelector('.official main')?.getBoundingClientRect()
    const button = document.querySelector(trigger).getBoundingClientRect()
    const settings = document.querySelector(panel).getBoundingClientRect()
    return {
      name, sidebarRight: sidebar.right, conversationLeft: conversation?.left,
      buttonLeft: button.left, buttonBottom: button.bottom,
      gap: button.left - (conversation?.left ?? sidebar.right),
      bottomGap: (conversation?.bottom ?? sidebar.bottom) - button.bottom,
      accountCenter: account.y + account.height / 2,
      panelOpen: document.querySelector(trigger).getAttribute('aria-expanded') === 'true',
      panelRight: settings.right, panelWidth: settings.width, buttonRight: button.right,
    }
  }, { trigger, panel, name })
  samples.push(value)
  return value
}

async function drag(widths, prefix) {
  const box = await page.locator('#sidebar').boundingBox()
  await page.mouse.move(box.x + box.width - 2, box.y + 28)
  await page.mouse.down()
  for (const width of widths) {
    await page.mouse.move(box.x + width, box.y + 28)
    await sample(`${prefix}-${width}`)
  }
  await page.mouse.up()
}

try {
  for (const official of [false, true]) {
    const mode = official ? 'official-frozen-inner' : 'aside'
    await page.goto(`${server.url}/tests/fixtures/harness/index.html`)
    await page.setContent(fixture(official))
    await page.addScriptTag({ content: source })
    await page.evaluate(async () => {
      window.controller = BackspaceSkinCore.createController({
        assetUrl: path => `/unused/${path}`,
        storage: { get: async defaults => ({ ...defaults, enabled: false }), set: async () => {} },
      })
      await controller.start()
    })
    await sample(`${mode}-initial`)
    await drag([320, 380, 450, 280, 210, 340], `${mode}-closed-drag`)
    await page.screenshot({ path: resolve(output, `${mode}-dragged.png`) })
    await writeFile(resolve(output, 'drag-samples.json'), JSON.stringify(samples, null, 2))
    const dragFailures = samples.filter(misplaced)
    assert.equal(dragFailures.length, 0, `launcher leaves the conversation corner during drag: ${JSON.stringify(dragFailures)}`)
    await page.locator(trigger).click()
    await page.locator(panel).evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))) })
    await drag([380, 460, 260], `${mode}-open-drag`)
    await page.locator(panel).waitFor({ state: 'hidden' })
    await page.locator('#collapse').click()
    await sample(`${mode}-collapsed`)
    await page.locator(trigger).click()
    await page.locator(`${panel}.open`).waitFor()
    await page.locator(`${panel} .bs-close`).click()
    await page.locator(panel).waitFor({ state: 'hidden' })
    await page.locator('#collapse').click()
    const expanded = await sample(`${mode}-expanded`)
    await page.evaluate(() => {
      document.querySelector('#account').style.height = '92px'
      document.querySelector('.settings').style.transform = 'translateY(-72px)'
    })
    const changedAccount = await sample(`${mode}-account-moved`)
    assert.ok(Math.abs(changedAccount.accountCenter - expanded.accountCenter) > 80, 'account fixture must actually move')
    assert.equal(changedAccount.buttonBottom, expanded.buttonBottom, 'the launcher must not follow account height or position')
    await page.evaluate(() => {
      document.querySelector('#account').style.height = ''
      document.querySelector('.settings').style.transform = ''
    })
    await sample(`${mode}-account-restored`)
    if (official) {
      await page.locator('main').evaluate(element => { element.style.marginBottom = '60px' })
      await sample(`${mode}-conversation-bottom-changed`)
      await page.locator('main').evaluate(element => { element.style.marginBottom = '' })
      await sample(`${mode}-conversation-bottom-restored`)
    }

    const idleWrites = await page.evaluate(async trigger => {
      let writes = 0
      const observer = new MutationObserver(records => { writes += records.length })
      observer.observe(document.querySelector(trigger), { attributes: true, attributeFilter: ['style'] })
      for (let index = 0; index < 15; index++) {
        const message = document.createElement('p'); message.textContent = `回复 ${index}`
        document.querySelector('#messages').append(message)
        await new Promise(requestAnimationFrame)
      }
      await new Promise(requestAnimationFrame)
      observer.disconnect()
      return writes
    }, trigger)
    const resizeEvents = await page.evaluate(() => window.resizeEvents)
    await page.evaluate(() => controller.stop())
    await page.locator('#sidebar').evaluate(element => { element.style.width = '220px' })
    await settle()
    const cleanup = await page.evaluate(({ trigger, panel }) => ({
      nodes: document.querySelectorAll(`${trigger}, ${panel}`).length,
      observedTargets: resizeObservers.reduce((sum, observer) => sum + observer.targets.size, 0),
    }), { trigger, panel })
    results.push({ mode, idleWrites, resizeEvents, cleanup })
    assert.equal(resizeEvents, 0, 'sidebar dragging must not rely on window resize')
    assert.equal(idleWrites, 0, 'chat messages must not rewrite launcher placement')
    assert.deepEqual(cleanup, { nodes: 0, observedTargets: 0 }, 'stop must remove the surface and disconnect size observations')
  }
  const failures = samples.filter(misplaced)
  await writeFile(resolve(output, 'evidence.json'), JSON.stringify({ samples, failures, results, errors }, null, 2))
  assert.deepEqual(errors, [])
  assert.equal(failures.length, 0, `launcher leaves the conversation corner: ${JSON.stringify(failures)}`)
  for (const item of samples.filter(item => item.name.includes('-open-drag-'))) {
    assert.equal(item.panelOpen, true, `drag sample must exercise an open panel: ${item.name}`)
    assert.ok(Math.abs(item.panelRight - Math.max(12 + item.panelWidth, item.buttonRight)) <= 1,
      `open panel must follow the launcher within the viewport: ${JSON.stringify(item)}`)
  }
  console.log(`PASS: ${samples.length} placement samples, real sidebar drags, collapse, panel tracking and cleanup`)
} finally {
  await browser.close()
  await server.close()
}
