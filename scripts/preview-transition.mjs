import { fileURLToPath } from 'node:url';
import { serveDirectory } from './browser-support.mjs';

const server = await serveDirectory(fileURLToPath(new URL('../', import.meta.url)));
console.log(`Backspace 转场原型：${server.url}/preview/transition-prototype.html`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  await server.close();
  process.exit(0);
});
