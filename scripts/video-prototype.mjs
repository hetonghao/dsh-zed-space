import { serveDirectory } from './browser-support.mjs'
const server = await serveDirectory(new URL('../', import.meta.url).pathname)
console.log(server.url + '/preview/video-import-prototype.html?variant=A')
