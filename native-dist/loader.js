// GENERATED from shared/skin-core.js. Run npm run build after editing shared sources.
// Backspace shared host-page controller.
//
// This file intentionally has no import/export statements: the release build
// concatenates it with either the Chrome storage adapter or the localStorage
// adapter, so both installation paths run the same DOM, glass and a11y code.
//
// 三皮肤架构（2026-10）：海面（ocean，Walegpu 渲染器）+ 事件视界（horizon）+
// 吸积涡旋（vortex）。海面沿用 state.sea / state.time，宇宙视角分别保存于
// state.p.views；旧 state.p.cosmos / horizon / vortex 记录保留用于迁移，
// 整体序列化成一条 JSON 由三条安装入口各自持久化。通用配置按皮肤保存于
// state.p.general，顶层值保留当前皮肤的投影；只有总开关全局生效。
(function registerBackspaceSkinCore(global) {
  'use strict';

  const IDS = Object.freeze({
    frame: '__dsh-backspace__',
    cosmos: '__dsh-backspace-cosmos__',
    video: '__dsh-backspace-video__',
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
  // 与渲染器 SCENE_PROPS 保持一致；构建后的控制器是无 import 的宿主脚本。
  const COSMOS_PARAMS = Object.freeze([
    Object.freeze({ key: 'glow', min: 0, max: 100, def: 70 }),
    Object.freeze({ key: 'ring', min: 0, max: 100, def: 55 }),
    Object.freeze({ key: 'turb', min: 0, max: 100, def: 55 }),
    Object.freeze({ key: 'warm', min: 0, max: 100, def: 60 }),
    Object.freeze({ key: 'spin', min: 0, max: 100, def: 50 }),
    Object.freeze({ key: 'stars', min: 0, max: 100, def: 45 }),
    Object.freeze({ key: 'parallax', min: 0, max: 100, def: 55 }),
    Object.freeze({ key: 'pulse', min: 0, max: 100, def: 70 }),
  ]);
  const SKINS = Object.freeze([
    Object.freeze({
      id: 'ocean', surface: 'ocean',
      params: Object.freeze([
        Object.freeze({ key: 'sea', min: 0, max: 100, def: 50 }),
        Object.freeze({ key: 'time', min: 0, max: 100, def: 55, format: 'time', stopsCycle: true }),
      ]),
    }),
    Object.freeze({ id: 'horizon', surface: 'cosmos', params: COSMOS_PARAMS }),
    Object.freeze({ id: 'vortex', surface: 'cosmos', params: COSMOS_PARAMS }),
    Object.freeze({ id: 'video', surface: 'video', params: Object.freeze([]) }),
  ]);
  const PARAM_GROUPS = [SKINS[0], { id: 'cosmos', surface: 'cosmos', params: COSMOS_PARAMS }];
  const SKIN_TABS = [SKINS[1], SKINS[2], SKINS[0], SKINS[3]];

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
      button: 'Zed Space Skin 皮肤设置',
      close: '关闭',
      sea: '波浪大小',
      time: '日光',
      glass: '玻璃不透明度',
      enable: '启用 Zed Space Skin 皮肤',
      autoCycle: '自动昼夜变化',
      cosmicCycle: '自动光影变化',
      chatCustom: '对话面板独立调整',
      chatOpacity: '对话面板不透明度',
      reset: '恢复默认',
      resetConfirm: '确认恢复',
      cancel: '取消',
      resetTitle: (skin) => `恢复「${skin}」的默认配置？`,
      resetNote: '恢复当前皮肤的效果参数与通用配置。其他皮肤和总开关保持不变。',
      helpLabel: '说明',
      saveHint: '即时生效 · 自动保存',
      help: {
        skinTitle: '可控制完全开/关 Zed Space Skin',
        sea: '调整海面波浪的大小。海面参数独立保存，不影响宇宙皮肤。',
        time: '调整海面的日光。手动调节会停止自动昼夜变化，可通过下方开关重新开启。',
        glow: '调整吸积盘的发光亮度，仅影响当前皮肤。',
        ring: '调整吸积盘的尺度，仅影响当前皮肤。',
        turb: '调整气流纹理的细节，仅影响当前皮肤。',
        warm: '调整气体的冷暖色温，仅影响当前皮肤。',
        spin: '调整宇宙气流的流动速度，仅影响当前皮肤。',
        stars: '调整背景星空的浓度，仅影响当前皮肤。',
        parallax: '移动鼠标时产生视差与引力效果，数值越大，响应越明显。',
        pulse: '点击背景时产生涟漪脉冲。仅影响当前皮肤。',
        glass: '调整工作区的玻璃不透明度。左右侧栏始终使用此设置；对话区仅在关闭独立背景时跟随。',
        autoCycle: '循环变化海面的日光。手动调整「日光」会关闭此开关；不影响宇宙皮肤的光影变化。',
        cosmicCycle: '让宇宙背景的亮度缓慢起伏。仅影响当前皮肤，与海面昼夜独立。',
        chatCustom: '开启后，可单独调整中间对话区的背景浓度；关闭后，对话区跟随「玻璃不透明度」。左右侧栏不受此开关影响。',
        chatOpacity: '单独调整中间对话区的背景浓度。100% 为 Harness 原生背景。',
      },
      times: ['黄昏', '金色时刻', '下午', '正午'],
      skinTitle: '皮肤',
      ownTitle: '独立配置',
      commonTitle: '通用配置',
      skins: { ocean: '海面', horizon: '事件视界', vortex: '吸积涡旋', video: '本地视频' },
      videoTitle: '我的视频', videoImport: '导入视频', videoHelp: '可多选导入，每次勾选启用一个。',
      videoEmpty: '导入自己的视频作为背景', videoLimits: 'MP4 / WebM · 每个最长 30 秒 · 最高 1080p · 最大 32 MB',
      videoLocal: '仅在本机保存，不上传。', videoLoading: '正在读取视频…', videoIdle: '尚未启用，勾选缩略图即可播放。',
      videoActive: '正在使用：', videoSelected: '已选择：', videoChosen: '已选择', videoPlaying: '启用中', videoEnable: '启用', videoRename: '重命名', videoRemove: '移除',
      videoErrors: {
        empty: '文件为空，请重新导出视频。', size: '每个视频不能超过 32 MB，请压缩后再导入。',
        format: '请导出为 MP4 或 WebM 视频后重试。', codec: '请使用 H.264、VP9 或 AV1 编码，建议导出为 H.264 MP4。',
        'no-video': '文件没有有效视频轨，请选择带画面的视频。', duration: '视频时长须在 0–30 秒之间，请裁剪后重试。',
        resolution: '分辨率不能超过 1920×1080（支持竖屏），请缩小后重试。',
        timeout: '读取视频超时，请重新导出完整视频后重试。', decode: '视频无法解码，请导出为 H.264 MP4 后重试。',
        playback: '播放被浏览器阻止，已回退海面。请允许自动播放后重新启用。',
        storage: '本地存储不可用或空间不足，请移除不用的视频或检查浏览器存储权限。',
        missing: '本机找不到这个视频，已回退海面，请重新导入。',
        load: '视频模块没有响应，请切换到其他皮肤后重新打开本地视频。',
        name: '名称须为 1–80 个字符。', request: '操作未完成，请重新打开本地视频后再试。',
      },
      params: {
        sea: '波浪大小', time: '日光',
        glow: '吸积亮度', ring: '盘体尺度', turb: '气流细节', warm: '气体色温',
        spin: '流动速度', stars: '星空浓度', parallax: '鼠标视差', pulse: '点击涟漪',
      },
    },
    en: {
      button: 'Zed Space Skin settings',
      close: 'Close',
      sea: 'Sea state',
      time: 'Daylight',
      glass: 'Glass opacity',
      enable: 'Enable Zed Space Skin',
      autoCycle: 'Automatic day cycle',
      cosmicCycle: 'Automatic light variation',
      chatCustom: 'Independent conversation settings',
      chatOpacity: 'Conversation opacity',
      reset: 'Reset to defaults',
      resetConfirm: 'Restore',
      cancel: 'Cancel',
      resetTitle: (skin) => `Restore ${skin} defaults?`,
      resetNote: 'Restore this skin’s effects and general settings. Other skins and the main switch stay unchanged.',
      helpLabel: 'Help',
      saveHint: 'Applies instantly · Saves automatically',
      help: {
        skinTitle: 'Turn Zed Space Skin completely on or off.',
        sea: 'Adjust the size of the ocean waves. Ocean settings are saved separately from the cosmic skins.',
        time: 'Adjust ocean daylight. Manual changes stop the automatic day cycle; use the switch below to turn it back on.',
        glow: 'Adjust the brightness of the accretion disk. Only affects this skin.',
        ring: 'Adjust the size of the accretion disk. Only affects this skin.',
        turb: 'Adjust the detail in the gas flow. Only affects this skin.',
        warm: 'Adjust the gas from cool to warm colors. Only affects this skin.',
        spin: 'Adjust the speed of the cosmic flow. Only affects this skin.',
        stars: 'Adjust the density of the background stars. Only affects this skin.',
        parallax: 'Pointer movement creates parallax and gravity effects. Higher values make the response stronger.',
        pulse: 'Click the background to create a ripple pulse. Only affects this skin.',
        glass: 'Adjust workspace glass opacity. Sidebars always use this setting; the conversation follows it when its independent background is off.',
        autoCycle: 'Cycle ocean daylight automatically. Adjusting daylight manually turns this off. Cosmic light variation is unaffected.',
        cosmicCycle: 'Slowly vary the cosmic background brightness. Only affects this skin, independently of the ocean day cycle.',
        chatCustom: 'Set the center conversation background independently. When off, the conversation follows glass opacity. Sidebars are unaffected.',
        chatOpacity: 'Adjust the center conversation background opacity. At 100%, it matches the native Harness background.',
      },
      times: ['Dusk', 'Golden hour', 'Afternoon', 'Midday'],
      skinTitle: 'Skin',
      ownTitle: 'Skin settings',
      commonTitle: 'General settings',
      skins: { ocean: 'Ocean', horizon: 'Event Horizon', vortex: 'Accretion Vortex', video: 'Local video' },
      videoTitle: 'My videos', videoImport: 'Import videos', videoHelp: 'Import multiple videos; enable one at a time.',
      videoEmpty: 'Use your own video as the background', videoLimits: 'MP4 / WebM · Up to 30 seconds, 1080p and 32 MB each',
      videoLocal: 'Stored only on this device. Never uploaded.', videoLoading: 'Reading video…', videoIdle: 'Select a thumbnail to start playback.',
      videoActive: 'Playing: ', videoSelected: 'Selected: ', videoChosen: 'Selected', videoPlaying: 'Active', videoEnable: 'Enable', videoRename: 'Rename', videoRemove: 'Remove',
      videoErrors: {
        empty: 'This file is empty. Export the video again.', size: 'Each video must be under 32 MB. Compress it and retry.',
        format: 'Export this file as an MP4 or WebM video.', codec: 'Use H.264, VP9 or AV1 encoding. H.264 MP4 is recommended.',
        'no-video': 'No valid video track was found. Choose a file with video.', duration: 'Videos must be 0–30 seconds long. Trim the clip and retry.',
        resolution: 'Maximum resolution is 1920×1080, including portrait. Resize the video and retry.',
        timeout: 'Reading the video timed out. Export a complete video and retry.', decode: 'This video cannot be decoded. Export it as H.264 MP4.',
        playback: 'Autoplay was blocked. Ocean is shown instead. Allow autoplay, then enable the clip again.',
        storage: 'Local storage is unavailable or full. Remove unused clips or check browser storage permissions.',
        missing: 'This video is missing on this device. Ocean is shown instead. Import it again.',
        load: 'The video module did not respond. Switch to another skin, then reopen Local video.',
        name: 'Names must contain 1–80 characters.', request: 'The operation failed. Reopen Local video and retry.',
      },
      params: {
        sea: 'Sea state', time: 'Daylight',
        glow: 'Accretion brightness', ring: 'Disk size', turb: 'Flow detail', warm: 'Gas temperature',
        spin: 'Flow speed', stars: 'Star density', parallax: 'Pointer parallax', pulse: 'Click ripple',
      },
    },
  });

  const BLACK_HOLE_ICON = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(-25 12 12)" stroke="currentColor" stroke-width="1.4"/>
  <circle cx="12" cy="12" r="5" fill="#091114" stroke="currentColor" stroke-width="1.5"/>
  <path d="M3.1 16.2c2.5.8 6.1.1 10.1-1.8s7.2-4.3 7.8-6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

  const HELP_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.75" stroke="currentColor" stroke-width="1.25"/><path d="M8 7.2v3.4M8 5.2v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const CLOSE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  const SURFACE_READY_TIMEOUT = 8000;

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);

  function normalizeParams(raw, activeSkin = 'horizon', legacyAutoCycle = true) {
    const source = isRecord(raw) ? raw : {};
    const out = {};
    for (const id of ['horizon', 'vortex']) {
      if (isRecord(source[id])) out[id] = { ...source[id] };
    }
    let given = source.cosmos;
    if (!isRecord(given)) {
      const legacyId = activeSkin === 'vortex' ? 'vortex'
        : activeSkin === 'horizon' || isRecord(source.horizon) ? 'horizon' : 'vortex';
      const legacy = isRecord(source[legacyId]) ? source[legacyId] : {};
      given = legacyId === 'vortex' ? { ...legacy } : {
        glow: legacy.glow, stars: legacy.stars,
        turb: clamp(legacy.curl, 0, 100, 50) + 5,
        spin: (0.025 + 0.0013 * clamp(legacy.drift, 0, 100, 30)) / 0.064 * 50,
        parallax: legacy.pull,
      };
      // 旧色相与新色温不等价，保留旧记录；共享色温从默认值开始，速度按新范围夹紧。
    }
    out.cosmos = {};
    for (const param of COSMOS_PARAMS) {
      out.cosmos[param.key] = clamp(given[param.key], param.min, param.max, param.def);
    }
    out.views = {};
    for (const id of ['horizon', 'vortex']) {
      const profile = isRecord(source.views?.[id]) ? source.views[id] : {};
      const params = {};
      for (const param of COSMOS_PARAMS) {
        params[param.key] = clamp(profile.params?.[param.key], param.min, param.max, out.cosmos[param.key]);
      }
      out.views[id] = { params, autoCycle: typeof profile.autoCycle === 'boolean' ? profile.autoCycle : legacyAutoCycle !== false };
    }
    return out;
  }

  const GENERAL_KEYS = ['glass', 'chatCustom', 'chatOpacity'];
  const normalizeGeneral = (raw) => ({
    glass: clamp(raw.glass, 40, 90, DEFAULTS.glass),
    chatCustom: raw.chatCustom === true,
    chatOpacity: clamp(raw.chatOpacity, CHAT_OPACITY_MIN, CHAT_OPACITY_MAX, DEFAULTS.chatOpacity),
  });

  function normalize(raw) {
    const skin = SKINS.some((skin) => skin.id === raw.skin) ? raw.skin : DEFAULTS.skin;
    const p = normalizeParams(raw.p, raw.skin, raw.autoCycle);
    const legacy = normalizeGeneral(raw);
    p.general = {};
    for (const { id } of SKINS) {
      const profile = raw.p?.general?.[id];
      p.general[id] = normalizeGeneral({ ...legacy, ...(isRecord(profile) ? profile : {}) });
    }
    return {
      enabled: raw.enabled !== false,
      skin,
      sea: clamp(raw.sea, 0, 100, DEFAULTS.sea),
      time: clamp(raw.time, 0, 100, DEFAULTS.time),
      autoCycle: raw.autoCycle !== false,
      ...p.general[skin],
      p,
    };
  }

  function selectCopy(locale) {
    const requested = locale || document.documentElement.lang || navigator.language || 'en';
    return requested.toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
  }

  // 参数文案先查「皮肤.参数」，再回落裸 key：同一个 key 在不同皮肤里可以是不同的东西
  // 宇宙两个视角使用同一组标签与控件。
  // 海面参数沿用 1.2.6 的 DOM id（`-sea-range`），验收脚本按它取元素；
  // 新增皮肤一律加 id 前缀，否则不同皮肤的同名 key 会撞同一个 id。
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
#${IDS.button}, #${IDS.panel}, #${IDS.panel}-help {
  --bs-surface:#f9fbfc; --bs-inset:#edf2f4; --bs-text:#23353c; --bs-muted:#586b74;
  --bs-line:#d7e0e4; --bs-accent:#126e69; --bs-selected:#dcefeb; --bs-track:#bfccd2;
  color:var(--bs-text); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  box-sizing:border-box; color-scheme:light;
}
body[data-ds-dark-theme] #${IDS.button}, body[data-ds-dark-theme] #${IDS.panel}, body[data-ds-dark-theme] #${IDS.panel}-help {
  --bs-surface:#171f26; --bs-inset:#222d35; --bs-text:#e4edf0; --bs-muted:#a2b3bd;
  --bs-line:#35444e; --bs-accent:#8fe9e4; --bs-selected:#294644; --bs-track:#536671;
  color-scheme:dark;
}
#${IDS.button} {
  position:fixed; z-index:6000; width:38px; height:38px; padding:0;
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  border-radius:11px; border:1px solid var(--bs-line); background:var(--bs-surface);
  color:var(--bs-muted); box-shadow:0 2px 6px rgba(9,22,30,.08);
  transition:color .16s ease, border-color .16s ease, background .16s ease;
}
#${IDS.button}:hover, #${IDS.button}.active { color:var(--bs-accent); border-color:var(--bs-accent); background:var(--bs-selected); }
#${IDS.button}:active { background:var(--bs-inset); }
#${IDS.button} > svg { transition:transform .24s cubic-bezier(.16,1,.3,1); }
#${IDS.button}:hover > svg, #${IDS.button}.active > svg { transform:rotate(18deg) scale(1.08); }
#${IDS.button} .bs-launcher-tip { position:absolute; bottom:calc(100% + 8px); left:0; width:max-content; padding:7px 10px; border:1px solid var(--bs-line); border-radius:8px; background:var(--bs-surface); color:var(--bs-text); font-size:12px; line-height:1.5; box-shadow:0 4px 16px rgba(9,22,30,.14); pointer-events:none; visibility:hidden; }
#${IDS.button}:is(:hover,:focus-visible):not(.active) .bs-launcher-tip { visibility:visible; }
#${IDS.button}:focus-visible, #${IDS.panel} button:focus-visible, #${IDS.panel} input:focus-visible { outline:2px solid var(--bs-accent); outline-offset:3px; }
#${IDS.panel} {
  position:fixed; z-index:6001; width:360px; max-width:calc(100vw - 24px); padding:20px;
  border-radius:18px; border:1px solid var(--bs-line); background:var(--bs-surface) !important;
  box-shadow:0 16px 48px rgba(9,22,30,.2), 0 3px 10px rgba(9,22,30,.08);
  display:none; flex-direction:column; max-height:calc(100dvh - 24px); font-size:13px; line-height:1.5;
}
#${IDS.panel} * { box-sizing:border-box; }
#${IDS.panel} button, #${IDS.panel} input { font:inherit; }
#${IDS.panel}.open { display:flex; }
#${IDS.panel} ::selection { background:var(--bs-selected); color:var(--bs-text); }
#${IDS.panel} .bs-title { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex:0 0 auto; }
#${IDS.panel} .bs-brand { display:flex; align-items:center; gap:9px; font-size:18px; font-weight:600; letter-spacing:-.02em; }
#${IDS.panel} .bs-brand svg { color:var(--bs-accent); }
#${IDS.panel} .bs-close { display:grid; place-items:center; width:30px; height:30px; padding:0; border:0; border-radius:8px; background:transparent; color:var(--bs-muted); cursor:pointer; }
#${IDS.panel} .bs-close:hover { color:var(--bs-text); background:var(--bs-inset); }
#${IDS.panel} .bs-switch.bs-skin-heading { display:flex; align-items:center; justify-content:flex-start; gap:6px; margin:0 0 7px; min-height:24px; font-weight:500; }
#${IDS.panel} .bs-tabs { position:relative; isolation:isolate; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:4px; padding:4px; border-radius:11px; background:var(--bs-inset); flex:0 0 auto; }
#${IDS.panel} .bs-tabs::before { content:''; box-sizing:border-box; position:absolute; z-index:-1; top:4px; bottom:4px; left:4px; width:calc((100% - 20px) / 4); border:1px solid var(--bs-line); border-radius:8px; background:var(--bs-surface); box-shadow:0 2px 5px rgba(9,22,30,.08); transform:translateX(calc(var(--bs-tab-index, 0) * 100% + var(--bs-tab-index, 0) * 4px)); transition:transform .24s cubic-bezier(.16,1,.3,1); }
#${IDS.panel} .bs-tab {
  min-width:0; padding:8px 3px; border:1px solid transparent; border-radius:8px; cursor:pointer;
  background:transparent; color:var(--bs-muted); font-size:12px; line-height:1.35;
  transition:color .14s ease, transform .14s cubic-bezier(.16,1,.3,1);
}
#${IDS.panel} .bs-tab:hover { color:var(--bs-text); transform:translateY(-1px); }
#${IDS.panel} .bs-tab:active { transform:scale(.96); }
#${IDS.panel} .bs-tab[aria-selected='true'] { color:var(--bs-accent); font-weight:600; }
#${IDS.panel} .bs-scroll { flex:1 1 auto; overflow-y:auto; overflow-anchor:none; overscroll-behavior:contain; min-height:0; padding:0 4px 0 3px; margin:0 -4px 0 -3px; scrollbar-width:thin; scrollbar-color:var(--bs-track) transparent; }
#${IDS.panel} .bs-skin-region, #${IDS.panel} .bs-group { display:flow-root; }
#${IDS.panel} .bs-group-title { margin:16px 0 8px; color:var(--bs-muted); font-size:12px; font-weight:500; }
#${IDS.panel} .bs-skin-group[hidden], #${IDS.panel} .bs-sub[hidden], #${IDS.panel}-help[hidden] { display:none; }
#${IDS.panel} .bs-group { margin-top:16px; padding-top:16px; border-top:1px solid var(--bs-line); }
#${IDS.panel} .bs-group > .bs-group-title { margin:0 0 8px; }
#${IDS.panel} .bs-params { display:grid; gap:10px; align-items:end; }
#${IDS.panel} #${IDS.panel}-cosmos .bs-params { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 20px; }
#${IDS.panel} .bs-head { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:3px; }
#${IDS.panel} .bs-label { display:flex; align-items:center; gap:2px; min-width:0; }
#${IDS.panel} .bs-label label { cursor:pointer; }
#${IDS.panel} .bs-value { color:var(--bs-accent); font-size:12px; font-weight:500; font-variant-numeric:tabular-nums; white-space:nowrap; }
#${IDS.panel} input[type='range'] { appearance:none; display:block; width:100%; height:22px; margin:0; padding:0; background:transparent; cursor:pointer; --bs-fill:50%; }
#${IDS.panel} input[type='range']::-webkit-slider-runnable-track { height:4px; border-radius:4px; background:linear-gradient(to right,var(--bs-accent) var(--bs-fill),var(--bs-track) var(--bs-fill)); }
#${IDS.panel} input[type='range']::-webkit-slider-thumb { appearance:none; width:14px; height:14px; margin-top:-5px; border:2px solid var(--bs-surface); border-radius:50%; background:var(--bs-accent); box-shadow:0 1px 4px rgba(9,22,30,.25); }
#${IDS.panel} input[type='range']::-moz-range-track { height:4px; border-radius:4px; background:var(--bs-track); }
#${IDS.panel} input[type='range']::-moz-range-progress { height:4px; border-radius:4px; background:var(--bs-accent); }
#${IDS.panel} input[type='range']::-moz-range-thumb { width:12px; height:12px; border:2px solid var(--bs-surface); border-radius:50%; background:var(--bs-accent); }
#${IDS.panel} .bs-switch { display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:34px; margin-top:4px; }
#${IDS.panel} .bs-switch input[type='checkbox'] { appearance:none; position:relative; flex:0 0 32px; width:32px; height:20px; margin:0; border:1px solid var(--bs-track); border-radius:12px; background:var(--bs-track); cursor:pointer; transition:background .16s ease; }
#${IDS.panel} .bs-switch input[type='checkbox']::after { content:''; position:absolute; width:14px; height:14px; top:2px; left:2px; border-radius:50%; background:var(--bs-surface); box-shadow:0 1px 3px rgba(9,22,30,.18); transition:transform .16s ease; }
#${IDS.panel} .bs-switch input[type='checkbox']:checked { background:var(--bs-accent); border-color:var(--bs-accent); }
#${IDS.panel} .bs-switch input[type='checkbox']:checked::after { transform:translateX(12px); }
#${IDS.panel} .bs-sub { margin:2px 0 6px; padding:8px 12px; border-radius:9px; background:var(--bs-inset); }
#${IDS.panel} .bs-help { display:inline-grid; place-items:center; flex:0 0 24px; width:24px; height:24px; padding:0; border:0; border-radius:6px; background:transparent; color:var(--bs-muted); cursor:help; }
#${IDS.panel} .bs-help:hover, #${IDS.panel} .bs-help[aria-describedby] { color:var(--bs-accent); }
#${IDS.panel}-help { position:fixed; z-index:6002; width:280px; max-width:calc(100vw - 24px); border:1px solid var(--bs-line); border-radius:10px; background:var(--bs-surface) !important; color:var(--bs-text); box-shadow:0 8px 28px rgba(9,22,30,.2); font-size:12px; line-height:1.65; overflow-wrap:break-word; }
#${IDS.panel}-help > div { box-sizing:border-box; overflow-y:auto; padding:12px 14px; scrollbar-width:thin; scrollbar-color:var(--bs-track) transparent; }
#${IDS.panel}-help::after { content:''; position:absolute; left:0; right:0; top:100%; height:8px; }
#${IDS.panel} .bs-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:12px; margin-top:12px; border-top:1px solid var(--bs-line); flex:0 0 auto; }
#${IDS.panel} .bs-save-hint { color:var(--bs-muted); font-size:11px; }
#${IDS.panel} .bs-reset-wrap { display:flex; align-items:center; flex:0 0 auto; gap:1px; }
#${IDS.panel} .bs-reset { padding:6px 8px; border-radius:7px; border:1px solid transparent; background:transparent; color:var(--bs-text); font-size:12px; cursor:pointer; transition:background .16s ease; }
#${IDS.panel} .bs-reset:hover:not(:disabled) { border-color:var(--bs-line); background:var(--bs-inset); }
#${IDS.panel} .bs-reset:disabled { color:var(--bs-muted); opacity:.5; cursor:default; }
#${IDS.panel} .bs-reset-confirm { position:fixed; inset:auto; margin:0; width:280px; max-width:calc(100vw - 24px); padding:14px; border:1px solid var(--bs-line); border-radius:12px; background:var(--bs-surface) !important; color:var(--bs-text); box-shadow:0 8px 28px rgba(9,22,30,.2); font-size:12px; line-height:1.6; }
#${IDS.panel} .bs-reset-confirm strong { display:block; font-size:13px; font-weight:600; }
#${IDS.panel} .bs-confirm-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:12px; }
#${IDS.panel} .bs-confirm-actions button { padding:6px 10px; border:1px solid var(--bs-line); border-radius:7px; background:var(--bs-inset); color:var(--bs-text); cursor:pointer; }
#${IDS.panel} .bs-confirm-actions button:hover { border-color:var(--bs-accent); }
#${IDS.panel} .bs-confirm-actions .bs-confirm-restore { background:var(--bs-selected); color:var(--bs-accent); }
@media (max-width:380px) {
  #${IDS.panel} { padding:16px; }
  #${IDS.panel} .bs-footer { align-items:flex-start; }
  #${IDS.panel} #${IDS.panel}-cosmos .bs-params { grid-template-columns:1fr; }
}
#${IDS.panel} .bs-video-group[hidden], #${IDS.panel} .bs-video-group [hidden] { display:none !important; }
#${IDS.panel} .bs-video-group { padding-top:14px; }
#${IDS.panel} .bs-video-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
#${IDS.panel} .bs-video-title { font-size:14px; font-weight:500; }
#${IDS.panel} .bs-video-import { border:0; border-radius:8px; padding:8px 12px; background:var(--bs-accent); color:var(--bs-surface); cursor:pointer; font-size:12px; }
#${IDS.panel} .bs-video-import:disabled { opacity:.55; cursor:wait; }
#${IDS.panel} .bs-video-help, #${IDS.panel} .bs-video-status, #${IDS.panel} .bs-video-errors { font-size:12px; line-height:1.7; color:var(--bs-muted); margin:8px 0 12px; overflow-wrap:anywhere; }
#${IDS.panel} .bs-video-errors { color:#a4382d; white-space:pre-line; }
body[data-ds-dark-theme] #${IDS.panel} .bs-video-errors { color:#ffb4a7; }
#${IDS.panel} .bs-video-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 12px; max-height:310px; overflow-y:auto; padding:3px; scrollbar-width:thin; scrollbar-color:var(--bs-track) transparent; }
#${IDS.panel} .bs-video-tile { min-width:0; }
#${IDS.panel} .bs-video-thumb { position:relative; display:block; aspect-ratio:16/9; overflow:hidden; border-radius:8px; outline:1px solid var(--bs-line); background:var(--bs-inset); cursor:pointer; }
#${IDS.panel} .bs-video-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
#${IDS.panel} .bs-video-thumb input { position:absolute; top:8px; right:8px; width:17px; height:17px; margin:0; accent-color:var(--bs-accent); }
#${IDS.panel} .bs-video-thumb:focus-within, #${IDS.panel} .bs-video-tile[data-selected=true] .bs-video-thumb { outline:2px solid var(--bs-accent); outline-offset:1px; }
#${IDS.panel} .bs-video-playing, #${IDS.panel} .bs-video-duration { position:absolute; bottom:6px; padding:2px 5px; border-radius:4px; background:#12252de6; color:#fff; font-size:10px; line-height:1.4; }
#${IDS.panel} .bs-video-playing { left:6px; } #${IDS.panel} .bs-video-duration { right:6px; font-variant-numeric:tabular-nums; }
#${IDS.panel} .bs-video-caption { display:flex; align-items:center; gap:3px; min-width:0; height:32px; }
#${IDS.panel} .bs-video-caption strong { min-width:0; flex:1; font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#${IDS.panel} .bs-video-rename { width:26px; height:26px; flex:none; padding:5px; border:0; border-radius:6px; background:transparent; color:var(--bs-muted); cursor:pointer; }
#${IDS.panel} .bs-video-rename:hover { color:var(--bs-accent); background:var(--bs-inset); }
#${IDS.panel} .bs-video-name { min-width:0; width:100%; padding:5px; border:1px solid var(--bs-accent); border-radius:5px; background:var(--bs-surface); color:var(--bs-text); font-size:12px; }
#${IDS.panel} .bs-video-meta { display:flex; justify-content:space-between; color:var(--bs-muted); font-size:11px; }
#${IDS.panel} .bs-video-remove { padding:0 1px; border:0; background:transparent; color:var(--bs-muted); font-size:11px; cursor:pointer; }
#${IDS.panel} .bs-video-remove:hover { color:var(--bs-text); text-decoration:underline; }
#${IDS.panel} .bs-video-empty { grid-column:1/-1; padding:24px 14px; border:1px dashed var(--bs-line); border-radius:10px; text-align:center; font-size:13px; }
#${IDS.panel} .bs-video-empty p { color:var(--bs-muted); font-size:12px; line-height:1.7; margin:10px 0 0; }
@media (prefers-reduced-motion:reduce) {
  #${IDS.button}, #${IDS.button} > svg, #${IDS.panel}, #${IDS.panel} *, #${IDS.panel} .bs-tabs::before { transition:none !important; }
}`;
  }

  const FRAME_STYLE = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:0;pointer-events:none;background:transparent;';
  const FRAME_STYLE_ON = FRAME_STYLE;
  const FRAME_STYLE_OFF = 'position:fixed;left:0;top:0;width:1px;height:1px;border:0;z-index:0;pointer-events:none;opacity:0;background:transparent;';
  const SURFACES = Object.freeze({
    ocean: { id: IDS.frame, entry: 'skin.html' },
    cosmos: { id: IDS.cosmos, entry: 'cosmos.html' },
  });

  function createController(options) {
    if (!options || typeof options.assetUrl !== 'function' || !options.storage) {
      throw new TypeError('BackspaceSkinCore requires assetUrl() and storage adapters.');
    }

    let copy = selectCopy(options.locale);
    let state = normalize(DEFAULTS);
    let ownsSurface = false;
    let ownsUi = false;
    let startGeneration = 0;
    let panelOpen = false;
    let previousFocus = null;
    let placementObserver = null;
    let placementResizeObserver = null;
    let placementTargets = [];
    let placementFrame = 0;
    let placementAnchor = null;
    const frames = new Map();
    const transitionDuration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 550;
    let baseFrame = null;
    let incomingFrame = null;
    let transitionAnimation = null;
    let fadeTarget = 1;
    let requestSequence = 0;
    let transitionPhase = 'idle';
    let transitionRoute = 'initial';
    let transitionError = '';
    let hideHelp = () => {};
    let hideResetConfirm = () => {};
    let panelAnimation = null;
    let panelSizeAnimation = null;
    let sectionSizeAnimations = [];
    let pointerFrame = 0;
    let pointerPending = null;
    let pointerSent = null;
    let videoData = { items: [], activeId: null };
    let videoBusy = false;
    let videoErrors = [];
    let videoToken = null;
    let videoReady = null;
    let videoReadyResolve;
    let videoReadyReject;
    let videoReadyTimer;
    let videoRequestId = 0;
    let videoGeneration = 0;
    let syncVideoUi = () => {};
    const videoRequests = new Map();
    const surfaceCleanups = [];
    const controllerCleanups = [];

    const on = (target, event, listener, settings) => {
      target.addEventListener(event, listener, settings);
      surfaceCleanups.push(() => target.removeEventListener(event, listener, settings));
    };

    const mergePatch = (patch) => {
      const next = normalize({ ...state, ...patch });
      if (GENERAL_KEYS.some(key => Object.hasOwn(patch, key))) {
        const general = normalizeGeneral({ ...next.p.general[next.skin], ...patch });
        next.p.general[next.skin] = general;
        Object.assign(next, general);
      }
      return next;
    };

    const save = (patch) => {
      state = mergePatch(patch);
      if (Object.hasOwn(patch, 'skin') || GENERAL_KEYS.some(key => Object.hasOwn(patch, key))) {
        patch = { ...patch, ...state.p.general[state.skin], p: state.p };
      }
      return Promise.resolve(options.storage.set(patch)).catch((error) => {
        console.warn('[Backspace] Failed to save settings.', error);
      });
    };

    const updateGlass = () => {
      if (!ownsUi) return;
      const style = document.getElementById(IDS.glass);
      if (style) style.textContent = glassCss(state.glass, state.chatCustom, state.chatOpacity);
    };

    const frameOrigin = (frame) => {
      const url = new URL(frame.src);
      return url.protocol === 'chrome-extension:' ? `${url.protocol}//${url.host}` : url.origin;
    };

    const postToFrame = (id, payload) => {
      for (const record of frames.values()) {
        if (record.frame.id === id && record.frame.isConnected) {
          record.frame.contentWindow?.postMessage(payload, record.origin);
          return;
        }
      }
    };

    const videoOrigin = frame => {
      const url = new URL(frame.src);
      return url.origin === 'null' ? `${url.protocol}//${url.host}` : url.origin;
    };
    const setFrameActive = (id, active) => {
      const frame = document.getElementById(id);
      if (!(frame instanceof HTMLIFrameElement)) return;
      const next = active ? FRAME_STYLE_ON : FRAME_STYLE_OFF;
      if (frame.style.cssText !== next) frame.style.cssText = next;
    };

    const setVideoPaused = paused => {
      const frame = document.getElementById(IDS.video);
      if (frame instanceof HTMLIFrameElement) frame.contentWindow.postMessage({ type: 'bs-video', token: videoToken, action: 'visibility', paused }, videoOrigin(frame));
    };
    const removeVideoFrame = () => {
      videoGeneration++;
      clearTimeout(videoReadyTimer);
      videoReadyReject?.(new Error('cancelled'));
      videoReadyResolve = videoReadyReject = null;
      for (const pending of videoRequests.values()) { clearTimeout(pending.timer); pending.reject(new Error('cancelled')); }
      videoRequests.clear();
      document.getElementById(IDS.video)?.remove();
      videoReady = null;
      videoToken = null;
      videoBusy = false;
      videoData = { items: [], activeId: null };
    };
    const ensureVideoFrame = () => {
      if (videoReady) return videoReady;
      const frame = document.createElement('iframe');
      videoToken = crypto.randomUUID();
      frame.id = IDS.video;
      frame.src = `${options.assetUrl('video.html')}?${new URLSearchParams({ parentOrigin: location.origin, token: videoToken })}`;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.setAttribute('allow', 'autoplay');
      frame.style.cssText = FRAME_STYLE_OFF;
      videoReady = new Promise((resolve, reject) => {
        videoReadyResolve = resolve; videoReadyReject = reject;
        videoReadyTimer = setTimeout(() => reject(new Error('load')), 8000);
      });
      (document.body || document.documentElement).prepend(frame);
      return videoReady;
    };
    const requestVideo = async (action, payload = {}) => {
      await ensureVideoFrame();
      const frame = document.getElementById(IDS.video);
      if (!(frame instanceof HTMLIFrameElement)) throw new Error('cancelled');
      const requestId = ++videoRequestId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { videoRequests.delete(requestId); reject(new Error('load')); }, 10000);
        videoRequests.set(requestId, { resolve, reject, timer });
        frame.contentWindow.postMessage({ type: 'bs-video', token: videoToken, requestId, action, paused: !state.enabled, ...payload }, videoOrigin(frame));
      });
    };
    const acceptVideoReply = reply => {
      videoData = { items: Array.isArray(reply.items) ? reply.items : [], activeId: reply.activeId || null };
    };
    const videoAction = async (action, payload = {}) => {
      if (videoBusy) return;
      const generation = videoGeneration;
      videoBusy = true; videoErrors = []; syncVideoUi();
      try {
        const reply = await requestVideo(action, payload);
        if (generation !== videoGeneration) return;
        acceptVideoReply(reply);
        if (!reply.ok) videoErrors.push({ code: reply.code });
        else videoErrors = [];
      } catch (error) {
        if (generation !== videoGeneration) return;
        videoData.activeId = null;
        videoErrors.push({ code: error.message });
      } finally {
        if (generation === videoGeneration) { videoBusy = false; applySkin(); syncVideoUi(); }
      }
    };
    const importVideos = async files => {
      if (videoBusy || !files.length) return;
      const generation = videoGeneration;
      videoBusy = true; videoErrors = []; syncVideoUi();
      try {
        for (const file of files) {
          if (generation !== videoGeneration) break;
          const reply = await requestVideo('import', { file, name: file.name });
          if (generation !== videoGeneration) break;
          acceptVideoReply(reply);
          if (!reply.ok) videoErrors.push({ code: reply.code, name: file.name });
          syncVideoUi();
        }
      } catch (error) {
        if (generation === videoGeneration) videoErrors.push({ code: error.message });
      } finally {
        if (generation === videoGeneration) { videoBusy = false; applySkin(); syncVideoUi(); }
      }
    };
    const onVideoMessage = event => {
      const frame = document.getElementById(IDS.video);
      const data = event.data;
      if (!(frame instanceof HTMLIFrameElement) || event.source !== frame.contentWindow || event.origin !== videoOrigin(frame)
        || !data || data.type !== 'bs-video' || data.token !== videoToken) return;
      if (data.event === 'ready') {
        clearTimeout(videoReadyTimer); videoReadyResolve?.(); videoReadyResolve = videoReadyReject = null;
      } else if (data.event === 'failure') {
        videoData.activeId = null; videoErrors = [{ code: data.code }]; applySkin(); syncVideoUi();
      } else {
        const pending = videoRequests.get(data.requestId);
        if (!pending) return;
        videoRequests.delete(data.requestId); clearTimeout(pending.timer); pending.resolve(data);
      }
    };

    const cosmicSettings = () => state.p.views[state.skin === 'vortex' ? 'vortex' : 'horizon'];

    const postToOcean = () => {
      const record = frames.get('ocean');
      if (record && !record.ready) { prepareFrame(record); return; }
      postToFrame(IDS.frame, {
        type: 'bs-set', sea: state.sea, t: state.time, auto: state.autoCycle,
      });
    };

    const postToCosmos = () => {
      const skin = skinById(state.skin);
      if (skin.surface !== 'cosmos') return;
      const record = frames.get('cosmos');
      if (record && !record.ready) { prepareFrame(record); return; }
      postToFrame(IDS.cosmos, { type: 'bs-set', params: { ...cosmicSettings().params }, auto: cosmicSettings().autoCycle });
      schedulePointer();
    };

    const schedulePointer = () => {
      if (pointerFrame || !pointerPending || !state.enabled || !frames.get('cosmos')?.ready || skinById(state.skin).surface !== 'cosmos' || cosmicSettings().params.parallax === 0) return;
      if (pointerSent && pointerPending.every((value, axis) => value === pointerSent[axis])) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pointerPending || !state.enabled || !frames.get('cosmos')?.ready || skinById(state.skin).surface !== 'cosmos' || cosmicSettings().params.parallax === 0) return;
        postToFrame(IDS.cosmos, { type: 'bs-pointer', x: pointerPending[0], y: pointerPending[1] });
        pointerSent = pointerPending;
      });
    };

    const syncCosmosPreview = () => {
      postToFrame(IDS.cosmos, {
        type: 'bs-preview', active: state.enabled && (panelOpen || transitionPhase === 'crossfade') && skinById(state.skin).surface === 'cosmos',
      });
    };

    function syncSurfaces() {
      const targetSurface = state.skin === 'video' ? (videoData.activeId ? 'video' : 'ocean') : skinById(state.skin).surface;
      for (const record of frames.values()) {
        const active = record.ready && (incomingFrame?.ready ? record.surface === targetSurface : record === baseFrame);
        postToFrame(record.frame.id, { type: 'bs-pause', paused: !state.enabled || document.hidden || !active });
      }
      if (transitionAnimation) {
        if (document.hidden) transitionAnimation.pause();
        else transitionAnimation.play();
      }
      syncCosmosPreview();
      if (state.skin !== 'video' && baseFrame?.ready && document.getElementById(IDS.video)) removeVideoFrame();
    }

    function pauseReadyTimer(record) {
      if (!record.timer) return;
      clearTimeout(record.timer);
      record.timer = 0;
      record.remaining -= performance.now() - record.waitStarted;
    }

    function armReadyTimer(record) {
      pauseReadyTimer(record);
      if (record.ready || document.hidden) return;
      record.waitStarted = performance.now();
      record.timer = setTimeout(() => failFrame(record, '首帧准备超时'), Math.max(0, record.remaining));
    }

    function removeFrame(record) {
      if (!record) return;
      clearTimeout(record.timer);
      record.frame.onload = null;
      record.frame.remove();
      frames.delete(record.surface);
    }

    function stopTransition() {
      if (!transitionAnimation) return;
      incomingFrame.frame.style.opacity = getComputedStyle(incomingFrame.frame).opacity;
      transitionAnimation.cancel();
      transitionAnimation = null;
    }

    function clearSurfaces() {
      stopTransition();
      for (const record of frames.values()) removeFrame(record);
      baseFrame = incomingFrame = null;
      transitionPhase = 'idle';
      transitionError = '';
      pointerSent = null;
    }

    function finishTransition(target) {
      if (target === 1) {
        removeFrame(baseFrame);
        baseFrame = incomingFrame;
      } else removeFrame(incomingFrame);
      incomingFrame = null;
      baseFrame.frame.style.opacity = '1';
      transitionAnimation = null;
      transitionPhase = 'idle';
      syncSurfaces();
      schedulePointer();
    }

    function fadeTo(target) {
      if (transitionAnimation && fadeTarget === target) { syncSurfaces(); return; }
      stopTransition();
      fadeTarget = target;
      const from = Number(incomingFrame.frame.style.opacity);
      transitionPhase = 'crossfade';
      transitionRoute = 'crossfade';
      if (Math.abs(target - from) < 0.001) { finishTransition(target); return; }
      const animation = incomingFrame.frame.animate([{ opacity: from }, { opacity: target }], {
        duration: transitionDuration * Math.abs(target - from),
        easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards',
      });
      transitionAnimation = animation;
      syncSurfaces();
      animation.finished.then(() => {
        if (transitionAnimation !== animation) return;
        incomingFrame.frame.style.opacity = String(target);
        animation.cancel();
        finishTransition(target);
      }).catch(() => {});
    }

    function prepareFrame(record) {
      if (!record.loaded || record.ready || !state.enabled) return;
      record.requestId = ++requestSequence;
      postToFrame(record.frame.id, {
        type: 'bs-prepare', requestId: record.requestId, skin: record.skin,
        params: { ...state.p.views[record.skin]?.params }, auto: record.surface === 'ocean' ? state.autoCycle : state.p.views[record.skin].autoCycle,
        sea: state.sea, t: state.time, preview: panelOpen,
      });
    }

    function restoreSkin(id) {
      state.skin = id;
      void save({ skin: id });
      updateGlass();
      syncSkinUi();
    }

    function failFrame(record, reason) {
      if (frames.get(record.surface) !== record) return;
      console.warn('[Backspace] Surface unavailable:', record.surface, reason);
      transitionError = String(reason || '渲染失败');
      stopTransition();
      if (record === incomingFrame) incomingFrame = null;
      if (record === baseFrame) baseFrame = null;
      removeFrame(record);
      if (baseFrame) {
        restoreSkin(baseFrame.skin);
        baseFrame.frame.style.opacity = '1';
        transitionPhase = 'idle';
        syncSurfaces();
      } else if (incomingFrame) {
        if (incomingFrame.ready) {
          baseFrame = incomingFrame;
          incomingFrame = null;
          restoreSkin(baseFrame.skin);
          baseFrame.frame.style.opacity = '1';
          transitionPhase = 'idle';
          syncSurfaces();
        }
      } else if (record.surface !== 'ocean') {
        restoreSkin('ocean');
        applySkin();
      } else transitionPhase = 'error';
    }

    function onSurfaceMessage(event) {
      const record = [...frames.values()].find(item => item.frame.contentWindow === event.source);
      if (!record || event.origin !== record.origin) return;
      const data = event.data;
      if (!isRecord(data)) return;
      if (data.type === 'bs-frame-ready' && record.loaded && record.requestId > 0 && Number.isSafeInteger(data.requestId) && data.requestId === record.requestId && data.surface === record.surface && !record.ready) {
        pauseReadyTimer(record);
        record.ready = true;
        if (record === baseFrame) { syncSurfaces(); return; }
        if (!baseFrame) {
          baseFrame = record;
          incomingFrame = null;
          record.frame.style.opacity = '1';
          transitionPhase = 'idle';
          syncSurfaces();
          schedulePointer();
        } else fadeTo(1);
      } else if ((data.type === 'bs-surface-error' && data.surface === record.surface)
        || (data.type === 'bs-cosmos-error' && record.surface === 'cosmos')) failFrame(record, data.reason);
    }

    function onSurfaceVisibility() {
      for (const record of frames.values()) {
        if (document.hidden) pauseReadyTimer(record);
        else armReadyTimer(record);
      }
      syncSurfaces();
    }

    const anchorSelectors = ['[data-slot="sidebar.settings"] button', '[data-testid="settings-trigger"]', '.VOzbGW_trigger'];
    const anchorSelector = anchorSelectors.join(',');
    const sidebarSelector = 'div:has(> [data-shell-overlay]) > :first-child, .dshDesktopSidebarSurface, .pI_x6G_sidebarCol, aside';

    const placeButton = () => {
      placementFrame = 0;
      const button = document.getElementById(IDS.button);
      if (!(button instanceof HTMLElement)) return;
      let rect = placementAnchor?.isConnected ? placementAnchor.getBoundingClientRect() : null;
      if (!rect?.width) {
        placementAnchor = null;
        for (const selector of anchorSelectors) {
          const candidate = document.querySelector(selector);
          if (!(candidate instanceof HTMLElement)) continue;
          const candidateRect = candidate.getBoundingClientRect();
          if (!candidateRect.width) continue;
          placementAnchor = candidate;
          rect = candidateRect;
          break;
        }
      }
      const sidebar = placementAnchor
        ? placementAnchor.closest(sidebarSelector)
        : document.querySelector(sidebarSelector);
      const conversation = sidebar && CONVERSATION_ROOTS.map(selector => document.querySelector(selector))
        .find(element => element instanceof HTMLElement && element.getBoundingClientRect().height > 0);
      const targets = [sidebar, conversation, sidebar ? null : placementAnchor];
      if (targets.some((target, index) => target !== placementTargets[index])) {
        placementResizeObserver?.disconnect();
        for (const target of targets) if (target) placementResizeObserver?.observe(target, { box: 'border-box' });
        placementTargets = targets;
      }
      const sidebarRect = sidebar?.getBoundingClientRect();
      const conversationRect = conversation?.getBoundingClientRect();
      const surfaceRect = conversationRect || sidebarRect;
      const edge = conversationRect?.left ?? sidebarRect?.right ?? (placementAnchor ? rect.right : null);
      const left = edge === null ? '13px'
        : `${Math.max(12, Math.min(Math.round(edge + 13), window.innerWidth - button.offsetWidth - 12))}px`;
      let position;
      if (surfaceRect || placementAnchor) {
        const top = surfaceRect ? surfaceRect.bottom - button.offsetHeight - 13
          : rect.top + (rect.height - button.offsetHeight) / 2;
        position = {
          left,
          top: `${Math.max(12, Math.min(Math.round(top), window.innerHeight - button.offsetHeight - 12))}px`,
          bottom: 'auto',
        };
      } else {
        position = { left, bottom: '13px', top: 'auto' };
      }
      for (const [key, value] of Object.entries(position)) if (button.style[key] !== value) button.style[key] = value;
      if (panelOpen) placePanel();
    };

    const cancelPanelResize = () => {
      panelSizeAnimation?.cancel();
      panelSizeAnimation = null;
      for (const animation of sectionSizeAnimations) animation.cancel();
      sectionSizeAnimations = [];
    };

    const placePanel = () => {
      if (panelSizeAnimation) return;
      const button = document.getElementById(IDS.button);
      const panel = document.getElementById(IDS.panel);
      if (!button || !panel) return;
      const rect = button.getBoundingClientRect();
      const aboveSpace = rect.top - 22;
      const belowSpace = window.innerHeight - rect.bottom - 22;
      panel.style.maxHeight = `${Math.min(window.innerHeight - 24, Math.max(240, aboveSpace, belowSpace))}px`;
      const left = Math.max(12, Math.min(rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 12));
      const above = rect.top - panel.offsetHeight - 10;
      const top = above >= 12 ? above : Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - panel.offsetHeight - 12));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.transformOrigin = `${rect.left + rect.width / 2 - left}px ${above >= 12 ? '100%' : '0%'}`;
    };

    const schedulePlace = () => {
      if (!placementFrame) placementFrame = requestAnimationFrame(placeButton);
    };

    const setPanelOpen = (open) => {
      const button = document.getElementById(IDS.button);
      const panel = document.getElementById(IDS.panel);
      if (!(button instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;
      if (panelOpen === open) return;
      cancelPanelResize();
      if (panelOpen) placePanel();
      const current = panelAnimation ? {
        opacity: getComputedStyle(panel).opacity,
        transform: getComputedStyle(panel).transform,
        clipPath: getComputedStyle(panel).clipPath,
      } : null;
      panelAnimation?.cancel();
      panelAnimation = null;
      panelOpen = open;
      if (state.skin === 'video' && !state.enabled) {
        if (open) void videoAction('list');
        else removeVideoFrame();
      }
      syncCosmosPreview();
      panel.classList.add('open');
      panel.inert = !open;
      panel.setAttribute('aria-hidden', String(!open));
      button.classList.toggle('active', open);
      button.setAttribute('aria-expanded', String(open));
      hideHelp();
      hideResetConfirm();
      if (open) {
        previousFocus = document.activeElement;
        placePanel();
        // 焦点落在当前皮肤的可见控件上，避免落到隐藏皮肤的行里
        const first = panel.querySelector('.bs-skin-group:not([hidden]) input[type=\'range\']')
          || panel.querySelector('input');
        first?.focus();
      } else if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        panel.classList.toggle('open', open);
        return;
      }
      const expanded = { opacity: 1, transform: 'none', clipPath: 'inset(0 round 18px)' };
      const folded = { opacity: 0, transform: 'translateY(10px) scale(.94)', clipPath: 'inset(10% 4% 0 round 24px)' };
      panelAnimation = panel.animate([current || (open ? folded : expanded), open ? expanded : folded], {
        duration: open ? 240 : 140,
        easing: open ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.4,0,1,1)',
      });
      panelAnimation.onfinish = () => {
        panelAnimation = null;
        if (!panelOpen) panel.classList.remove('open');
      };
    };

    const mountFrame = (skin) => {
      const root = document.body || document.documentElement;
      const surface = SURFACES[skin.surface];
      if (!root || document.getElementById(surface.id)) return null;
      const query = new URLSearchParams({
        managed: '1', parentOrigin: location.origin, auto: (skin.surface === 'ocean' ? state.autoCycle : state.p.views[skin.id].autoCycle) ? '1' : '0',
      });
      if (skin.surface === 'cosmos') {
        query.set('skin', skin.id);
        query.set('controls', 'shared');
        query.set('preview', panelOpen ? '1' : '0');
        for (const [key, value] of Object.entries(state.p.views[skin.id].params)) query.set(key, value);
        pointerSent = null;
      } else {
        query.set('skin', '1');
        query.set('sea', state.sea);
        query.set('t', state.time);
      }
      const frame = document.createElement('iframe');
      frame.id = surface.id;
      frame.src = `${options.assetUrl(surface.entry)}?${query}`;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.cssText = `${FRAME_STYLE}opacity:0;`;
      const record = {
        frame, surface: skin.surface, skin: skin.id, origin: frameOrigin(frame),
        ready: false, loaded: false, requestId: 0, timer: 0,
        remaining: SURFACE_READY_TIMEOUT, waitStarted: 0,
      };
      frames.set(skin.surface, record);
      frame.onload = () => {
        if (frames.get(record.surface) !== record) return;
        record.loaded = true;
        record.ready = false;
        prepareFrame(record);
      };
      // 同一背景层用 DOM 次序叠合，不能提升 z-index 遮住宿主工作台。
      root.insertBefore(frame, baseFrame ? baseFrame.frame.nextSibling : root.firstChild);
      ownsSurface = true;
      armReadyTimer(record);
      return record;
    };

    const ensureGlassStyle = () => {
      if (document.getElementById(IDS.glass)) return;
      const style = document.createElement('style');
      style.id = IDS.glass;
      style.textContent = glassCss(state.glass, state.chatCustom, state.chatOpacity);
      (document.head || document.documentElement).appendChild(style);
    };

    function updateFrameSkin(record, skin) {
      if (record.skin === skin.id) return;
      record.skin = skin.id;
      if (!record.ready) { prepareFrame(record); return; }
      // 已显示的同类场景沿用自己的插值；先恢复，避免暂停状态把视角直接跳到终点。
      postToFrame(record.frame.id, { type: 'bs-pause', paused: document.hidden });
      postToFrame(record.frame.id, { type: 'bs-skin', skin: skin.id, params: { ...cosmicSettings().params } });
      postToCosmos();
      transitionRoute = 'native';
    }

    function applySkin() {
      if (!state.enabled || !ownsUi) return;
      if (!ownsSurface && Object.values(SURFACES).some(surface => document.getElementById(surface.id))) return;
      ensureGlassStyle();
      updateGlass();
      const selected = skinById(state.skin);
      if (selected.surface === 'video' && !document.getElementById(IDS.video)) void videoAction('list');
      const activeVideo = selected.surface === 'video' && !!videoData.activeId;
      const heldVideo = selected.surface !== 'video' && !!videoData.activeId && !baseFrame?.ready;
      setFrameActive(IDS.video, activeVideo || heldVideo);
      setVideoPaused(!activeVideo);
      if (activeVideo) {
        clearSurfaces();
        transitionRoute = 'video';
        syncSkinUi();
        return;
      }
      const skin = selected.surface === 'video' ? skinById('ocean') : selected;
      transitionError = '';
      if (incomingFrame && !incomingFrame.ready && incomingFrame.surface !== skin.surface) {
        removeFrame(incomingFrame);
        incomingFrame = null;
      }
      if (incomingFrame) {
        const record = incomingFrame.surface === skin.surface ? incomingFrame : baseFrame;
        updateFrameSkin(record, skin);
        if (incomingFrame.ready) fadeTo(record === incomingFrame ? 1 : 0);
        else { transitionPhase = 'preparing'; prepareFrame(incomingFrame); syncSurfaces(); }
      } else if (baseFrame?.surface === skin.surface) {
        updateFrameSkin(baseFrame, skin);
        transitionPhase = 'idle';
        syncSurfaces();
        schedulePointer();
      } else {
        transitionRoute = baseFrame ? 'crossfade' : 'initial';
        transitionPhase = 'preparing';
        incomingFrame = mountFrame(skin);
        syncSurfaces();
      }
      syncSkinUi();
    }

    let syncSkinUi = () => {};

    const switchSkin = (id) => {
      if (!SKINS.some((skin) => skin.id === id) || (id === state.skin && transitionPhase !== 'error')) return;
      state.skin = id;
      void save({ skin: id });
      if (state.enabled) applySkin();
      else {
        syncSkinUi();
        if (id === 'video' && panelOpen) void videoAction('list');
        else removeVideoFrame();
      }
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
      button.setAttribute('aria-label', copy.button);
      button.setAttribute('aria-controls', IDS.panel);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = `${BLACK_HOLE_ICON}<span class="bs-launcher-tip" aria-hidden="true">${copy.button}</span>`;

      const panel = document.createElement('div');
      panel.id = IDS.panel;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-label', copy.button);
      panel.setAttribute('aria-hidden', 'true');
      panel.inert = true;

      const helpButton = (key) => `<button class="bs-help" type="button" data-help="${key}">${HELP_ICON}</button>`;
      const skinRows = (skin) => skin.params.map((param) => `
        <div class="bs-row">
          <div class="bs-head"><span class="bs-label"><label for="${paramDomId(skin, param)}-range">${paramLabel(copy, skin, param)}</label>${helpButton(param.key)}</span><output class="bs-value" id="${paramDomId(skin, param)}" for="${paramDomId(skin, param)}-range"></output></div>
          <input type="range" id="${paramDomId(skin, param)}-range" min="${param.min}" max="${param.max}" step="1" />
        </div>`).join('');

      panel.innerHTML = `
        <div class="bs-title"><span class="bs-brand">${BLACK_HOLE_ICON}Zed Space Skin</span><button class="bs-close" type="button" aria-label="${copy.close}">${CLOSE_ICON}</button></div>
        <div class="bs-switch bs-skin-heading"><label for="${IDS.panel}-enabled">${copy.skinTitle}</label><input type="checkbox" role="switch" id="${IDS.panel}-enabled" aria-label="${copy.enable}" />${helpButton('skinTitle')}</div>
        <div class="bs-tabs" role="tablist" aria-label="${copy.skinTitle}">${SKIN_TABS.map((skin) => `<button class="bs-tab" type="button" role="tab" data-skin="${skin.id}" aria-selected="${skin.id === state.skin}" aria-controls="${IDS.panel}-${skin.surface}">${copy.skins[skin.id]}</button>`).join('')}</div>
        <div class="bs-scroll"><div class="bs-skin-region">${PARAM_GROUPS.map((skin) => `
          <section class="bs-skin-group" id="${IDS.panel}-${skin.id}" role="tabpanel" aria-label="${copy.skins[skin.surface === 'cosmos' ? state.skin : skin.id]}"${skin.surface === skinById(state.skin).surface ? '' : ' hidden'}>
            <div class="bs-group-title">${`${copy.skins[skin.surface === 'cosmos' ? state.skin : skin.id]} · ${copy.ownTitle}`}</div><div class="bs-params">${skinRows(skin)}</div>
            <div class="bs-row bs-switch"><span class="bs-label"><label for="${IDS.panel}-${skin.surface === 'ocean' ? 'cycle' : 'cosmos-cycle'}">${skin.surface === 'ocean' ? copy.autoCycle : copy.cosmicCycle}</label>${helpButton(skin.surface === 'ocean' ? 'autoCycle' : 'cosmicCycle')}</span><input type="checkbox" role="switch" id="${IDS.panel}-${skin.surface === 'ocean' ? 'cycle' : 'cosmos-cycle'}" /></div>
          </section>`).join('')}
          <section class="bs-skin-group bs-video-group" id="${IDS.panel}-video" role="tabpanel" aria-label="${copy.skins.video}" hidden>
            <div class="bs-video-head"><strong class="bs-video-title"></strong><button type="button" class="bs-video-import"></button></div>
            <p class="bs-video-help"></p><div class="bs-video-grid"></div>
            <p class="bs-video-status" role="status"></p><p class="bs-video-errors" role="alert" hidden></p>
            <input id="${IDS.panel}-video-files" type="file" accept=".mp4,.webm" multiple hidden>
          </section></div>
          <section class="bs-group">
            <div class="bs-group-title">${copy.commonTitle}</div>
            <div class="bs-row"><div class="bs-head"><span class="bs-label"><label for="${IDS.panel}-glass-range">${copy.glass}</label>${helpButton('glass')}</span><output class="bs-value" id="${IDS.panel}-glass" for="${IDS.panel}-glass-range"></output></div><input type="range" id="${IDS.panel}-glass-range" min="40" max="90" step="1" /></div>
            <div class="bs-row bs-switch"><span class="bs-label"><label for="${IDS.panel}-chat">${copy.chatCustom}</label>${helpButton('chatCustom')}</span><input type="checkbox" role="switch" id="${IDS.panel}-chat" /></div>
            <div class="bs-row bs-sub" id="${IDS.panel}-chat-row"><div class="bs-head"><span class="bs-label"><label for="${IDS.panel}-chat-range">${copy.chatOpacity}</label>${helpButton('chatOpacity')}</span><output class="bs-value" id="${IDS.panel}-chat-value" for="${IDS.panel}-chat-range"></output></div><input type="range" id="${IDS.panel}-chat-range" min="${CHAT_OPACITY_MIN}" max="${CHAT_OPACITY_MAX}" step="1" /></div>
          </section>
        </div>
        <div class="bs-footer"><span class="bs-save-hint">${copy.saveHint}</span><span class="bs-reset-wrap"><button type="button" class="bs-reset" aria-haspopup="dialog" aria-controls="${IDS.panel}-reset-confirm" aria-expanded="false">${copy.reset}</button>${helpButton('reset')}</span></div>
        <div class="bs-reset-confirm" id="${IDS.panel}-reset-confirm" popover="auto" role="dialog" aria-labelledby="${IDS.panel}-reset-title"><strong id="${IDS.panel}-reset-title"></strong><div class="bs-confirm-actions"><button type="button" class="bs-confirm-cancel" autofocus>${copy.cancel}</button><button type="button" class="bs-confirm-restore">${copy.resetConfirm}</button></div></div>`;

      const host = document.body || document.documentElement;
      const tooltip = document.createElement('div');
      tooltip.id = `${IDS.panel}-help`;
      tooltip.className = 'bs-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.hidden = true;
      const tooltipContent = document.createElement('div');
      tooltip.append(tooltipContent);
      host.append(button, panel, tooltip);
      ownsUi = true;

      const glassRange = panel.querySelector(`#${IDS.panel}-glass-range`);
      const glassOut = panel.querySelector(`#${IDS.panel}-glass`);
      const enabledBox = panel.querySelector(`#${IDS.panel}-enabled`);
      const cycleBox = panel.querySelector(`#${IDS.panel}-cycle`);
      const cosmicCycleBox = panel.querySelector(`#${IDS.panel}-cosmos-cycle`);
      const chatBox = panel.querySelector(`#${IDS.panel}-chat`);
      const chatRow = panel.querySelector(`#${IDS.panel}-chat-row`);
      const chatRange = panel.querySelector(`#${IDS.panel}-chat-range`);
      const chatOut = panel.querySelector(`#${IDS.panel}-chat-value`);
      const resetBtn = panel.querySelector('.bs-reset');
      const resetConfirm = panel.querySelector('.bs-reset-confirm');
      const cancelResetBtn = panel.querySelector('.bs-confirm-cancel');
      const confirmResetBtn = panel.querySelector('.bs-confirm-restore');
      hideResetConfirm = () => {
        resetConfirm.hidePopover();
        resetBtn.setAttribute('aria-expanded', 'false');
      };
      on(resetConfirm, 'toggle', () => resetBtn.setAttribute('aria-expanded', String(resetConfirm.matches(':popover-open'))));
      on(cancelResetBtn, 'click', () => { hideResetConfirm(); resetBtn.focus(); });
      on(resetBtn, 'click', () => {
        hideHelp();
        resetConfirm.showPopover();
        const rect = resetBtn.getBoundingClientRect();
        resetConfirm.style.left = `${Math.max(12, Math.min(rect.right - resetConfirm.offsetWidth, window.innerWidth - resetConfirm.offsetWidth - 12))}px`;
        resetConfirm.style.top = `${Math.max(12, rect.top - resetConfirm.offsetHeight - 8)}px`;
        resetBtn.setAttribute('aria-expanded', 'true');
        cancelResetBtn.focus();
      });
      surfaceCleanups.push(hideResetConfirm);
      const tabs = [...panel.querySelectorAll('.bs-tab')];
      const videoGroup = panel.querySelector('.bs-video-group');
      const videoImport = videoGroup.querySelector('.bs-video-import');
      const videoFiles = videoGroup.querySelector('input[type=file]');
      let videoFocus = null;
      on(videoImport, 'click', () => videoFiles.click());
      on(videoFiles, 'change', () => { const files = [...videoFiles.files]; videoFiles.value = ''; void importVideos(files); });
      on(window, 'message', onVideoMessage);
      syncVideoUi = () => {
        videoGroup.querySelector('.bs-video-title').textContent = `${copy.videoTitle}${videoData.items.length ? ` ${videoData.items.length}` : ''}`;
        videoImport.textContent = copy.videoImport; videoImport.disabled = videoBusy;
        videoGroup.querySelector('.bs-video-help').textContent = copy.videoHelp;
        const grid = videoGroup.querySelector('.bs-video-grid');
        const scrollTop = grid.scrollTop;
        grid.replaceChildren();
        for (const clip of videoData.items) {
          const tile = document.createElement('article'); tile.className = 'bs-video-tile';
          tile.innerHTML = '<label class="bs-video-thumb"><img alt=""><input type="checkbox"><span class="bs-video-playing"></span><span class="bs-video-duration"></span></label><div class="bs-video-caption"><strong></strong></div><div class="bs-video-meta"></div>';
          const image = tile.querySelector('img');
          if (typeof clip.thumbnail === 'string' && clip.thumbnail.startsWith('data:image/jpeg;base64,')) image.src = clip.thumbnail;
          const check = tile.querySelector('input'); check.checked = clip.id === videoData.activeId; check.disabled = videoBusy;
          check.setAttribute('aria-label', `${copy.videoEnable} ${clip.name}`);
          check.dataset.videoId = clip.id; check.dataset.videoAction = 'select';
          check.addEventListener('change', () => {
            videoFocus = { id: clip.id, action: 'select' };
            void videoAction('select', { id: check.checked ? clip.id : null });
          });
          tile.dataset.selected = String(check.checked);
          const playing = tile.querySelector('.bs-video-playing'); playing.hidden = !check.checked; playing.textContent = state.enabled ? copy.videoPlaying : copy.videoChosen;
          const seconds = Math.max(0, Math.floor(clip.duration));
          tile.querySelector('.bs-video-duration').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
          const title = tile.querySelector('strong'); title.textContent = clip.name; title.title = clip.original;
          const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'bs-video-rename';
          rename.innerHTML = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m3 13 9-9 4 4-9 9H3v-4Z" stroke="currentColor" stroke-width="1.4"/><path d="m10.5 5.5 4 4" stroke="currentColor" stroke-width="1.4"/></svg>';
          rename.setAttribute('aria-label', `${copy.videoRename} ${clip.name}`); rename.title = copy.videoRename; rename.disabled = videoBusy;
          rename.dataset.videoId = clip.id; rename.dataset.videoAction = 'rename';
          const caption = tile.querySelector('.bs-video-caption'); caption.append(rename);
          rename.addEventListener('click', () => {
            const input = document.createElement('input'); input.className = 'bs-video-name'; input.value = clip.name; input.maxLength = 80;
            input.setAttribute('aria-label', `${copy.videoRename} ${clip.name}`);
            caption.replaceChildren(input); input.focus(); input.select();
            let finished = false;
            const finish = cancelled => {
              if (finished) return;
              finished = true; videoFocus = { id: clip.id, action: 'rename' };
              const name = input.value.trim();
              if (cancelled || name === clip.name) { syncVideoUi(); return; }
              if (!name || name.length > 80) { videoErrors = [{ code: 'name' }]; syncVideoUi(); return; }
              void videoAction('rename', { id: clip.id, name });
            };
            input.addEventListener('keydown', event => {
              if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(event.key === 'Escape'); }
            });
            input.addEventListener('blur', () => finish(false));
          });
          tile.querySelector('.bs-video-meta').textContent = `${(clip.size / 1024 / 1024).toFixed(1)} MB`;
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'bs-video-remove';
          remove.textContent = copy.videoRemove; remove.setAttribute('aria-label', `${copy.videoRemove} ${clip.name}`); remove.disabled = videoBusy;
          remove.addEventListener('click', () => {
            videoFocus = { id: clip.id, action: 'remove' };
            void videoAction('remove', { id: clip.id });
          });
          tile.querySelector('.bs-video-meta').append(remove);
          grid.append(tile);
        }
        if (!videoData.items.length) {
          const empty = document.createElement('div'); empty.className = 'bs-video-empty';
          const title = document.createElement('strong'); title.textContent = copy.videoEmpty;
          const limits = document.createElement('p'); limits.textContent = copy.videoLimits;
          empty.append(title, limits); grid.append(empty);
        }
        const active = videoData.items.find(clip => clip.id === videoData.activeId);
        videoGroup.querySelector('.bs-video-status').textContent = videoBusy ? copy.videoLoading : active ? (state.enabled ? copy.videoActive : copy.videoSelected) + active.name : videoData.items.length ? copy.videoIdle : copy.videoLocal;
        const error = videoGroup.querySelector('.bs-video-errors'); error.hidden = videoErrors.length === 0;
        error.textContent = videoErrors.map(({ code, name }) => `${name ? `${name}: ` : ''}${copy.videoErrors[code] || copy.videoErrors.request}`).join('\n');
        grid.scrollTop = scrollTop;
        if (panelOpen && videoErrors.length) error.scrollIntoView({ block: 'nearest' });
        if (videoFocus && !videoBusy) {
          const next = [...grid.querySelectorAll('[data-video-action]')].find(element => element.dataset.videoId === videoFocus.id && element.dataset.videoAction === videoFocus.action);
          (next || videoImport).focus({ preventScroll: true });
          videoFocus = null;
        }
      };
      syncVideoUi();
      let helpTarget = null;
      const helpText = (key) => key === 'reset' ? copy.resetNote : copy.help[key];
      hideHelp = () => {
        helpTarget?.removeAttribute('aria-describedby');
        helpTarget = null;
        tooltip.hidden = true;
      };
      const showHelp = (target) => {
        hideHelp();
        helpTarget = target;
        tooltipContent.textContent = helpText(target.dataset.help);
        tooltip.hidden = false;
        const rect = target.getBoundingClientRect();
        tooltipContent.style.maxHeight = `${Math.max(32, rect.top - 22)}px`;
        const left = Math.max(12, Math.min(rect.left + rect.width / 2 - tooltip.offsetWidth / 2, window.innerWidth - tooltip.offsetWidth - 12));
        const top = Math.max(12, rect.top - tooltip.offsetHeight - 8);
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        target.setAttribute('aria-describedby', tooltip.id);
      };
      for (const help of panel.querySelectorAll('.bs-help')) {
        on(help, 'pointerenter', () => showHelp(help));
        on(help, 'pointerleave', (event) => { if (!tooltip.contains(event.relatedTarget)) hideHelp(); });
        on(help, 'focus', () => showHelp(help));
        on(help, 'blur', hideHelp);
        on(help, 'click', () => showHelp(help));
      }
      on(tooltip, 'pointerleave', (event) => { if (!helpTarget?.contains(event.relatedTarget)) hideHelp(); });
      on(panel.querySelector('.bs-scroll'), 'scroll', () => {
        if (helpTarget && document.activeElement === helpTarget) showHelp(helpTarget);
        else hideHelp();
      }, { passive: true });
      surfaceCleanups.push(hideHelp);

      const fillRange = (input) => {
        const percent = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
        input.style.setProperty('--bs-fill', `${percent}%`);
      };
      on(panel, 'input', (event) => {
        if (event.target.matches('input[type="range"]')) fillRange(event.target);
      });

      const paramInputs = [];
      for (const skin of PARAM_GROUPS) {
        for (const param of skin.params) {
          paramInputs.push({
            skin,
            param,
            input: panel.querySelector(`#${paramDomId(skin, param)}-range`),
            out: panel.querySelector(`#${paramDomId(skin, param)}`),
          });
        }
      }

      const paramValue = (skin, param) => (skin.surface === 'ocean' ? state[param.key] : cosmicSettings().params[param.key]);

      const syncParams = () => {
        for (const { skin, param, input, out } of paramInputs) {
          const value = paramValue(skin, param);
          input.value = String(value);
          out.textContent = paramText(copy, param, value);
          fillRange(input);
        }
      };

      const skinDefaults = () => ({ ...normalizeGeneral(DEFAULTS), ...(state.skin === 'ocean'
        ? { sea: DEFAULTS.sea, time: DEFAULTS.time, autoCycle: DEFAULTS.autoCycle }
        : state.skin === 'video' ? {} : { p: { ...state.p, views: { ...state.p.views, [state.skin]: {
          params: Object.fromEntries(COSMOS_PARAMS.map(param => [param.key, param.def])), autoCycle: true,
        } } } }) });
      const syncReset = () => {
        resetBtn.disabled = GENERAL_KEYS.every(key => state[key] === DEFAULTS[key]) && (state.skin === 'ocean'
          ? state.sea === DEFAULTS.sea && state.time === DEFAULTS.time && state.autoCycle === DEFAULTS.autoCycle
          : state.skin === 'video' || COSMOS_PARAMS.every(param => cosmicSettings().params[param.key] === param.def) && cosmicSettings().autoCycle);
        panel.querySelector(`#${IDS.panel}-reset-title`).textContent = copy.resetTitle(copy.skins[state.skin]);
      };
      const syncUi = () => {
        glassRange.value = String(state.glass);
        glassOut.textContent = `${state.glass}%`;
        enabledBox.checked = state.enabled;
        cycleBox.checked = state.autoCycle;
        cosmicCycleBox.checked = cosmicSettings().autoCycle;
        chatBox.checked = state.chatCustom;
        chatRange.value = String(state.chatOpacity);
        chatOut.textContent = `${state.chatOpacity}%`;
        // The slider belongs to the switch: hide it while the conversation
        // follows the workspace glass so the panel keeps one obvious meaning.
        chatRow.hidden = !state.chatCustom;
        for (const input of [glassRange, chatRange]) fillRange(input);
        syncParams();
        syncReset();
      };
      syncUi();

      const skinRegion = panel.querySelector('.bs-skin-region');
      const generalRegion = panel.querySelector('.bs-group');
      let renderedSkin = state.skin;
      // 内外区域同步伸缩，避免通用配置先跳到目标高度再随外框移动。
      syncSkinUi = () => {
        hideHelp();
        hideResetConfirm();
        const layoutChanged = renderedSkin !== state.skin || chatRow.hidden !== !state.chatCustom;
        const before = panelOpen && layoutChanged ? {
          height: getComputedStyle(panel).height, top: getComputedStyle(panel).top,
          skinHeight: getComputedStyle(skinRegion).height,
          generalHeight: getComputedStyle(generalRegion).height,
        } : null;
        if (before) cancelPanelResize();
        renderedSkin = state.skin;
        panel.querySelector('.bs-tabs').style.setProperty('--bs-tab-index', String(tabs.findIndex(tab => tab.dataset.skin === state.skin)));
        for (const tab of tabs) {
          tab.setAttribute('aria-selected', String(tab.dataset.skin === state.skin));
          tab.tabIndex = tab.dataset.skin === state.skin ? 0 : -1;
        }
        for (const skin of PARAM_GROUPS) {
          const group = panel.querySelector(`#${IDS.panel}-${skin.id}`);
          if (group) group.hidden = skin.surface !== skinById(state.skin).surface;
        }
        videoGroup.hidden = state.skin !== 'video';
        const activeGroup = panel.querySelector('.bs-skin-group:not([hidden])');
        activeGroup.setAttribute('aria-label', copy.skins[state.skin]);
        if (state.skin !== 'video') activeGroup.querySelector('.bs-group-title').textContent = `${copy.skins[state.skin]} · ${copy.ownTitle}`;
        syncUi();
        if (panelOpen) placePanel();
        if (before && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const after = {
            height: getComputedStyle(panel).height, top: panel.style.top,
            skinHeight: getComputedStyle(skinRegion).height,
            generalHeight: getComputedStyle(generalRegion).height,
          };
          if (Object.keys(before).some(key => before[key] !== after[key])) {
            const timing = { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' };
            panelSizeAnimation = panel.animate([
              { height: before.height, top: before.top }, { height: after.height, top: after.top },
            ], timing);
            for (const [region, key] of [[skinRegion, 'skinHeight'], [generalRegion, 'generalHeight']]) {
              if (before[key] !== after[key]) sectionSizeAnimations.push(region.animate([
                { height: before[key], overflow: 'clip' }, { height: after[key], overflow: 'clip' },
              ], timing));
            }
            for (const animation of [panelSizeAnimation, ...sectionSizeAnimations]) animation.startTime = document.timeline.currentTime;
            panelSizeAnimation.onfinish = () => {
              cancelPanelResize();
              placePanel();
            };
          }
        }
      };
      syncSkinUi();

      // Harness may set lang after boot. Update only our own UI, in both
      // directions, without replacing controls or losing focus/listeners.
      const syncLocale = () => {
        copy = selectCopy(options.locale);
        button.querySelector('.bs-launcher-tip').textContent = copy.button;
        button.setAttribute('aria-label', copy.button);
        panel.setAttribute('aria-label', copy.button);
        panel.querySelector('.bs-close').setAttribute('aria-label', copy.close);
        panel.querySelector('.bs-tabs').setAttribute('aria-label', copy.skinTitle);
        panel.querySelector('.bs-skin-heading > label').textContent = copy.skinTitle;
        enabledBox.setAttribute('aria-label', copy.enable);
        for (const tab of tabs) tab.textContent = copy.skins[tab.dataset.skin];
        for (const { skin, param, out } of paramInputs) {
          panel.querySelector(`label[for="${paramDomId(skin, param)}-range"]`).textContent = paramLabel(copy, skin, param);
          out.textContent = paramText(copy, param, paramValue(skin, param));
        }
        for (const [suffix, key] of [['glass-range', 'glass'], ['cycle', 'autoCycle'], ['cosmos-cycle', 'cosmicCycle'], ['chat', 'chatCustom'], ['chat-range', 'chatOpacity']]) {
          panel.querySelector(`label[for="${IDS.panel}-${suffix}"]`).textContent = copy[key];
        }
        for (const group of panel.querySelectorAll('.bs-group-title')) {
          if (group.parentElement?.classList.contains('bs-skin-group')) {
            const id = group.parentElement.id.slice(`${IDS.panel}-`.length);
            const skinId = id === 'cosmos' ? (state.skin === 'vortex' ? 'vortex' : 'horizon') : id;
            group.textContent = `${copy.skins[skinId]} · ${copy.ownTitle}`;
            group.parentElement.setAttribute('aria-label', copy.skins[skinId]);
          } else group.textContent = copy.commonTitle;
        }
        resetBtn.textContent = copy.reset;
        syncReset();
        cancelResetBtn.textContent = copy.cancel;
        confirmResetBtn.textContent = copy.resetConfirm;
        panel.querySelector('.bs-save-hint').textContent = copy.saveHint;
        syncVideoUi();
        for (const help of panel.querySelectorAll('.bs-help')) {
          const key = help.dataset.help;
          help.setAttribute('aria-label', `${copy.params[key] || copy[key]} · ${copy.helpLabel}`);
        }
        if (panelOpen) placePanel();
        if (helpTarget) showHelp(helpTarget);
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
            cosmicSettings().params[param.key] = value;
            void save({ p: state.p });
            postToCosmos();
          }
          out.textContent = paramText(copy, param, value);
          syncReset();
        });
      }

      for (const [index, tab] of tabs.entries()) {
        on(tab, 'click', () => switchSkin(tab.dataset.skin));
        on(tab, 'keydown', (event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          switchSkin(tabs[next].dataset.skin);
          tabs[next].focus();
        });
      }

      on(glassRange, 'input', () => {
        state.glass = clamp(glassRange.value, 40, 90, DEFAULTS.glass);
        glassOut.textContent = `${state.glass}%`;
        updateGlass();
        void save({ glass: state.glass });
        syncReset();
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
        syncReset();
      });
      on(cosmicCycleBox, 'change', () => {
        cosmicSettings().autoCycle = cosmicCycleBox.checked;
        void save({ p: state.p });
        postToCosmos();
        syncReset();
      });
      on(chatBox, 'change', () => {
        state.chatCustom = chatBox.checked;
        void save({ chatCustom: state.chatCustom });
        syncSkinUi();
        updateGlass();
      });
      on(chatRange, 'input', () => {
        state.chatOpacity = clamp(chatRange.value, CHAT_OPACITY_MIN, CHAT_OPACITY_MAX, DEFAULTS.chatOpacity);
        chatOut.textContent = `${state.chatOpacity}%`;
        void save({ chatOpacity: state.chatOpacity });
        updateGlass();
        syncReset();
      });
      on(confirmResetBtn, 'click', () => {
        hideResetConfirm();
        if (resetBtn.disabled) return;
        void save(skinDefaults());
        syncSkinUi();
        updateGlass();
        postToOcean();
        postToCosmos();
        const currentTab = tabs.find(tab => tab.dataset.skin === state.skin);
        currentTab?.focus();
      });

      on(button, 'click', () => setPanelOpen(!panelOpen));
      on(panel.querySelector('.bs-close'), 'click', () => setPanelOpen(false));
      on(document, 'click', (event) => {
        if (helpTarget && !helpTarget.contains(event.target) && !tooltip.contains(event.target)) hideHelp();
        if (panelOpen && !event.composedPath().includes(panel) && !button.contains(event.target) && !tooltip.contains(event.target)) setPanelOpen(false);
      });
      on(document, 'keydown', (event) => {
        if (!panelOpen) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          if (resetConfirm.matches(':popover-open')) { hideResetConfirm(); resetBtn.focus(); return; }
          if (!tooltip.hidden) { hideHelp(); return; }
          setPanelOpen(false);
          return;
        }
        if (event.key !== 'Tab') return;
        // 只看可见的控件：三张皮肤的配置行里有隐藏块与折叠的对话面板滑块
        const focusRoot = resetConfirm.matches(':popover-open') ? resetConfirm : panel;
        const focusable = [...focusRoot.querySelectorAll('button, input')]
          .filter((element) => !element.disabled && element.tabIndex >= 0 && element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      on(window, 'resize', () => { hideHelp(); hideResetConfirm(); cancelPanelResize(); schedulePlace(); });

      on(window, 'message', onSurfaceMessage);
      on(document, 'visibilitychange', onSurfaceVisibility);

      // 鼠标/点击：iframe 是 pointer-events:none 且 aria-hidden，收不到事件，
      // 所以一律在父页监听再经 postMessage 转发进宇宙 iframe（海面皮肤不需要）。
      const pointerPayload = (event) => [
        (event.clientX / window.innerWidth) * 2 - 1,
        1 - (event.clientY / window.innerHeight) * 2,
      ];
      on(document, 'pointermove', (event) => {
        if (!state.enabled || skinById(state.skin).surface !== 'cosmos') return;
        pointerPending = pointerPayload(event);
        schedulePointer();
      }, { passive: true });
      on(document, 'pointerdown', (event) => {
        if (!state.enabled || event.button !== 0 || !frames.get('cosmos')?.ready || skinById(state.skin).surface !== 'cosmos' || cosmicSettings().params.pulse === 0) return;
        if (panel.contains(event.target) || button.contains(event.target) || tooltip.contains(event.target)) return;
        const [x, y] = pointerPayload(event);
        postToFrame(IDS.cosmos, { type: 'bs-pulse', x, y });
      }, { passive: true });

      placementResizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(placementFrame);
        placeButton();
      });
      placementObserver = new MutationObserver((records) => {
        const addedAnchor = records.some(record => [...record.addedNodes].some(node => node instanceof Element
          && (node.matches(anchorSelector) || node.querySelector(anchorSelector))));
        if (addedAnchor) placementAnchor = null;
        if (panelOpen && records.some(record => panel.contains(record.target))) { schedulePlace(); return; }
        if (placementAnchor && !placementAnchor.isConnected) { placementAnchor = null; schedulePlace(); return; }
        if (addedAnchor || records.some(record => placementAnchor && record.target.contains(placementAnchor))) schedulePlace();
      });
      placementObserver.observe(host, { childList: true, subtree: true });
      schedulePlace();
    };

    const unmount = () => {
      removeVideoFrame();
      panelOpen = false;
      panelAnimation?.cancel();
      panelAnimation = null;
      cancelPanelResize();
      placementObserver?.disconnect();
      placementObserver = null;
      placementResizeObserver?.disconnect();
      placementResizeObserver = null;
      placementTargets = [];
      cancelAnimationFrame(placementFrame);
      placementFrame = 0;
      placementAnchor = null;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      pointerPending = pointerSent = null;
      clearSurfaces();
      while (surfaceCleanups.length > 0) surfaceCleanups.pop()();
      if (ownsSurface) {
        document.getElementById(IDS.glass)?.remove();
      }
      if (ownsUi) {
        document.getElementById(IDS.button)?.remove();
        document.getElementById(IDS.panel)?.remove();
        document.getElementById(`${IDS.panel}-help`)?.remove();
        document.getElementById(IDS.uiStyle)?.remove();
        ownsUi = false;
      }
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
        if (state.skin === 'video' && panelOpen) {
          if (!document.getElementById(IDS.video)) void videoAction('list');
          setFrameActive(IDS.video, false);
          setVideoPaused(true);
        } else removeVideoFrame();
        syncVideoUi();
        // Tear down only the surfaces (frames + glass), keeping the
        // button/panel so the skin can be re-enabled from the same page.
        clearSurfaces();
        if (ownsSurface) {
          document.getElementById(IDS.glass)?.remove();
          ownsSurface = false;
        }
        return;
      }
      // The extension and both native paths intentionally share the same ids.
      // 首个挂载的控制器拥有背景，重复入口不能替换或销毁它。
      applySkin();
    };

    const ready = () => new Promise((resolve) => {
      if (document.body) { resolve(); return; }
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });

    const start = async () => {
      const generation = ++startGeneration;
      await ready();
      if (generation !== startGeneration) return;
      try {
        const stored = await options.storage.get(DEFAULTS);
        if (generation !== startGeneration) return;
        state = normalize(stored);
        if (!isRecord(stored.p?.cosmos)
          || ['horizon', 'vortex'].some(id => !isRecord(stored.p?.views?.[id]?.params) || typeof stored.p.views[id].autoCycle !== 'boolean')
          || SKINS.some(({ id }) => !isRecord(stored.p?.general?.[id]) || GENERAL_KEYS.some(key => !Object.hasOwn(stored.p.general[id], key)))) await save({ p: state.p });
      } catch (error) {
        if (generation !== startGeneration) return;
        console.warn('[Backspace] Failed to load settings; using defaults.', error);
      }
      if (generation !== startGeneration) return;
      applyEnabled();
      if (typeof options.listen === 'function') {
        const dispose = options.listen((patch) => {
          if (generation !== startGeneration) return;
          state = mergePatch(patch);
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
      startGeneration++;
      unmount();
      while (controllerCleanups.length > 0) controllerCleanups.pop()();
    };

    return Object.freeze({
      start,
      stop,
      getState: () => normalize(state),
      setSkin: (id) => switchSkin(id),
      getTransitionState: () => ({
        phase: transitionPhase, route: transitionRoute, visible: baseFrame?.skin ?? null,
        requested: state.skin, frameCount: frames.size, duration: transitionDuration, error: transitionError,
      }),
    });
  }

  global.BackspaceSkinCore = Object.freeze({ createController, DEFAULTS, IDS, SKINS });
})(globalThis);

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
    assetUrl: (path) => `/dsh-zed-space/${path}`,
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
