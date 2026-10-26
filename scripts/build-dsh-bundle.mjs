import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const target = resolve(root, 'plugin/client.js')
const core = readFileSync(resolve(root, 'shared/skin-core.js'), 'utf8')
const marketDownload = readFileSync(resolve(root, 'shared/market-download.js'), 'utf8')
const marketClient = readFileSync(resolve(root, 'shared/market-client.js'), 'utf8')

const adapter = String.raw`
  const KEYS = Object.freeze({
    enabled: 'bsEnabled',
    skin: 'bsSkin',
    sea: 'bsSea',
    time: 'bsTime',
    glass: 'bsGlass',
    autoCycle: 'bsAutoCycle',
    chatCustom: 'bsChatCustom',
    chatOpacity: 'bsChatOpacity',
    p: 'bsSkinParams',
  });

  function readSetting(key, fallback) {
    try {
      const value = localStorage.getItem(KEYS[key]);
      if (value === null) return fallback;
      if (key === 'enabled' || key === 'autoCycle') return value !== 'false';
      if (key === 'chatCustom') return value === 'true';
      if (key === 'skin') return value;
      if (key === 'p') {
        try { return JSON.parse(value); } catch { return fallback; }
      }
      return Number(value);
    } catch {
      return fallback;
    }
  }

  exports.name = 'dsh-zed-space-client';
  exports.inject = [];
  exports.apply = function apply(ctx) {
    let market;
    const controller = globalThis.BackspaceSkinCore.createController({
      onDiscoverVideos: () => market.open(),
      assetUrl: (path) => '/dsh-zed-space/' + path,
      storage: {
        get: async (defaults) => ({
          enabled: readSetting('enabled', defaults.enabled),
          skin: readSetting('skin', defaults.skin),
          sea: readSetting('sea', defaults.sea),
          time: readSetting('time', defaults.time),
          glass: readSetting('glass', defaults.glass),
          autoCycle: readSetting('autoCycle', defaults.autoCycle),
          chatCustom: readSetting('chatCustom', defaults.chatCustom),
          chatOpacity: readSetting('chatOpacity', defaults.chatOpacity),
          p: readSetting('p', undefined),
        }),
        set: async (patch) => {
          try {
            for (const [key, value] of Object.entries(patch)) {
              if (key === 'p') localStorage.setItem(KEYS.p, JSON.stringify(value));
              else localStorage.setItem(KEYS[key], String(value));
            }
          } catch {
            // Locked-down storage keeps the live value for this page.
          }
        },
      },
    });
    market = globalThis.ZedSpaceMarket.create({
      assetUrl: (path) => '/dsh-zed-space/' + path,
      videoLibrary: controller.videoLibrary,
      onClose: () => controller.focusVideoDiscovery(),
    });
    void controller.start();
    ctx.effect(() => () => { market.dispose(); controller.stop(); }, 'dsh-zed-space: browser surface');
  };

  return module.exports;
}});
`

const expected = `// GENERATED from shared/skin-core.js and shared/market-*.js. Run npm run build after editing shared sources.\nwindow.__ModuleLoader__.load({ id: "dsh-zed-space", factory: (require) => {\n  var module = { exports: {} };\n  var exports = module.exports;\n${core}\n${marketDownload}\n${marketClient}\n${adapter}`

if (check) {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== expected) {
    throw new Error('plugin/client.js is stale; run npm run build')
  }
} else {
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, expected)
  console.log('DeepSeek Harness installable bundle is up to date.')
}
