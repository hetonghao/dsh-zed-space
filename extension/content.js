// GENERATED from shared/skin-core.js. Run npm run build after editing shared sources.
// Backspace shared host-page controller.
//
// This file intentionally has no import/export statements: the release build
// concatenates it with either the Chrome storage adapter or the localStorage
// adapter, so both installation paths run the same DOM, glass and a11y code.
//
// 三皮肤架构（2026-10）：海面（ocean，Walegpu 渲染器）+ 事件视界（horizon）+
// 吸积涡旋（vortex）。三张皮肤各自的独立参数在下面 SKINS 里声明；海面沿用原有
// 的 state.sea / state.time 两个字段，两张新皮肤的参数存在 state.p[skinId]，
// 整体序列化成一条 JSON 由三条安装入口各自持久化。公共参数（总开关、玻璃、
// 对话面板、自动昼夜）对三张皮肤都生效。
(function registerBackspaceSkinCore(global) {
  'use strict';

  const IDS = Object.freeze({
    frame: '__dsh-backspace__',
    cosmos: '__dsh-backspace-cosmos__',
    glass: '__dsh-backspace-glass__',
    uiStyle: '__dsh-backspace-glass__-ui',
    button: '__dsh-backspace-btn__',
    panel: '__dsh-backspace-panel__',
  });

  // 海面参数（sea/time）留在顶层，与 1.2.6 的存储结构完全兼容：
  // 升级后用户原来的波浪大小/日光不会被重置。
  const DEFAULTS = Object.freeze({
    enabled: true,
    skin: 'ocean',
    sea: 50,
    time: 55,
    glass: 70,
    autoCycle: true,
    chatCustom: true,
    chatOpacity: 90,
  });

  // ---------------------------------------------------------------------------
  // 皮肤清单：面板、持久化、帧分派都只认这张表。
  // `params` 必须与 shared/skins/<id>.js 里导出的 props 一致（tests/skins.test.mjs
  // 会逐项比对，避免两边工资单漂移）。
  // 字段：key（同时决定 uniform 名与面板 id）、min/max/def、format、stopsCycle。
  // ---------------------------------------------------------------------------
  // SKIN-PARAMS-BEGIN
  const SKINS = Object.freeze([
    Object.freeze({
      id: 'ocean',
      surface: 'ocean',
      params: Object.freeze([
        Object.freeze({ key: 'sea', min: 0, max: 100, def: 50 }),
        Object.freeze({ key: 'time', min: 0, max: 100, def: 55, format: 'time', stopsCycle: true }),
      ]),
    }),
    Object.freeze({
      id: 'horizon',
      surface: 'cosmos',
      params: Object.freeze([
        Object.freeze({ key: 'glow', min: 0, max: 100, def: 70 }),
        Object.freeze({ key: 'curl', min: 0, max: 100, def: 50 }),
        Object.freeze({ key: 'hue', min: -60, max: 60, def: 0, format: 'signed' }),
        Object.freeze({ key: 'stars', min: 0, max: 100, def: 45 }),
        Object.freeze({ key: 'drift', min: 0, max: 100, def: 30 }),
        Object.freeze({ key: 'pull', min: 0, max: 100, def: 55 }),
      ]),
    }),
    Object.freeze({
      id: 'void',
      surface: 'cosmos',
      params: Object.freeze([
        Object.freeze({ key: 'flow', min: 0, max: 100, def: 20 }),
        Object.freeze({ key: 'glow', min: 0, max: 100, def: 50 }),
        Object.freeze({ key: 'cloud', min: 0, max: 100, def: 50 }),
      ]),
    }),
    Object.freeze({
      id: 'echo',
      surface: 'cosmos',
      params: Object.freeze([
        Object.freeze({ key: 'flow', min: 0, max: 100, def: 35 }),
        Object.freeze({ key: 'radius', min: 0, max: 100, def: 50 }),
        Object.freeze({ key: 'bands', min: 0, max: 100, def: 55 }),
      ]),
    }),
    Object.freeze({
      id: 'vortex',
      surface: 'cosmos',
      params: Object.freeze([
        Object.freeze({ key: 'spin', min: 0, max: 100, def: 50 }),
        Object.freeze({ key: 'ring', min: 0, max: 100, def: 55 }),
        Object.freeze({ key: 'turb', min: 0, max: 100, def: 55 }),
        Object.freeze({ key: 'warm', min: 0, max: 100, def: 60 }),
        Object.freeze({ key: 'pulse', min: 0, max: 100, def: 70 }),
        Object.freeze({ key: 'parallax', min: 0, max: 100, def: 50 }),
      ]),
    }),
  ]);
  // SKIN-PARAMS-END

  const skinById = (id) => SKINS.find((skin) => skin.id === id) || SKINS[0];


  // The conversation column shares the workspace glass until the independent
  // control is switched on; at 100% it is indistinguishable from unthemed
  // Harness. Keep these bounds in one place: the slider, normalize() and the
  // generated CSS must agree on them.
  const CHAT_OPACITY_MIN = 40;
  const CHAT_OPACITY_MAX = 100;

  // Layers that float above the workspace must stay readable, so the glass
  // alpha never applies to them. Harness paints hover previews with
  // --dsw-alias-bg-layer-1 and dialogs / floating dock windows with layer-2;
  // both are opaque in its own palette. Overriding them with the workspace
  // alpha let the page behind bleed through the preview card's diff text.
  // Keep this the same value the settings dialog already uses.
  const ELEVATED_ALPHA = 0.97;

  const COPY = Object.freeze({
    zh: {
      button: 'Backspace 皮肤设置',
      close: '关闭',
      sea: '波浪大小',
      time: '日光',
      glass: '玻璃不透明度',
      enable: '启用 Backspace 皮肤',
      autoCycle: '自动昼夜变化',
      chatCustom: '对话面板独立背景调整',
      chatOpacity: '对话面板不透明度',
      reset: '恢复默认',
      resetNote: () => resetNoteText('zh'),
      note: '切换皮肤即时生效，三张皮肤各自的独立配置分别保存，重开 Harness 后恢复。调节即时生效并自动保存；手动设定「日光」会停止自动昼夜变化。开启「对话面板独立背景调整」后，可以用下面的拖动条单独设定中间对话区的背景浓度，100% 即 Harness 原生背景；关闭时对话区跟随上面的「玻璃不透明度」，左右侧栏始终使用主玻璃。两张宇宙皮肤支持鼠标与点击：移动鼠标产生视差/引力，点击产生脉冲。',
      times: ['黄昏', '金色时刻', '下午', '正午'],
      skinTitle: '皮肤',
      ownTitle: '独立配置',
      commonTitle: '公共配置',
      skins: { ocean: '海面', horizon: '事件视界', void: '深渊', echo: '余响', vortex: '吸积涡旋' },
      params: {
        sea: '波浪大小', time: '日光',
        glow: '吸积亮度', curl: '细丝曲率', hue: '色相偏移', stars: '星点密度', drift: '流动速度', pull: '鼠标引力',
        'void.flow': '细丝流速', 'void.glow': '细丝辉光', 'void.cloud': '星云浓度',
        'echo.flow': '轨道流速', 'echo.radius': '黑盘尺度', 'echo.bands': '光环密度',
        spin: '自转速度', ring: '盘体半径', turb: '湍流细丝', warm: '色温', pulse: '点击脉冲', parallax: '鼠标视差',
      },
    },
    en: {
      button: 'Backspace skin settings',
      close: 'Close',
      sea: 'Sea state',
      time: 'Daylight',
      glass: 'Glass opacity',
      enable: 'Enable Backspace skin',
      autoCycle: 'Automatic day cycle',
      chatCustom: 'Independent conversation background',
      chatOpacity: 'Conversation opacity',
      reset: 'Reset to defaults',
      resetNote: () => resetNoteText('en'),
      note: 'Skins switch instantly, and each skin keeps its own settings, restored after a reload. Changes apply immediately and save automatically. Setting daylight manually stops the automatic day cycle. Turning on the independent conversation background lets the slider below set how strongly the center column is tinted; 100% is Harness\'s native background. Switch it off and the conversation follows the glass opacity above, while the sidebars always use the workspace glass. Both cosmic skins react to the mouse and to clicks: pointer movement drives parallax/gravity, a click fires a pulse.',
      times: ['Dusk', 'Golden hour', 'Afternoon', 'Midday'],
      skinTitle: 'Skin',
      ownTitle: 'Skin settings',
      commonTitle: 'Shared settings',
      skins: { ocean: 'Ocean', horizon: 'Event Horizon', void: 'Abyss', echo: 'Echo', vortex: 'Accretion Vortex' },
      params: {
        sea: 'Sea state', time: 'Daylight',
        glow: 'Glow', curl: 'Filament curl', hue: 'Hue shift', stars: 'Star density', drift: 'Flow speed', pull: 'Pointer gravity',
        'void.flow': 'Filament flow', 'void.glow': 'Filament glow', 'void.cloud': 'Nebula density',
        'echo.flow': 'Orbit speed', 'echo.radius': 'Disk radius', 'echo.bands': 'Ring density',
        spin: 'Spin speed', ring: 'Disk radius', turb: 'Turbulence', warm: 'Temperature', pulse: 'Click pulse', parallax: 'Pointer parallax',
      },
    },
  });

  // 恢复默认的说明文案由 SKINS 生成：加皮肤时不用再去改这两段中英文本。
  const resetNoteText = (lang) => {
    const skinDefs = SKINS.filter((skin) => skin.surface === 'cosmos')
      .map((skin) => `${COPY[lang].skins[skin.id]} ${skin.params.map((param) => param.def).join('·')}`)
      .join(' / ');
    return lang === 'zh'
      ? `恢复全部默认设置（每张皮肤的独立配置一并恢复，当前皮肤保持不变）：波浪 50 / 日光 55 / ${skinDefs} / 玻璃 70 / 自动昼夜开 / 对话面板独立背景开、不透明度 90`
      : `Restore all defaults (every skin\'s own settings included; the active skin is kept): sea 50 / daylight 55 / ${skinDefs} / glass 70 / auto cycle on / independent conversation background on at 90%`;
  };

  const WAVE_ICON = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M1.5 8.5c1.2-1.7 2.4-1.7 3.6 0s2.4 1.7 3.6 0 1.9-1.2 3-0.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M1.5 12c1.2-1.4 2.4-1.4 3.6 0s2.4 1.4 3.6 0 1.9-1 3-.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>
</svg>`;

  // 宇宙皮肤若在此时限内没有报「首帧成功」，视为加载失败并回退海面。
  const COSMOS_READY_TIMEOUT = 8000;

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  // 新皮肤的参数整块存成 JSON（state.p[skinId][key]）；缺失项按 def 补齐，
  // 越界值夹紧，字段名不认识就丢——存储被手改过也不会把面板搞坏。
  function normalizeParams(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {};
    for (const skin of SKINS) {
      if (skin.surface === 'ocean') continue;
      const given = source[skin.id] && typeof source[skin.id] === 'object' ? source[skin.id] : {};
      out[skin.id] = {};
      for (const param of skin.params) {
        out[skin.id][param.key] = clamp(given[param.key], param.min, param.max, param.def);
      }
    }
    return out;
  }

  function normalize(raw) {
    return {
      enabled: raw.enabled !== false,
      skin: SKINS.some((skin) => skin.id === raw.skin) ? raw.skin : DEFAULTS.skin,
      sea: clamp(raw.sea, 0, 100, DEFAULTS.sea),
      time: clamp(raw.time, 0, 100, DEFAULTS.time),
      glass: clamp(raw.glass, 40, 90, DEFAULTS.glass),
      autoCycle: raw.autoCycle !== false,
      chatCustom: raw.chatCustom === true,
      chatOpacity: clamp(raw.chatOpacity, CHAT_OPACITY_MIN, CHAT_OPACITY_MAX, DEFAULTS.chatOpacity),
      p: normalizeParams(raw.p),
    };
  }

  function selectCopy(locale) {
    const requested = locale || document.documentElement.lang || navigator.language || 'en';
    return requested.toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
  }

  // 参数文案先查「皮肤.参数」，再回落裸 key：同一个 key 在不同皮肤里可以是不同的东西
  // （void.flow 是细丝流速，echo.flow 是轨道流速）。
  // 海面参数沿用 1.2.6 的 DOM id（`-sea-range`），验收脚本按它取元素；
  // 新增皮肤一律加 id 前缀，否则 void.flow 与 echo.flow 会撞同一个 id。
  function paramDomId(skin, param, suffix) {
    const base = skin.surface === 'ocean' ? param.key : `${skin.id}-${param.key}`;
    return `${IDS.panel}-${base}${suffix ? `-${suffix}` : ''}`;
  }

  function paramLabel(copy, skin, param) {
    return copy.params[`${skin.id}.${param.key}`] || copy.params[param.key] || param.key;
  }

  function timeLabel(copy, value) {
    const t = value / 100;
    if (t < 0.12) return copy.times[0];
    if (t < 0.30) return copy.times[1];
    if (t < 0.62) return copy.times[2];
    return copy.times[3];
  }

  function paramText(copy, param, value) {
    if (param.format === 'time') return timeLabel(copy, value);
    if (param.format === 'signed') return value > 0 ? `+${value}` : String(value);
    return String(value).padStart(2, '0');
  }

  function alpha(value) {
    return Number(value.toFixed(2));
  }

  // The native center column must look like unthemed Harness. Harness declares
  // its base palette as --dsw-static-neutral-bluish-* on :root and maps the
  // --dsw-alias-bg-* / --dsw-specific-* aliases onto it. We only override the
  // aliases, so re-declaring them from the static palette restores native color
  // inside a subtree without hardcoding hex values from one Harness build.
  const NATIVE_TOKENS = Object.freeze({
    light: {
      '--dsw-alias-bg-base': 'var(--dsw-static-neutral-bluish-00, #fff)',
      '--dsw-alias-bg-layer-1': 'var(--dsw-static-neutral-bluish-00, #fff)',
      '--dsw-alias-bg-layer-2': 'var(--dsw-static-neutral-bluish-00, #fff)',
      '--dsw-alias-bg-layer-3': 'var(--dsw-static-neutral-bluish-00, #fff)',
      '--dsw-alias-bg-module-platform': 'var(--dsw-static-neutral-bluish-60, #f5f6f7)',
      '--dsw-alias-bg-multi-select': 'var(--dsw-static-neutral-bluish-60, #f5f6f7)',
      '--dsw-alias-bg-overlay': 'var(--dsw-static-neutral-bluish-150, #e9ecf2)',
      '--dsw-specific-sidebar-fill': 'var(--dsw-static-neutral-bluish-50, #f9fafb)',
      '--dsw-specific-selector': 'var(--dsw-static-neutral-bluish-60, #f5f6f7)',
    },
    dark: {
      '--dsw-alias-bg-base': 'var(--dsw-static-neutral-bluish-950, #151517)',
      '--dsw-alias-bg-layer-1': 'var(--dsw-static-neutral-bluish-875, #232324)',
      '--dsw-alias-bg-layer-2': 'var(--dsw-static-neutral-bluish-850, #2c2c2e)',
      '--dsw-alias-bg-layer-3': 'var(--dsw-static-neutral-bluish-800, #353638)',
      '--dsw-alias-bg-module-platform': 'var(--dsw-static-neutral-bluish-800, #353638)',
      '--dsw-alias-bg-multi-select': 'var(--dsw-static-neutral-bluish-800, #353638)',
      '--dsw-alias-bg-overlay': 'var(--dsw-static-neutral-bluish-700, #61666b)',
      '--dsw-specific-sidebar-fill': 'var(--dsw-static-neutral-bluish-900, #1b1b1c)',
      '--dsw-specific-selector': 'var(--dsw-static-neutral-bluish-800, #353638)',
    },
  });

  // The conversation column may be given its own opacity. At 100% it has to be
  // indistinguishable from unthemed Harness, so the paint is always derived from
  // Harness's own static palette instead of a hex value copied from one build.
  // color-mix() then scales that native color to any opacity the slider allows.
  function nativeBase(theme) {
    return theme === 'dark'
      ? 'var(--dsw-static-neutral-bluish-950, #151517)'
      : 'var(--dsw-static-neutral-bluish-00, #fff)';
  }

  function chatPercent(opacity) {
    return clamp(opacity, CHAT_OPACITY_MIN, CHAT_OPACITY_MAX, CHAT_OPACITY_MAX);
  }

  function chatPaint(theme, opacity) {
    const percent = chatPercent(opacity);
    if (percent >= CHAT_OPACITY_MAX) return nativeBase(theme);
    return `color-mix(in srgb, ${nativeBase(theme)} ${percent}%, transparent)`;
  }

  function chatTokens(theme, opacity) {
    const percent = chatPercent(opacity);
    const tokens = NATIVE_TOKENS[theme];
    if (percent >= CHAT_OPACITY_MAX) return tokens;
    return Object.fromEntries(Object.entries(tokens)
      .map(([name, value]) => [name, `color-mix(in srgb, ${value} ${percent}%, transparent)`]));
  }

  // Every supported shell exposes the conversation column with a different
  // root: classic Harness Web (`.wSkVaW_root`), the slot wrapper, the community
  // desktop frame and the official 0.2.x AppFrame, whose only stable marker is
  // the shell overlay sibling. Redeclaring Harness's own palette tokens inside
  // that subtree keeps every nested surface that paints `var(--dsw-alias-bg-*)`
  // in step with the column instead of with the workspace glass.
  const CONVERSATION_ROOTS = Object.freeze([
    '.wSkVaW_root',
    '[data-slot="conversation"]',
    '.dshDesktopConversationSurface',
    'div:has(> [data-shell-overlay]) > :nth-child(2):not([data-shell-overlay])',
  ]);

  // Only the outermost column of each shell may paint the background. Painting
  // both a wrapper and the surface nested inside it would stack two translucent
  // layers and render the transcript darker than the slider promises.
  const CONVERSATION_PAINTS = Object.freeze([
    '.wSkVaW_root',
    'body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) .dshDesktopConversationSurface',
    'html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) > :nth-child(2)',
  ]);

  function conversationCss(opacity) {
    // Rename only the property names: the values must keep pointing at
    // Harness's own --dsw-static-neutral-bluish-* palette.
    const declarations = (theme, rename) => Object.entries(chatTokens(theme, opacity))
      .map(([name, value]) => `  ${rename(name)}: ${value};`)
      .join('\n');
    const themed = (theme) => `${declarations(theme, (name) => `--bs-chat-${name.slice('--dsw-'.length)}`)}
  --bs-chat-base: ${chatPaint(theme, opacity)};`;
    // Theme is resolved once, at the variable-definition level, where a
    // `body[data-ds-dark-theme]` prefix is valid on its own. The paint rules
    // below stay theme-agnostic: prefixing every shell root instead would emit
    // impossible selectors such as `body[x] html ... body ...`, silently
    // falling back to Harness's light palette in dark mode.
    const roots = CONVERSATION_ROOTS.join(',\n');
    const paints = CONVERSATION_PAINTS.join(',\n');
    const aliases = Object.keys(NATIVE_TOKENS.light)
      .map((name) => `  ${name}: var(--bs-chat-${name.slice('--dsw-'.length)}) !important;`)
      .join('\n');
    return `
/* Independent conversation background: only this column changes, and only up
   to its own opacity. The sidebars always keep the workspace glass. */
:root {
${themed('light')}
}
body[data-ds-dark-theme] {
${themed('dark')}
}
${roots} {
${aliases}
}
${paints} {
  background: var(--bs-chat-base) !important;
}`;
  }

  function glassCss(glass, chatCustom, chatOpacity) {
    const light = glass / 100;
    const dark = Math.max(0.40, light - 0.12);
    // The conversation column gets its own opacity only when the independent
    // control is on. Alpha composites, so a conversation that must end up
    // lighter than the workspace glass cannot sit on top of a shared frame
    // paint: the frame would always show through. In that mode each column
    // paints exactly one layer of its own instead, which also keeps nested
    // fills from compounding.
    const chat = chatCustom ? chatPercent(chatOpacity) : null;
    const independent = chat !== null;
    const communitySurfaces = [
      ...(independent ? [] : ['.dshDesktopSidebarSurface']),
      ...(independent ? [] : [
        '.dshDesktopConversationSurface',
        '.dshDesktopConversationSurface > *',
        '.dshDesktopConversationSurface [data-phase="hero"]',
        '.dshDesktopConversationSurface [data-phase="active"]',
        '.dshDesktopConversationSurface [data-phase="settling"]',
      ]),
      ...(independent ? [] : ['.dshDesktopDetailsSurface']),
      '.dshDesktopMacCaptionRow',
      '.dshDesktopWindowsCaptionRow',
      ...(independent ? [] : ['.dshDesktopDetailsSurface > *']),
    ];
    const officialColumns = independent ? '' : ':first-child, :nth-child(2), [data-rightbar-col]';
    const legacyRoots = independent ? '.pI_x6G_sidebarCol,\n.hHd-Xa_root' : '.wSkVaW_root,\n.pI_x6G_sidebarCol,\n.hHd-Xa_root';
    // Frames and column paints are only rearranged for the independent mode;
    // the shared-glass output stays byte-identical to the default path.
    const independentCss = independent ? `
/* Independent conversation background: the shared frame paint would otherwise
   show through every column, so it is handed back to the columns themselves.
   Each column paints once; nested fills stay transparent. */
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) .dshDesktopFrame,
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) {
  background: transparent !important;
}
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) :is(
  .dshDesktopSidebarSurface,
  .dshDesktopDetailsSurface
),
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) > :is(:first-child, [data-rightbar-col]) {
  background: var(--dsw-alias-bg-base) !important;
}
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) :is(
  .dshDesktopConversationSurface > *,
  .dshDesktopConversationSurface [data-phase],
  .dshDesktopDetailsSurface > *
) {
  background: transparent !important;
}` : '';
    return `
/* Backspace: one translucent shell; nested fills must not compound.
   Only the workspace surface (bg-base) and inline fills carry the glass alpha.
   layer-1 / layer-2 back floating Harness UI — hover preview cards, dialogs and
   floating dock windows — which stay near-opaque so their text never shows the
   page behind it through. */
body {
  background: transparent !important;
  --dsw-alias-bg-base: rgba(255, 255, 255, ${alpha(light)}) !important;
  --dsw-alias-bg-layer-1: rgba(255, 255, 255, ${alpha(ELEVATED_ALPHA)}) !important;
  --dsw-alias-bg-layer-2: rgba(255, 255, 255, ${alpha(ELEVATED_ALPHA)}) !important;
  --dsw-alias-bg-layer-3: rgba(255, 255, 255, ${alpha(light)}) !important;
  --dsw-alias-bg-module-platform: rgba(245, 246, 247, ${alpha(light + 0.02)}) !important;
  --dsw-alias-bg-multi-select: rgba(245, 246, 247, ${alpha(light + 0.02)}) !important;
  --dsw-alias-bg-overlay: rgba(233, 236, 242, .97) !important;
  --dsw-specific-sidebar-fill: rgba(249, 250, 251, ${alpha(Math.max(0.36, light - 0.04))}) !important;
  --dsw-specific-selector: rgba(245, 246, 247, ${alpha(light + 0.02)}) !important;
}
body[data-ds-dark-theme] {
  --dsw-alias-bg-base: rgba(9, 12, 16, ${alpha(dark)}) !important;
  --dsw-alias-bg-layer-1: rgba(12, 16, 22, ${alpha(ELEVATED_ALPHA)}) !important;
  --dsw-alias-bg-layer-2: rgba(16, 20, 27, ${alpha(ELEVATED_ALPHA)}) !important;
  --dsw-alias-bg-layer-3: rgba(20, 25, 33, ${alpha(dark)}) !important;
  --dsw-alias-bg-module-platform: rgba(13, 17, 23, ${alpha(dark + 0.02)}) !important;
  --dsw-alias-bg-multi-select: rgba(13, 17, 23, ${alpha(dark + 0.02)}) !important;
  --dsw-alias-bg-overlay: rgba(18, 22, 30, .97) !important;
  --dsw-specific-sidebar-fill: rgba(11, 15, 21, ${alpha(Math.max(0.35, dark - 0.05))}) !important;
  --dsw-specific-selector: rgba(13, 17, 23, ${alpha(dark + 0.02)}) !important;
}
/* DSH Desktop owns a different shell: its transparent sidebar and two
   independently painted conversation layers otherwise produce uneven glass.
   Paint the shared frame once. Only shell roots lose their fill; cards,
   composer, menus and the sibling overlay keep their own theme tokens. */
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) .dshDesktopFrame {
  background: var(--dsw-alias-bg-base) !important;
}
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) .dshDesktopSidebarSurface {
  --dsw-specific-sidebar-fill: transparent !important;
}
${communitySurfaces.length > 0 ? `body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) :is(
  ${communitySurfaces.join(',\n  ')}
) {
  background: transparent !important;
}` : ''}
/* Official Harness Desktop 0.2.x uses a different AppFrame from the
   community desktop wrapper. Its sidebar, center, conversation and docked
   rightbar each paint a surface; translucent paints compound into a much
   darker center. The shell overlay is a stable AppFrame marker, while the
   platform attributes keep this adjustment out of ordinary Harness Web. */
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) {
  background: var(--dsw-alias-bg-base) !important;
}
${officialColumns ? `html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) > :is(${officialColumns}),
`: ''}html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) > :nth-child(2) [data-phase],
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root [data-rightbar-col] [data-dockkit-host="dock"] > [data-dockkit-content] {
  background: transparent !important;
}
html[data-windows-titlebar] body #root div:has(> [data-shell-overlay])::before {
  background: transparent !important;
}
/* Modal cards can be independent body portals, including second-level plugin
   configuration. Protect semantic dialog surfaces, not the full-screen mask
   or shell overlay. Keep this independent of workspace opacity and DOM depth. */
body :is([data-shortcut-modal="settings"], [role="dialog"], [role="alertdialog"]) {
  background: rgba(250, 251, 253, .97) !important;
}
body[data-ds-dark-theme] :is([data-shortcut-modal="settings"], [role="dialog"], [role="alertdialog"]) {
  background: rgba(24, 28, 35, .97) !important;
}
/* Legacy Harness builds: these CSS-module hashes are best-effort fallbacks. */
${legacyRoots} {
  background: transparent !important;
}${independentCss}${independent ? conversationCss(chat) : ''}`;
  }

  function uiCss() {
    return `
#${IDS.button} {
  position: fixed; z-index: 6000; width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.14);
  background: rgba(12,16,22,.58); backdrop-filter: blur(14px) saturate(130%);
  color: #9fb3bd; cursor: pointer; padding: 0;
  transition: color .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .1s ease;
}
#${IDS.button}:hover { color:#8fe9e4; border-color:rgba(143,233,228,.5); background:rgba(16,22,30,.72); }
#${IDS.button}.active { color:#dafdfb; border-color:rgba(143,233,228,.55); background:rgba(143,233,228,.14); box-shadow:0 0 14px rgba(143,233,228,.25); }
#${IDS.button}:active { transform:scale(.94); }
#${IDS.button}:focus-visible, #${IDS.panel} button:focus-visible, #${IDS.panel} input:focus-visible { outline:2px solid rgba(143,233,228,.7); outline-offset:2px; }
#${IDS.panel} {
  position:fixed; z-index:6001; width:262px; padding:16px;
  border-radius:16px; border:1px solid rgba(255,255,255,.14);
  background:rgba(10,14,20,.86); backdrop-filter:blur(22px) saturate(140%);
  box-shadow:0 18px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.1);
  color:#eef4f6; font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;
  display:none; flex-direction:column;
  /* 1280x600 及更小的视口里，面板整体不超出屏幕，内容区自己滚动 */
  max-height:calc(100vh - 88px);
}
#${IDS.panel}.open { display:flex; }
#${IDS.panel} .bs-title { display:flex; align-items:center; justify-content:space-between; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.6); margin-bottom:12px; flex:0 0 auto; }
#${IDS.panel} .bs-mark, #${IDS.panel} .bs-value { color:#8fe9e4; }
#${IDS.panel} .bs-close { background:none; border:0; color:rgba(255,255,255,.55); font-size:18px; line-height:1; cursor:pointer; padding:3px 6px; border-radius:6px; }
#${IDS.panel} .bs-close:hover { color:#fff; background:rgba(255,255,255,.08); }
#${IDS.panel} .bs-tabs { display:flex; flex-wrap:wrap; gap:4px; flex:0 0 auto; }
#${IDS.panel} .bs-tab {
  flex:1 1 0; min-width:calc(33.333% - 4px); padding:6px 2px; border-radius:8px; cursor:pointer;
  border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.05);
  color:rgba(255,255,255,.72); font-size:10px; line-height:1.3; letter-spacing:.02em;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  transition:background .15s ease, color .15s ease, border-color .15s ease;
}
#${IDS.panel} .bs-tab:hover { color:#fff; border-color:rgba(143,233,228,.45); }
#${IDS.panel} .bs-tab[aria-selected='true'] { background:#8fe9e4; border-color:#8fe9e4; color:#08161a; font-weight:600; }
#${IDS.panel} .bs-scroll { overflow-y:auto; overscroll-behavior:contain; padding-right:3px; min-height:0; }
#${IDS.panel} .bs-scroll::-webkit-scrollbar { width:6px; }
#${IDS.panel} .bs-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,.16); border-radius:3px; }
#${IDS.panel} .bs-group-title { margin:13px 0 1px; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.42); }
#${IDS.panel} .bs-skin-group[hidden] { display:none; }
#${IDS.panel} .bs-row { margin-top:11px; }
/* The conversation slider is a child of its switch: indented, and hidden
   entirely (including from the tab order) while the switch is off. */
#${IDS.panel} .bs-sub { margin-top:9px; padding-left:11px; border-left:2px solid rgba(143,233,228,.28); }
#${IDS.panel} .bs-sub[hidden] { display:none; }
#${IDS.panel} .bs-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:8px; font-size:11px; letter-spacing:.1em; color:rgba(255,255,255,.7); }
#${IDS.panel} .bs-value { font-variant-numeric:tabular-nums; }
#${IDS.panel} input[type='range'] { appearance:none; display:block; width:100%; height:14px; margin:0; padding:0; background:transparent; cursor:pointer; }
#${IDS.panel} input[type='range']::-webkit-slider-runnable-track { height:3px; border-radius:2px; background:rgba(255,255,255,.2); }
#${IDS.panel} input[type='range']::-webkit-slider-thumb { appearance:none; width:14px; height:14px; margin-top:-5.5px; border:0; border-radius:50%; background:#8fe9e4; box-shadow:0 0 10px rgba(143,233,228,.75); }
#${IDS.panel} input[type='range']::-moz-range-track { height:3px; border-radius:2px; background:rgba(255,255,255,.2); }
#${IDS.panel} input[type='range']::-moz-range-thumb { width:14px; height:14px; border:0; border-radius:50%; background:#8fe9e4; box-shadow:0 0 10px rgba(143,233,228,.75); }
#${IDS.panel} .bs-note { margin-top:12px; font-size:10px; line-height:1.65; color:rgba(255,255,255,.46); }
#${IDS.panel} .bs-switch { display:flex; align-items:center; justify-content:space-between; gap:12px; }
#${IDS.panel} .bs-switch label { font-size:11px; color:rgba(255,255,255,.7); }
#${IDS.panel} .bs-switch input[type='checkbox'] { width:15px; height:15px; margin:0; accent-color:#8fe9e4; cursor:pointer; }
#${IDS.panel} .bs-reset { width:100%; margin-top:14px; padding:7px 0; border-radius:8px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#eef4f6; font-size:11px; cursor:pointer; transition:background .15s ease, border-color .15s ease; }
#${IDS.panel} .bs-reset:hover { background:rgba(143,233,228,.12); border-color:rgba(143,233,228,.4); }
@media (prefers-reduced-motion: reduce) {
  #${IDS.button}, #${IDS.panel}, #${IDS.panel} * { transition:none !important; }
}`;
  }

  // 两个 iframe 的表面样式：可见时铺满窗口；隐藏时缩到 1x1 并透明。
  // 缩到 1x1 会让帧内的 window.innerWidth 变化并触发它的 resize 处理，
  // 海面渲染器会把 WebGPU 画布同步缩到 1x1（几乎不耗 GPU），
  // 切回来再自动恢复——不需要给 shared/ocean.js 加任何暂停协议。
  const FRAME_STYLE_ON = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:0;pointer-events:none;background:transparent;';
  const FRAME_STYLE_OFF = 'position:fixed;left:0;top:0;width:1px;height:1px;border:0;z-index:0;pointer-events:none;opacity:0;background:transparent;';

  function createController(options) {
    if (!options || typeof options.assetUrl !== 'function' || !options.storage) {
      throw new TypeError('BackspaceSkinCore requires assetUrl() and storage adapters.');
    }

    let copy = selectCopy(options.locale);
    let state = normalize(DEFAULTS);
    let ownsSurface = false;
    let panelOpen = false;
    let previousFocus = null;
    let placementObserver = null;
    let placementFrame = 0;
    let readyTimer = 0;
    let pointerFrame = 0;
    let pointerPending = null;
    const surfaceCleanups = [];
    const controllerCleanups = [];

    const on = (target, event, listener, settings) => {
      target.addEventListener(event, listener, settings);
      surfaceCleanups.push(() => target.removeEventListener(event, listener, settings));
    };

    const save = (patch) => {
      state = normalize({ ...state, ...patch });
      return Promise.resolve(options.storage.set(patch)).catch((error) => {
        console.warn('[Backspace] Failed to save settings.', error);
      });
    };

    const updateGlass = () => {
      const style = document.getElementById(IDS.glass);
      if (style) style.textContent = glassCss(state.glass, state.chatCustom, state.chatOpacity);
    };

    const postToFrame = (id, payload) => {
      const frame = document.getElementById(id);
      if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) return;
      let targetOrigin = '*';
      try { targetOrigin = new URL(frame.src).origin; } catch { /* local test documents may have no absolute base URL */ }
      frame.contentWindow.postMessage(payload, targetOrigin);
    };

    const postToOcean = () => {
      postToFrame(IDS.frame, {
        type: 'bs-set', sea: state.sea, t: state.time, auto: state.autoCycle,
      });
    };

    const postToCosmos = () => {
      const skin = skinById(state.skin);
      if (skin.surface !== 'cosmos') return;
      postToFrame(IDS.cosmos, { type: 'bs-set', params: { ...state.p[skin.id] }, auto: state.autoCycle });
    };

    const setFrameActive = (id, active) => {
      const frame = document.getElementById(id);
      if (!(frame instanceof HTMLIFrameElement)) return;
      const next = active ? FRAME_STYLE_ON : FRAME_STYLE_OFF;
      if (frame.style.cssText !== next) frame.style.cssText = next;
    };

    const placeButton = () => {
      const button = document.getElementById(IDS.button);
      if (!(button instanceof HTMLElement)) return;
      const selectors = [
        '[data-slot="sidebar.settings"] button',
        '[data-testid="settings-trigger"]',
        '.VOzbGW_trigger',
      ];
      const trigger = selectors.map((selector) => document.querySelector(selector))
        .find((candidate) => candidate instanceof HTMLElement && candidate.getBoundingClientRect().width > 0);
      if (trigger instanceof HTMLElement) {
        const rect = trigger.getBoundingClientRect();
        button.style.left = `${Math.round(rect.right + 8)}px`;
        button.style.top = `${Math.round(rect.top + rect.height / 2 - 17)}px`;
        button.style.bottom = 'auto';
      } else {
        button.style.left = '16px';
        button.style.bottom = '16px';
        button.style.top = 'auto';
      }
    };

    const schedulePlace = () => {
      cancelAnimationFrame(placementFrame);
      placementFrame = requestAnimationFrame(placeButton);
    };

    const setPanelOpen = (open) => {
      const button = document.getElementById(IDS.button);
      const panel = document.getElementById(IDS.panel);
      if (!(button instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;
      panelOpen = open;
      panel.classList.toggle('open', open);
      button.classList.toggle('active', open);
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        previousFocus = document.activeElement;
        const rect = button.getBoundingClientRect();
        panel.style.left = `${Math.min(Math.max(12, rect.left - panel.offsetWidth + 34), window.innerWidth - panel.offsetWidth - 12)}px`;
        panel.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 10)}px`;
        // 焦点落在当前皮肤的可见控件上，避免落到隐藏皮肤的行里
        const first = panel.querySelector('.bs-skin-group:not([hidden]) input[type=\'range\']')
          || panel.querySelector('input');
        first?.focus();
      } else if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };

    // 海面 iframe：与 1.2.6 完全一致（skin.html + ?skin=1）
    const mountOceanFrame = () => {
      const root = document.body || document.documentElement;
      if (!root || document.getElementById(IDS.frame)) return false;
      const frame = document.createElement('iframe');
      const query = new URLSearchParams({
        skin: '1',
        sea: String(state.sea),
        t: String(state.time),
        auto: state.autoCycle ? '1' : '0',
        parentOrigin: location.origin,
      });
      frame.id = IDS.frame;
      frame.src = `${options.assetUrl('skin.html')}?${query}`;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.cssText = FRAME_STYLE_ON;
      root.insertBefore(frame, root.firstChild);
      ownsSurface = true;
      return true;
    };

    // 宇宙 iframe：两张新皮肤共用一块 WebGL2 画布，切换皮肤不用重载页面
    const mountCosmosFrame = () => {
      const root = document.body || document.documentElement;
      if (!root || document.getElementById(IDS.cosmos)) return false;
      const skin = skinById(state.skin);
      const query = new URLSearchParams({
        skin: skin.id,
        parentOrigin: location.origin,
        auto: state.autoCycle ? '1' : '0',
      });
      for (const [key, value] of Object.entries(state.p[skin.id] || {})) query.set(key, String(value));
      const frame = document.createElement('iframe');
      frame.id = IDS.cosmos;
      frame.src = `${options.assetUrl('cosmos.html')}?${query}`;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.cssText = FRAME_STYLE_ON;
      root.insertBefore(frame, root.firstChild);
      ownsSurface = true;
      armReadyWatchdog(skin.id);
      return true;
    };

    const ensureGlassStyle = () => {
      if (document.getElementById(IDS.glass)) return;
      const style = document.createElement('style');
      style.id = IDS.glass;
      style.textContent = glassCss(state.glass, state.chatCustom, state.chatOpacity);
      (document.head || document.documentElement).appendChild(style);
    };

    // 首帧看门狗：宇宙皮肤 8 秒内没报 ready（或直接报错）就回退海面，绝不留白屏
    function armReadyWatchdog(skinId) {
      clearTimeout(readyTimer);
      readyTimer = setTimeout(() => {
        if (state.skin !== skinId) return;
        console.warn('[Backspace] Cosmic skin never reported a first frame; falling back to the ocean skin.');
        fallbackToOcean();
      }, COSMOS_READY_TIMEOUT);
    }

    const fallbackToOcean = () => {
      clearTimeout(readyTimer);
      if (state.skin === 'ocean') return;
      state.skin = 'ocean';
      syncSkinUi();
      void save({ skin: 'ocean' });
      applySkin();
    };

    // 皮肤表面：同一时刻只显示一个 iframe，另一个缩成 1x1 省 GPU
    function applySkin() {
      if (!state.enabled) return;
      ensureGlassStyle();
      const skin = skinById(state.skin);
      if (skin.surface === 'ocean') {
        mountOceanFrame();
        setFrameActive(IDS.frame, true);
        postToOcean();
        if (document.getElementById(IDS.cosmos)) {
          postToFrame(IDS.cosmos, { type: 'bs-pause', paused: true });
          setFrameActive(IDS.cosmos, false);
        }
      } else {
        mountCosmosFrame();
        setFrameActive(IDS.cosmos, true);
        postToFrame(IDS.cosmos, { type: 'bs-skin', skin: skin.id, params: { ...state.p[skin.id] } });
        postToCosmos();
        postToFrame(IDS.cosmos, { type: 'bs-pause', paused: false });
        if (document.getElementById(IDS.frame)) setFrameActive(IDS.frame, false);
      }
      syncSkinUi();
    }

    let syncSkinUi = () => {};

    const switchSkin = (id) => {
      if (!SKINS.some((skin) => skin.id === id) || id === state.skin) return;
      state.skin = id;
      void save({ skin: id });
      applySkin();
    };

    const mountUi = () => {
      if (document.getElementById(IDS.button)) return;
      const style = document.createElement('style');
      style.id = IDS.uiStyle;
      style.textContent = uiCss();
      (document.head || document.documentElement).appendChild(style);

      const button = document.createElement('button');
      button.id = IDS.button;
      button.type = 'button';
      button.title = copy.button;
      button.setAttribute('aria-label', copy.button);
      button.setAttribute('aria-controls', IDS.panel);
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = WAVE_ICON;

      const panel = document.createElement('div');
      panel.id = IDS.panel;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-label', copy.button);

      const skinRows = (skin) => skin.params.map((param) => `
        <div class="bs-row">
          <div class="bs-head"><label for="${paramDomId(skin, param)}-range">${paramLabel(copy, skin, param)}</label><output class="bs-value" id="${paramDomId(skin, param)}" for="${paramDomId(skin, param)}-range"></output></div>
          <input type="range" id="${paramDomId(skin, param)}-range" min="${param.min}" max="${param.max}" step="1" />
        </div>`).join('');

      panel.innerHTML = `
        <div class="bs-title"><span>BACKSPACE <span class="bs-mark">·</span> SKIN</span><button class="bs-close" type="button" aria-label="${copy.close}">×</button></div>
        <div class="bs-tabs" role="tablist" aria-label="${copy.skinTitle}">${SKINS.map((skin) => `<button class="bs-tab" type="button" role="tab" data-skin="${skin.id}" aria-selected="${skin.id === state.skin}" aria-controls="${IDS.panel}-${skin.id}">${copy.skins[skin.id]}</button>`).join('')}</div>
        <div class="bs-scroll">${SKINS.map((skin) => `
          <section class="bs-skin-group" id="${IDS.panel}-${skin.id}" role="tabpanel" aria-label="${copy.skins[skin.id]}"${skin.id === state.skin ? '' : ' hidden'}>
            <div class="bs-group-title">${copy.skins[skin.id]} · ${copy.ownTitle}</div>${skinRows(skin)}
          </section>`).join('')}
          <section class="bs-group">
            <div class="bs-group-title">${copy.commonTitle}</div>
            <div class="bs-row"><div class="bs-head"><label for="${IDS.panel}-glass-range">${copy.glass}</label><output class="bs-value" id="${IDS.panel}-glass" for="${IDS.panel}-glass-range"></output></div><input type="range" id="${IDS.panel}-glass-range" min="40" max="90" step="1" /></div>
            <div class="bs-row bs-switch"><label for="${IDS.panel}-cycle">${copy.autoCycle}</label><input type="checkbox" id="${IDS.panel}-cycle" /></div>
            <div class="bs-row bs-switch"><label for="${IDS.panel}-chat">${copy.chatCustom}</label><input type="checkbox" id="${IDS.panel}-chat" /></div>
            <div class="bs-row bs-sub" id="${IDS.panel}-chat-row"><div class="bs-head"><label for="${IDS.panel}-chat-range">${copy.chatOpacity}</label><output class="bs-value" id="${IDS.panel}-chat-value" for="${IDS.panel}-chat-range"></output></div><input type="range" id="${IDS.panel}-chat-range" min="${CHAT_OPACITY_MIN}" max="${CHAT_OPACITY_MAX}" step="1" /></div>
            <div class="bs-row bs-switch"><label for="${IDS.panel}-enabled">${copy.enable}</label><input type="checkbox" id="${IDS.panel}-enabled" /></div>
          </section>
          <div class="bs-row"><button type="button" class="bs-reset">${copy.reset}</button></div>
          <p class="bs-note">${copy.resetNote()}<br>${copy.note}</p>
        </div>`;

      const host = document.body || document.documentElement;
      host.append(button, panel);

      const glassRange = panel.querySelector(`#${IDS.panel}-glass-range`);
      const glassOut = panel.querySelector(`#${IDS.panel}-glass`);
      const enabledBox = panel.querySelector(`#${IDS.panel}-enabled`);
      const cycleBox = panel.querySelector(`#${IDS.panel}-cycle`);
      const chatBox = panel.querySelector(`#${IDS.panel}-chat`);
      const chatRow = panel.querySelector(`#${IDS.panel}-chat-row`);
      const chatRange = panel.querySelector(`#${IDS.panel}-chat-range`);
      const chatOut = panel.querySelector(`#${IDS.panel}-chat-value`);
      const resetBtn = panel.querySelector('.bs-reset');
      const tabs = [...panel.querySelectorAll('.bs-tab')];

      const paramInputs = [];
      for (const skin of SKINS) {
        for (const param of skin.params) {
          paramInputs.push({
            skin,
            param,
            input: panel.querySelector(`#${paramDomId(skin, param)}-range`),
            out: panel.querySelector(`#${paramDomId(skin, param)}`),
          });
        }
      }

      const paramValue = (skin, param) => (skin.surface === 'ocean' ? state[param.key] : state.p[skin.id][param.key]);

      const syncParams = () => {
        for (const { skin, param, input, out } of paramInputs) {
          const value = paramValue(skin, param);
          input.value = String(value);
          out.textContent = paramText(copy, param, value);
        }
      };

      const syncUi = () => {
        glassRange.value = String(state.glass);
        glassOut.textContent = `${state.glass}%`;
        enabledBox.checked = state.enabled;
        cycleBox.checked = state.autoCycle;
        chatBox.checked = state.chatCustom;
        chatRange.value = String(state.chatOpacity);
        chatOut.textContent = `${state.chatOpacity}%`;
        // The slider belongs to the switch: hide it while the conversation
        // follows the workspace glass so the panel keeps one obvious meaning.
        chatRow.hidden = !state.chatCustom;
        syncParams();
      };
      syncUi();

      // 切换皮肤只切面板可见块与 iframe，不重建 DOM、不丢焦点
      syncSkinUi = () => {
        for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.skin === state.skin));
        for (const skin of SKINS) {
          const group = panel.querySelector(`#${IDS.panel}-${skin.id}`);
          if (group) group.hidden = skin.id !== state.skin;
        }
        syncParams();
      };
      syncSkinUi();

      // Harness may set lang after boot. Update only our own UI, in both
      // directions, without replacing controls or losing focus/listeners.
      const syncLocale = () => {
        copy = selectCopy(options.locale);
        button.title = copy.button;
        button.setAttribute('aria-label', copy.button);
        panel.setAttribute('aria-label', copy.button);
        panel.querySelector('.bs-close').setAttribute('aria-label', copy.close);
        panel.querySelector('.bs-tabs').setAttribute('aria-label', copy.skinTitle);
        for (const tab of tabs) tab.textContent = copy.skins[tab.dataset.skin];
        for (const { skin, param, out } of paramInputs) {
          panel.querySelector(`label[for="${paramDomId(skin, param)}-range"]`).textContent = paramLabel(copy, skin, param);
          out.textContent = paramText(copy, param, paramValue(skin, param));
        }
        for (const [suffix, key] of [['glass-range', 'glass'], ['enabled', 'enable'], ['cycle', 'autoCycle'], ['chat', 'chatCustom'], ['chat-range', 'chatOpacity']]) {
          panel.querySelector(`label[for="${IDS.panel}-${suffix}"]`).textContent = copy[key];
        }
        for (const group of panel.querySelectorAll('.bs-group-title')) {
          if (group.parentElement?.classList.contains('bs-skin-group')) {
            const id = group.parentElement.id.slice(`${IDS.panel}-`.length);
            group.textContent = `${copy.skins[id]} · ${copy.ownTitle}`;
          } else group.textContent = copy.commonTitle;
        }
        resetBtn.textContent = copy.reset;
        panel.querySelector('.bs-note').replaceChildren(copy.resetNote(), document.createElement('br'), copy.note);
      };
      syncLocale();
      const localeObserver = new MutationObserver(syncLocale);
      localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      surfaceCleanups.push(() => localeObserver.disconnect());

      for (const { skin, param, input, out } of paramInputs) {
        on(input, 'input', () => {
          const value = clamp(input.value, param.min, param.max, param.def);
          if (skin.surface === 'ocean') {
            state[param.key] = value;
            const patch = { [param.key]: value };
            if (param.stopsCycle) {
              state.autoCycle = false;
              cycleBox.checked = false;
              patch.autoCycle = false;
            }
            void save(patch);
            postToOcean();
          } else {
            state.p[skin.id][param.key] = value;
            void save({ p: state.p });
            postToCosmos();
          }
          out.textContent = paramText(copy, param, value);
        });
      }

      for (const tab of tabs) on(tab, 'click', () => switchSkin(tab.dataset.skin));

      on(glassRange, 'input', () => {
        state.glass = clamp(glassRange.value, 40, 90, DEFAULTS.glass);
        glassOut.textContent = `${state.glass}%`;
        updateGlass();
        void save({ glass: state.glass });
      });

      on(enabledBox, 'change', () => {
        state.enabled = enabledBox.checked;
        void save({ enabled: state.enabled });
        // Only tear down the surfaces, never the button/panel: otherwise
        // a disabled skin has no settings entry left to re-enable it.
        applyEnabled();
      });
      on(cycleBox, 'change', () => {
        state.autoCycle = cycleBox.checked;
        void save({ autoCycle: state.autoCycle });
        postToOcean();
        postToCosmos();
      });
      on(chatBox, 'change', () => {
        state.chatCustom = chatBox.checked;
        chatRow.hidden = !state.chatCustom;
        void save({ chatCustom: state.chatCustom });
        updateGlass();
      });
      on(chatRange, 'input', () => {
        state.chatOpacity = clamp(chatRange.value, CHAT_OPACITY_MIN, CHAT_OPACITY_MAX, DEFAULTS.chatOpacity);
        chatOut.textContent = `${state.chatOpacity}%`;
        void save({ chatOpacity: state.chatOpacity });
        updateGlass();
      });
      on(resetBtn, 'click', () => {
        const defaults = {
          enabled: DEFAULTS.enabled,
          sea: DEFAULTS.sea,
          time: DEFAULTS.time,
          glass: DEFAULTS.glass,
          autoCycle: DEFAULTS.autoCycle,
          chatCustom: DEFAULTS.chatCustom,
          chatOpacity: DEFAULTS.chatOpacity,
          p: normalizeParams({}),
        };
        void save(defaults).then(() => {
          syncUi();
          syncSkinUi();
          updateGlass();
          postToOcean();
          postToCosmos();
          applyEnabled();
        });
      });

      on(button, 'click', () => setPanelOpen(!panelOpen));
      on(panel.querySelector('.bs-close'), 'click', () => setPanelOpen(false));
      on(document, 'click', (event) => {
        if (panelOpen && !panel.contains(event.target) && !button.contains(event.target)) setPanelOpen(false);
      });
      on(document, 'keydown', (event) => {
        if (!panelOpen) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          setPanelOpen(false);
          return;
        }
        if (event.key !== 'Tab') return;
        // 只看可见的控件：三张皮肤的配置行里有隐藏块与折叠的对话面板滑块
        const focusable = [...panel.querySelectorAll('button, input')]
          .filter((element) => !element.disabled && element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      on(window, 'resize', () => { if (!panelOpen) schedulePlace(); });

      // 宇宙 iframe 的握手 + 回退：ready 前失败一律回海面
      on(window, 'message', (event) => {
        const frame = document.getElementById(IDS.cosmos);
        if (!(frame instanceof HTMLIFrameElement) || event.source !== frame.contentWindow) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'bs-cosmos-ready') {
          clearTimeout(readyTimer);
        } else if (data.type === 'bs-cosmos-error') {
          console.warn('[Backspace] Cosmic skin unavailable:', data.reason);
          fallbackToOcean();
        }
      });

      // 鼠标/点击：iframe 是 pointer-events:none 且 aria-hidden，收不到事件，
      // 所以一律在父页监听再经 postMessage 转发进宇宙 iframe（海面皮肤不需要）。
      const pointerPayload = (event) => [
        (event.clientX / window.innerWidth) * 2 - 1,
        1 - (event.clientY / window.innerHeight) * 2,
      ];
      on(document, 'pointermove', (event) => {
        if (!state.enabled || skinById(state.skin).surface !== 'cosmos') return;
        pointerPending = pointerPayload(event);
        if (pointerFrame) return;
        pointerFrame = requestAnimationFrame(() => {
          pointerFrame = 0;
          if (!pointerPending) return;
          postToFrame(IDS.cosmos, { type: 'bs-pointer', x: pointerPending[0], y: pointerPending[1] });
        });
      }, { passive: true });
      on(document, 'pointerdown', (event) => {
        if (!state.enabled || skinById(state.skin).surface !== 'cosmos') return;
        if (panel.contains(event.target) || button.contains(event.target)) return;
        const [x, y] = pointerPayload(event);
        postToFrame(IDS.cosmos, { type: 'bs-pulse', x, y });
      }, { passive: true });

      placementObserver = new MutationObserver(schedulePlace);
      placementObserver.observe(host, { childList: true, subtree: true });
      schedulePlace();
    };

    const unmount = () => {
      panelOpen = false;
      placementObserver?.disconnect();
      placementObserver = null;
      cancelAnimationFrame(placementFrame);
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      clearTimeout(readyTimer);
      while (surfaceCleanups.length > 0) surfaceCleanups.pop()();
      if (ownsSurface) {
        document.getElementById(IDS.frame)?.remove();
        document.getElementById(IDS.cosmos)?.remove();
        document.getElementById(IDS.glass)?.remove();
      }
      document.getElementById(IDS.button)?.remove();
      document.getElementById(IDS.panel)?.remove();
      document.getElementById(IDS.uiStyle)?.remove();
      ownsSurface = false;
    };

    const applyEnabled = () => {
      // The button/panel are the only way back in: mount the UI entry
      // regardless of enabled state, so a skin that starts disabled (or on a
      // host page that saved disabled) still offers the enable switch
      // (2026-08-23: previously the button was created only on first enable,
      // leaving a disabled-after-reload skin with no entry point at all).
      if (!document.getElementById(IDS.button)) mountUi();
      if (!state.enabled) {
        // Tear down only the surfaces (frames + glass), keeping the
        // button/panel so the skin can be re-enabled from the same page.
        clearTimeout(readyTimer);
        if (ownsSurface) {
          document.getElementById(IDS.frame)?.remove();
          document.getElementById(IDS.cosmos)?.remove();
          document.getElementById(IDS.glass)?.remove();
          ownsSurface = false;
        }
        return;
      }
      // The extension and both native paths intentionally share the same ids.
      // Both surface helpers are idempotent: whichever implementation mounted
      // first owns the frame, so a second controller neither double-renders nor
      // replaces it — it only re-sends its own settings.
      applySkin();
    };

    const ready = () => new Promise((resolve) => {
      if (document.body) { resolve(); return; }
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });

    const start = async () => {
      await ready();
      try {
        state = normalize(await options.storage.get(DEFAULTS));
      } catch (error) {
        console.warn('[Backspace] Failed to load settings; using defaults.', error);
      }
      applyEnabled();
      if (typeof options.listen === 'function') {
        const dispose = options.listen((patch) => {
          state = normalize({ ...state, ...patch });
          applyEnabled();
          updateGlass();
          postToOcean();
          postToCosmos();
          syncSkinUi();
        });
        if (typeof dispose === 'function') controllerCleanups.push(dispose);
      }
    };

    const stop = () => {
      unmount();
      while (controllerCleanups.length > 0) controllerCleanups.pop()();
    };

    return Object.freeze({
      start,
      stop,
      getState: () => ({ ...state, p: normalizeParams(state.p) }),
      setSkin: (id) => switchSkin(id),
    });
  }

  global.BackspaceSkinCore = Object.freeze({ createController, DEFAULTS, IDS, SKINS });
})(globalThis);

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
