// Static-dist adapter for the shared skin controller.
(() => {
  'use strict';
  const KEYS = {
    enabled: 'bsEnabled',
    skin: 'bsSkin',
    sea: 'bsSea',
    time: 'bsTime',
    glass: 'bsGlass',
    autoCycle: 'bsAutoCycle',
    chatCustom: 'bsChatCustom',
    chatOpacity: 'bsChatOpacity',
    p: 'bsSkinParams',
  };
  const read = (key, fallback) => {
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
    } catch { return fallback; }
  };
  const controller = globalThis.BackspaceSkinCore.createController({
    assetUrl: (path) => `/dsh-backspace/${path}`,
    storage: {
      get: async (defaults) => ({
        enabled: read('enabled', defaults.enabled),
        skin: read('skin', defaults.skin),
        sea: read('sea', defaults.sea),
        time: read('time', defaults.time),
        glass: read('glass', defaults.glass),
        autoCycle: read('autoCycle', defaults.autoCycle),
        chatCustom: read('chatCustom', defaults.chatCustom),
        chatOpacity: read('chatOpacity', defaults.chatOpacity),
        p: read('p', undefined),
      }),
      set: async (patch) => {
        try {
          for (const [key, value] of Object.entries(patch)) {
            if (key === 'p') localStorage.setItem(KEYS.p, JSON.stringify(value));
            else localStorage.setItem(KEYS[key], String(value));
          }
        } catch { /* private or locked-down storage: keep the live value */ }
      },
    },
  });
  void controller.start();
})();
