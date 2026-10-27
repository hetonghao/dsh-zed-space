import assert from 'node:assert/strict'
import test from 'node:test'
import '../shared/market-download.js'
import '../shared/market-client.js'
const sha = 'a'.repeat(64)
const message = (type, extra = {}) => ({ origin: 'http://127.0.0.1:4173', source: frame, data: { channel: 'zed-space-market', version: 1, session: 'session', type, ...extra } })
const frame = {}
const tick = () => new Promise(resolve => setImmediate(resolve))
function session(overrides = {}) {
  const states = []; const sent = []
  let imports = 0; let applied = 0; let downloads = 0
  const library = { list: async () => ({ items: [] }), import: async () => { imports++; return { id: 'local' } }, apply: async () => { applied++ } }
  const controller = globalThis.ZedSpaceMarket.createSession({ session: 'session', frameWindow: () => frame, send: data => sent.push(data), onState: data => states.push(data), videoLibrary: library, assetUrl: p => p, download: async () => { downloads++; return new File(['x'], 'a.mp4') }, ...overrides })
  return { controller, states, sent, counts: () => ({ imports, applied, downloads }) }
}
test('session rejects forged origin/source/session and waits for handshake', async () => {
  const s = session()
  const request = message('download', { requestId: 'one', assetId: 'asset', sha256: sha })
  s.controller.receive(request)
  s.controller.receive({ ...message('ready'), origin: 'https://evil.test' })
  s.controller.receive({ ...message('ready'), source: {} })
  s.controller.receive(message('ready', { session: 'old' }))
  assert.equal(s.sent.length, 0)
  s.controller.receive(message('ready')); s.controller.receive(request); await tick()
  assert.equal(s.sent[0].type, 'welcome')
  assert.deepEqual(s.counts(), { imports: 1, applied: 0, downloads: 1 })
  assert.equal(s.states.at(-1).phase, 'ready')
})
test('duplicate request is idempotent and apply is explicit and single', async () => {
  const s = session(); s.controller.receive(message('ready'))
  const request = message('download', { requestId: 'one', assetId: 'asset', sha256: sha })
  s.controller.receive(request); s.controller.receive(request); await tick()
  s.controller.receive(request); await tick()
  assert.deepEqual(s.counts(), { imports: 1, applied: 0, downloads: 1 })
  s.controller.receive(message('apply', { requestId: 'one' })); s.controller.receive(message('apply', { requestId: 'one' })); await tick()
  assert.deepEqual(s.counts(), { imports: 1, applied: 1, downloads: 1 })
  assert.equal(s.states.at(-1).phase, 'applied')
})

test('already saved source reuses local ID without downloading or renaming', async () => {
  let applied; const s = session({ videoLibrary: { list: async () => ({ items: [{ id: 'renamed-local', name: '我的新名字', source: { provider: 'zed-space', assetId: 'asset', sha256: sha } }] }), import: () => assert.fail('must not import'), apply: async id => { applied = id } } })
  s.controller.receive(message('ready')); s.controller.receive(message('download', { requestId: 'one', assetId: 'asset', sha256: sha })); await tick()
  assert.equal(s.counts().downloads, 0); assert.equal(s.states.at(-1).phase, 'ready')
  s.controller.receive(message('apply', { requestId: 'one' })); await tick(); assert.equal(applied, 'renamed-local')
})
test('cancel and replacement ignore an old download completion', async () => {
  const pending = []; const imported = []
  const s = session({ download: ({ signal }) => new Promise(resolve => pending.push({ signal, resolve })), videoLibrary: { list: async () => ({ items: [] }), import: async file => { imported.push(file.name); return { id: file.name } }, apply: () => assert.fail('no auto apply') } })
  s.controller.receive(message('ready')); s.controller.receive(message('download', { requestId: 'old', assetId: 'asset', sha256: sha })); await tick()
  s.controller.receive(message('cancel', { requestId: 'old' })); assert.equal(pending[0].signal.aborted, true)
  s.controller.receive(message('download', { requestId: 'new', assetId: 'asset', sha256: sha })); await tick()
  pending[0].resolve(new File(['x'], 'old.mp4')); pending[1].resolve(new File(['x'], 'new.mp4')); await tick()
  assert.deepEqual(imported, ['new.mp4']); assert.equal(s.states.at(-1).requestId, 'new'); assert.equal(s.states.at(-1).phase, 'ready')
})
test('dispose during atomic import preserves saved item but emits no ready and never applies', async () => {
  let finishImport; let saved = false
  const s = session({ videoLibrary: { list: async () => ({ items: [] }), import: () => new Promise(resolve => { finishImport = () => { saved = true; resolve({ id: 'saved' }) } }), apply: () => assert.fail('late apply') } })
  s.controller.receive(message('ready')); s.controller.receive(message('download', { requestId: 'one', assetId: 'asset', sha256: sha })); await tick()
  assert.equal(s.states.at(-1).phase, 'importing'); const sent = s.sent.length
  s.controller.dispose(); finishImport(); await tick()
  s.controller.receive(message('apply', { requestId: 'one' })); s.controller.receive(message('ready'))
  assert.equal(saved, true); assert.equal(s.sent.length, sent)
})
test('apply failure permits explicit retry and query persistence strips unapproved keys', async () => {
  let query; let attempts = 0
  const s = session({ onNavigate: value => { query = value }, videoLibrary: { list: async () => ({ items: [] }), import: async () => ({ id: 'local' }), apply: async () => { attempts++; throw new Error('backend') } } })
  s.controller.receive(message('ready')); s.controller.receive(message('navigate', { query: 'q=cloud&wallpaper=demo&parentOrigin=https://evil.test&session=x&url=x' }))
  assert.equal(query, 'q=cloud&wallpaper=demo')
  s.controller.receive(message('download', { requestId: 'one', assetId: 'asset', sha256: sha })); await tick()
  s.controller.receive(message('apply', { requestId: 'one' })); await tick(); assert.equal(s.states.at(-1).phase, 'ready')
  s.controller.receive(message('apply', { requestId: 'one' })); await tick(); assert.equal(attempts, 2)
})

test('parent and child close during explicit apply wait for settlement without a second apply', async () => {
  for (const viaChild of [true, false]) {
    for (const rejectApply of [false, true]) {
      let settle; let calls = 0; let closes = 0
      const s = session({ onClose: () => { closes++ }, videoLibrary: {
        list: async () => ({ items: [] }), import: async () => ({ id: 'local' }),
        apply: () => { calls++; return new Promise((resolve, reject) => { settle = () => rejectApply ? reject(new Error('failed')) : resolve() }) },
      } })
      s.controller.receive(message('ready'))
      s.controller.receive(message('download', { requestId: 'one', assetId: 'asset', sha256: sha })); await tick()
      s.controller.apply('one')
      assert.equal(s.states.at(-1).phase, 'applying')
      if (viaChild) s.controller.receive(message('close'))
      else s.controller.requestClose()
      assert.equal(closes, 0, 'market must remain visible while explicit application is pending')
      assert.match(s.states.at(-1).message, /完成后返回/)
      s.controller.apply('one'); s.controller.receive(message('close'))
      assert.equal(calls, 1); assert.equal(closes, 0)
      settle(); await tick()
      assert.equal(closes, 1, 'both resolution and rejection honor the pending close')
      s.controller.requestClose(); s.controller.receive(message('ready'))
      assert.equal(closes, 1)
    }
  }
})

test('forced disposal during apply terminates session immediately without a late close callback', async () => {
  let settle; let closes = 0
  const s = session({ onClose: () => { closes++ }, videoLibrary: {
    list: async () => ({ items: [] }), import: async () => ({ id: 'local' }),
    apply: () => new Promise(resolve => { settle = resolve }),
  } })
  s.controller.receive(message('ready')); s.controller.receive(message('download', { requestId: 'one', assetId: 'asset', sha256: sha })); await tick()
  s.controller.apply('one'); s.controller.requestClose(); s.controller.dispose()
  const sent = s.sent.length
  settle(); await tick()
  assert.equal(closes, 0); assert.equal(s.sent.length, sent)
})
