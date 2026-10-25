// 一次性原型：跨场景保帧交叠；同一宇宙场景保留自身的视角插值。
import { SCENE_PROPS } from '../shared/skins/accretion.js';

const surfaces = { ocean: 'ocean', horizon: 'cosmos', vortex: 'cosmos' };
const names = { ocean: '海面', horizon: '事件视界', vortex: '吸积涡旋' };

export function createTransitionPreview({ stage, onChange }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? 150 : 550;
  const cosmos = Object.fromEntries(SCENE_PROPS.map(({ key, def }) => [key, def]));
  const ocean = { sea: 50, t: 55, auto: false };
  const records = new Set();
  let base = null;
  let overlay = null;
  let requested = null;
  let phase = 'idle';
  let route = 'initial';
  let error = '';
  let paused = false;
  let disposed = false;
  let animation = null;
  let fadeTarget = 1;
  let nativeTimer = 0;

  const send = (record, data) => record?.frame.contentWindow?.postMessage(data, location.origin);
  const targetRecord = () => [...records].find(record => record.surface === surfaces[requested]);
  const getState = () => ({
    requested, visible: base?.skin ?? null, phase, route, error, paused,
    frameCount: records.size, duration, cosmos: { ...cosmos }, ocean: { ...ocean },
  });
  const notify = () => { if (!disposed) onChange(getState()); };
  const syncRunning = () => {
    const target = targetRecord();
    for (const record of records) {
      if (record.refreshing) { clearTimeout(record.timer); record.refreshing = false; }
      const preparing = !record.ready;
      const running = !document.hidden && (preparing || (!paused && (record === target || (!target?.ready && record === base))));
      if (record.ready && running) record.needsPaint = false;
      send(record, { type: 'bs-pause', paused: !running });
    }
    if (animation) {
      if (document.hidden) animation.pause();
      else animation.play();
    }
  };

  function remove(record) {
    if (!record) return;
    clearTimeout(record.timer);
    record.frame.onload = null;
    record.frame.remove();
    records.delete(record);
  }

  function stopFade() {
    if (!animation) return;
    overlay.frame.style.opacity = getComputedStyle(overlay.frame).opacity;
    animation.cancel();
    animation = null;
  }

  function checkNative() {
    clearTimeout(nativeTimer);
    if (disposed || overlay || !base) return;
    const transitioning = base.surface === 'cosmos' && base.frame.contentWindow.__bsState?.().transitioning;
    phase = transitioning ? 'native' : 'idle';
    notify();
    if (transitioning && !paused && !document.hidden) nativeTimer = setTimeout(checkNative, 150);
  }

  function updateSkin(record, skin) {
    if (record.skin === skin) return false;
    record.skin = skin;
    record.frame.title = `${names[skin]}动态画布`;
    if (record.ready) {
      send(record, { type: 'bs-pause', paused: paused || document.hidden });
      send(record, { type: 'bs-skin', skin, params: { ...cosmos } });
    } else configurePreparingFrame(record);
    return true;
  }

  function finishFade(target) {
    if (target === 1) {
      remove(base);
      base = overlay;
    } else {
      remove(overlay);
    }
    overlay = null;
    base.frame.style.opacity = '1';
    base.frame.style.zIndex = '0';
    animation = null;
    syncRunning();
    checkNative();
  }

  function fadeTo(target) {
    clearTimeout(nativeTimer);
    stopFade();
    fadeTarget = target;
    const from = Number(overlay.frame.style.opacity || 0);
    route = 'crossfade';
    phase = 'crossfade';
    syncRunning();
    notify();
    if (Math.abs(from - target) < 0.001) { finishFade(target); return; }
    const next = overlay.frame.animate([{ opacity: from }, { opacity: target }], {
      duration: duration * Math.abs(target - from),
      easing: 'cubic-bezier(.4,0,.2,1)',
      fill: 'forwards',
    });
    animation = next;
    if (document.hidden) next.pause();
    next.finished.then(() => {
      if (animation !== next || disposed) return;
      overlay.frame.style.opacity = String(target);
      next.cancel();
      finishFade(target);
    }).catch(() => {});
  }

  function fail(record, reason) {
    if (!records.has(record)) return;
    if (animation) stopFade();
    if (record === overlay) overlay = null;
    if (record === base) base = null;
    remove(record);
    error = reason;
    requested = base?.skin ?? requested;
    phase = 'error';
    syncRunning();
    notify();
  }

  function frameReady(record) {
    if (!records.has(record)) return;
    record.ready = true;
    if (!base) {
      base = record;
      overlay = null;
      record.frame.style.opacity = '1';
      phase = 'idle';
      syncRunning();
      notify();
    } else fadeTo(1);
  }

  function configurePreparingFrame(record) {
    if (!record.loaded) return;
    record.configuredFrames = record.frame.contentWindow.__bsState?.().frames ?? 0;
    record.paintedFrames = 0;
    if (record.surface === 'cosmos') {
      // 尚未露出的视角直接落到最新选择，避免冷启动先显示上一个视角。
      send(record, { type: 'bs-pause', paused: true });
      send(record, { type: 'bs-skin', skin: record.skin, params: { ...cosmos } });
      send(record, { type: 'bs-set', params: { ...cosmos }, auto: false });
    } else send(record, { type: 'bs-set', ...ocean });
    send(record, { type: 'bs-pause', paused: document.hidden });
  }

  function mount(skin) {
    const surface = surfaces[skin];
    const query = new URLSearchParams({ parentOrigin: location.origin });
    if (surface === 'cosmos') {
      Object.entries({ skin, controls: 'shared', preview: '1', auto: '0', ...cosmos }).forEach(([key, value]) => query.set(key, value));
    } else Object.entries({ skin: '1', ...ocean, auto: ocean.auto ? '1' : '0' }).forEach(([key, value]) => query.set(key, value));
    const frame = document.createElement('iframe');
    frame.title = `${names[skin]}动态画布`;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.dataset.surface = surface;
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;opacity:0;z-index:1;';
    const record = { frame, skin, surface, ready: false, loaded: false, timer: 0, configuredFrames: 0, paintedFrames: 0 };
    records.add(record);
    frame.onload = () => {
      if (!records.has(record)) return;
      // shortcut: 同源原型读取现有调试钩子；正式接入时替换为首帧协议。
      const style = frame.contentDocument.createElement('style');
      style.textContent = 'body > canvas, #vignette { transition:none !important; } body.ready > canvas, body.ready #vignette { opacity:1 !important; }';
      frame.contentDocument.head.append(style);
      record.loaded = true;
      configurePreparingFrame(record);
      syncRunning();
    };
    frame.src = `../native-dist/${surface === 'cosmos' ? 'cosmos' : 'skin'}.html?${query}`;
    stage.append(frame);
    let waited = 0;
    let stamp = performance.now();
    const waitForFrame = () => {
      if (!records.has(record) || disposed) return;
      const now = performance.now();
      if (!document.hidden) waited += now - stamp;
      stamp = now;
      const state = frame.contentWindow.__bsState?.();
      const canvas = frame.contentDocument?.querySelector('canvas');
      const configured = record.surface === 'cosmos'
        ? state?.drawnSkin === record.skin && SCENE_PROPS.every(({ key }) => state.params[key] === cosmos[key])
        : state && Math.abs(state.sea - (0.25 + ocean.sea / 100 * 1.5)) < 0.00001 && state.manualTimeOfDay === !ocean.auto && (ocean.auto || Math.abs(state.daylight - ocean.t) < 0.00001);
      if (record.loaded && configured && state.frames > record.configuredFrames && canvas?.width > 2 && canvas.height > 2) {
        // 跨两个合成机会再交接，避免只收到绘制提交便把空缓冲露出来。
        if (++record.paintedFrames >= 2) { frameReady(record); return; }
      } else record.paintedFrames = 0;
      if (waited > 20000) { fail(record, `${names[record.skin]}未能准备好，已保留原画面。`); return; }
      record.timer = setTimeout(waitForFrame, 32);
    };
    record.timer = setTimeout(waitForFrame, 32);
    return record;
  }

  function select(skin) {
    if (disposed || !Object.hasOwn(surfaces, skin)) return;
    if (skin === requested && phase !== 'error') return;
    requested = skin;
    error = '';
    clearTimeout(nativeTimer);
    const surface = surfaces[skin];
    if (overlay && !overlay.ready) {
      if (overlay.surface === surface) { updateSkin(overlay, skin); notify(); return; }
      remove(overlay);
      overlay = null;
    }
    if (overlay) {
      const selected = overlay.surface === surface ? overlay : base;
      updateSkin(selected, skin);
      const target = selected === overlay ? 1 : 0;
      if (animation && fadeTarget === target) { syncRunning(); notify(); }
      else fadeTo(target);
      return;
    }
    if (base?.surface === surface) {
      const changed = updateSkin(base, skin);
      route = changed ? 'native' : route;
      phase = changed && !paused && !reducedMotion ? 'native' : 'idle';
      syncRunning();
      notify();
      if (phase === 'native') nativeTimer = setTimeout(checkNative, 2250);
      return;
    }
    route = base ? 'crossfade' : 'initial';
    phase = 'preparing';
    overlay = mount(skin);
    syncRunning();
    notify();
  }

  function setCosmos(params) {
    for (const { key, min, max } of SCENE_PROPS) {
      if (Number.isFinite(params[key])) cosmos[key] = Math.max(min, Math.min(max, params[key]));
    }
    for (const record of records) if (record.surface === 'cosmos') {
      if (record.ready) send(record, { type: 'bs-set', params: { ...cosmos }, auto: false });
      else configurePreparingFrame(record);
    }
    notify();
  }

  function setOcean(params) {
    for (const key of ['sea', 't']) if (Number.isFinite(params[key])) ocean[key] = Math.max(0, Math.min(100, params[key]));
    if (typeof params.auto === 'boolean') ocean.auto = params.auto;
    for (const record of records) if (record.surface === 'ocean') {
      if (record.ready) {
        send(record, { type: 'bs-set', ...ocean });
        record.needsPaint = true;
        refreshPausedOcean(record);
      }
      else configurePreparingFrame(record);
    }
    notify();
  }

  function refreshPausedOcean(record) {
    if (!paused || document.hidden || !record.needsPaint) return;
    clearTimeout(record.timer);
    const before = record.frame.contentWindow.__bsState().frames;
    const deadline = performance.now() + 1000;
    record.refreshing = true;
    send(record, { type: 'bs-pause', paused: false });
    const waitForPaint = () => {
      if (disposed || !records.has(record)) return;
      if (record.frame.contentWindow.__bsState().frames > before) record.needsPaint = false;
      if (!record.needsPaint || !paused || document.hidden || performance.now() >= deadline) {
        record.refreshing = false;
        syncRunning();
        return;
      }
      record.timer = setTimeout(waitForPaint, 16);
    };
    record.timer = setTimeout(waitForPaint, 16);
  }

  function syncVisibility() {
    syncRunning();
    for (const record of records) if (record.ready && record.surface === 'ocean') refreshPausedOcean(record);
    if (paused || document.hidden) clearTimeout(nativeTimer);
    else if (phase === 'native') checkNative();
  }

  function onMessage(event) {
    if (event.origin !== location.origin || event.data?.type !== 'bs-cosmos-error') return;
    const record = [...records].find(item => item.frame.contentWindow === event.source);
    if (record) fail(record, `宇宙场景暂时不可用：${event.data.reason || '渲染失败'}`);
  }

  const interact = (type, x, y) => {
    if (paused || document.hidden || surfaces[requested] !== 'cosmos' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if ((type === 'bs-pointer' && cosmos.parallax === 0) || (type === 'bs-pulse' && cosmos.pulse === 0)) return;
    send(targetRecord(), { type, x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  };

  document.addEventListener('visibilitychange', syncVisibility);
  window.addEventListener('message', onMessage);
  return {
    select, setCosmos, setOcean, getState,
    pointer: (x, y) => interact('bs-pointer', x, y),
    pulse: (x, y) => interact('bs-pulse', x, y),
    setPaused(value) { paused = Boolean(value); syncVisibility(); notify(); },
    dispose() {
      disposed = true;
      animation?.cancel();
      clearTimeout(nativeTimer);
      for (const record of records) remove(record);
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('message', onMessage);
    },
  };
}
