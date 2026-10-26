import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../plugin/index.js'

function createResponse() {
  return {
    body: undefined,
    headers: undefined,
    status: undefined,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(body) {
      this.body = body
    },
  }
}

function captureRoute() {
  let route
  const ctx = {
    effect(factory) {
      factory()
    },
    webServer: {
      register(value) {
        route = value
        return () => {}
      },
    },
  }
  apply(ctx)
  return route
}

test('DSH Host bundle serves only local Backspace assets', async () => {
  const route = captureRoute()
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, '/dsh-zed-space')

  const page = createResponse()
  await route.handler({ method: 'GET', url: '/dsh-zed-space/skin.html' }, page)
  assert.equal(page.status, 200)
  assert.equal(page.headers['content-type'], 'text/html; charset=utf-8')
  assert.match(page.body.toString(), /src="\.\/ocean\.js\?skin=1"/)

  const head = createResponse()
  await route.handler({ method: 'HEAD', url: '/dsh-zed-space/styles.css' }, head)
  assert.equal(head.status, 200)
  assert.equal(head.body, undefined)
  assert.ok(Number(head.headers['content-length']) > 0)

  const traversal = createResponse()
  await route.handler({ method: 'GET', url: '/dsh-zed-space/%2e%2e%2fpackage.json' }, traversal)
  assert.equal(traversal.status, 403)

  const method = createResponse()
  await route.handler({ method: 'POST', url: '/dsh-zed-space/skin.html' }, method)
  assert.equal(method.status, 405)
  assert.equal(method.headers.allow, 'GET, HEAD')
})
