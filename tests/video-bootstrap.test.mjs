import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const source = (await readFile(new URL('../shared/video.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '')

test('视频模块向网页和 DSH 桌面原生来源握手，拒绝其他本地来源', () => {
  const token = '12345678-1234-1234-1234-123456789abc'
  for (const [origin, allowed] of [['https://example.test', true], ['http://127.0.0.1:3080', true], ['dsh-app://app', true], ['dsh-app://other', false], ['null', false], ['file://', false]]) {
    const sent = []
    runInNewContext(source, {
      URLSearchParams,
      location: { search: `?${new URLSearchParams({ parentOrigin: origin, token })}` },
      parent: { postMessage: (message, target) => sent.push({ event: message.event, token: message.token, target }) },
      window: {}, document: { addEventListener() {} }, addEventListener() {},
      matchMedia: () => ({ matches: false, addEventListener() {} }),
    })
    assert.deepEqual(sent, allowed ? [{ event: 'ready', token, target: origin }] : [], origin)
  }
})
