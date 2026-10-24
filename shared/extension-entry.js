// Chrome/Edge MV3 adapter for the shared skin controller.
(() => {
  'use strict';

  const isHarnessPage = () => {
    if (document.title !== 'DeepSeek Harness' || !document.getElementById('root')) return false;
    return [...document.scripts].some((script) =>
      /window\.__DSH_BOOT__\s*=/.test(script.textContent || ''));
  };

  const ready = () => new Promise((resolve) => {
    if (document.readyState !== 'loading') { resolve(); return; }
    document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  const parseParams = (value) => {
    if (typeof value !== 'string' || value === '') return undefined;
    try { return JSON.parse(value); } catch { return undefined; }
  };

  const start = async () => {
    await ready();
    // Loopback access is intentionally broad enough for custom Harness ports,
    // so verify the server-rendered Harness boot marker before touching the DOM.
    if (!isHarnessPage()) return;

    const controller = globalThis.BackspaceSkinCore.createController({
      assetUrl: (path) => chrome.runtime.getURL(path),
      storage: {
        get: async (defaults) => {
          const stored = await chrome.storage.sync.get({
            skinEnabled: defaults.enabled,
            skinSkin: defaults.skin,
            skinSea: defaults.sea,
            skinTime: defaults.time,
            skinGlass: defaults.glass,
            skinAutoCycle: defaults.autoCycle,
            skinChatCustom: defaults.chatCustom,
            skinChatOpacity: defaults.chatOpacity,
            skinSkinParams: '',
          });
          return {
            enabled: stored.skinEnabled,
            skin: stored.skinSkin,
            sea: stored.skinSea,
            time: stored.skinTime,
            glass: stored.skinGlass,
            autoCycle: stored.skinAutoCycle,
            chatCustom: stored.skinChatCustom,
            chatOpacity: stored.skinChatOpacity,
            p: parseParams(stored.skinSkinParams),
          };
        },
        set: (patch) => chrome.storage.sync.set({
          ...(patch.enabled === undefined ? {} : { skinEnabled: patch.enabled }),
          ...(patch.skin === undefined ? {} : { skinSkin: patch.skin }),
          ...(patch.sea === undefined ? {} : { skinSea: patch.sea }),
          ...(patch.time === undefined ? {} : { skinTime: patch.time }),
          ...(patch.glass === undefined ? {} : { skinGlass: patch.glass }),
          ...(patch.autoCycle === undefined ? {} : { skinAutoCycle: patch.autoCycle }),
          ...(patch.chatCustom === undefined ? {} : { skinChatCustom: patch.chatCustom }),
          ...(patch.chatOpacity === undefined ? {} : { skinChatOpacity: patch.chatOpacity }),
          ...(patch.p === undefined ? {} : { skinSkinParams: JSON.stringify(patch.p) }),
        }),
      },
      listen: (notify) => {
        const listener = (changes, area) => {
          if (area !== 'sync') return;
          const patch = {};
          if (changes.skinEnabled) patch.enabled = changes.skinEnabled.newValue;
          if (changes.skinSkin) patch.skin = changes.skinSkin.newValue;
          if (changes.skinSea) patch.sea = changes.skinSea.newValue;
          if (changes.skinTime) patch.time = changes.skinTime.newValue;
          if (changes.skinGlass) patch.glass = changes.skinGlass.newValue;
          if (changes.skinAutoCycle) patch.autoCycle = changes.skinAutoCycle.newValue;
          if (changes.skinChatCustom) patch.chatCustom = changes.skinChatCustom.newValue;
          if (changes.skinChatOpacity) patch.chatOpacity = changes.skinChatOpacity.newValue;
          if (changes.skinSkinParams) patch.p = parseParams(changes.skinSkinParams.newValue);
          if (Object.keys(patch).length > 0) notify(patch);
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
      },
    });
    await controller.start();
  };

  void start();
})();
