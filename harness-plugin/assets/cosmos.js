// 宇宙皮肤引导分派器（皮肤 A / B 共用的一块 WebGL2 画布）
//
// 为什么是一个页面装两个皮肤：切换皮肤时不能刷新宿主页面，也不该重建 GPU 上下文。
// 两张皮肤都是整屏片元着色器，编译一次、切 program 即可，切换耗时 < 1 帧。
//
// 对外协议（父页 ↔ 本帧）：
//   父页 → 本帧
//     { type: 'bs-skin',   skin }            切换皮肤 id（horizon / void / vortex / echo）
//     { type: 'bs-set',    params, auto }    设置当前皮肤的独立参数 + 公共昼夜开关
//     { type: 'bs-pointer', x, y }           鼠标位置（-1..1，y 向上）
//     { type: 'bs-pulse',  x, y }            点击脉冲（-1..1，y 向上）
//     { type: 'bs-pause',  paused }          暂停/恢复渲染（父页隐藏本帧时）
//   本帧 → 父页
//     { type: 'bs-cosmos-ready', skin }      首帧渲染成功（父页据此确认皮肤可用）
//     { type: 'bs-cosmos-error', reason }    WebGL2 不可用 / 着色器编译失败（父页回退海面）
//
// 安全：与 shared/ocean.js 一致，只接受 window.parent 且 origin 匹配父页的消息。
// 本文件与皮肤源码都在包内，无外部请求、无素材文件。

import horizon from './skins/horizon.js';
import voidSkin from './skins/void.js';
import echoSkin from './skins/echo.js';
import vortex from './skins/vortex.js';

const SKINS = new Map([
  [horizon.id, horizon],
  [voidSkin.id, voidSkin],
  [vortex.id, vortex],
  [echoSkin.id, echoSkin],
]);
const QUERY = new URLSearchParams(location.search);
const PARENT_ORIGIN = QUERY.get('parentOrigin') || '';
const REDUCED_MOTION = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

const VERT = `#version 300 es
void main() {
  // 无缓冲全屏三角形：3 个顶点覆盖整个裁剪空间
  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

// 皮肤片元着色器只需实现 main()，通用 uniform 由这里统一注入。
const HEAD = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uCycle;
uniform vec2 uPulsePos;
uniform float uPulseAge;
`;

const FRAME_CAP = REDUCED_MOTION ? 20 : 40;
const FRAME_MS = 1000 / FRAME_CAP;
const TARGET_FPS = REDUCED_MOTION ? 18 : 34;
const MIN_SCALE = 0.55;
const START_SCALE = REDUCED_MOTION ? 0.7 : 0.9;
const PIXEL_CAP = 1.0;

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;background:#000;';
document.body.appendChild(canvas);

const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'low-power',
});
document.body.classList.add('ready');

function post(message) {
  try {
    window.parent.postMessage(message, PARENT_ORIGIN || '*');
  } catch (error) {
    console.warn('[Backspace] postMessage failed', error);
  }
}

if (!gl) {
  post({ type: 'bs-cosmos-error', reason: 'WebGL2 unavailable' });
}

// ---------------------------------------------------------------------------
// 程序缓存：每张皮肤一份，切换皮肤只换 program，不重建上下文
// ---------------------------------------------------------------------------

const programs = new Map();
const locations = new Map();

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function programFor(skin) {
  if (programs.has(skin.id)) return programs.get(skin.id);
  const program = gl.createProgram();
  // 每个皮肤自己的参数按 props 声明成 float uniform，皮肤源码里直接用 uGlow 等，
  // 不必在两处维护同一份 uniform 名单。
  const own = skin.props.map((prop) => `uniform float ${uniformName(prop.key)};`).join('\n');
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, `${HEAD}${own}\n${skin.fragment}`);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'link failed');
  }
  programs.set(skin.id, program);
  return program;
}

function locate(program, name) {
  let table = locations.get(program);
  if (!table) { table = new Map(); locations.set(program, table); }
  if (!table.has(name)) table.set(name, gl.getUniformLocation(program, name));
  return table.get(name);
}

const uniformName = (key) => `u${key[0].toUpperCase()}${key.slice(1)}`;

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

function defaultsFor(skin) {
  const out = {};
  for (const prop of skin.props) out[prop.key] = Number(QUERY.get(prop.key) ?? prop.def);
  return out;
}

let activeSkin = SKINS.get(QUERY.get('skin')) || horizon;
let params = defaultsFor(activeSkin);
let autoCycle = QUERY.get('auto') !== '0';
let paused = false;
let pointer = [0, 0];
let pointerTarget = [0, 0];
let pulseAt = -1;
let pulsePos = [0, 0];
let clock = 0;

let scale = START_SCALE;
let fps = 0;
let frames = 0;
let fpsWindowStart = performance.now();
let adaptStart = performance.now();
let framesSinceAdapt = 0;
let lastRender = 0;
let lastFrame = performance.now();
let firstFrameMs = -1;
let drawnSkin = null;
let frameCount = 0;
let raf = 0;
let ready = false;

let errorReported = false;
function fail(error) {
  console.error('[Backspace] cosmic skin failed:', error);
  if (!errorReported) {
    errorReported = true;
    post({ type: 'bs-cosmos-error', reason: String(error && error.message ? error.message : error) });
  }
}

// ---------------------------------------------------------------------------
// 尺寸与自适应分辨率
// ---------------------------------------------------------------------------

function applySize() {
  const dpr = Math.min(window.devicePixelRatio || 1, PIXEL_CAP);
  const width = Math.max(1, Math.round(window.innerWidth * dpr * scale));
  const height = Math.max(1, Math.round(window.innerHeight * dpr * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// 渲染循环
// ---------------------------------------------------------------------------

function render(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  clock += dt * (REDUCED_MOTION ? 0.12 : 1);
  // 指针平滑：跟随宿主鼠标，但留一点惯性
  pointer[0] += (pointerTarget[0] - pointer[0]) * Math.min(1, dt * 6);
  pointer[1] += (pointerTarget[1] - pointer[1]) * Math.min(1, dt * 6);

  if (now - lastRender < FRAME_MS - 0.5) return;
  lastRender = now;

  try {
    const program = programFor(activeSkin);
    gl.useProgram(program);
    gl.uniform2f(locate(program, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(locate(program, 'uTime'), clock);
    gl.uniform2f(locate(program, 'uPointer'), pointer[0], pointer[1]);
    gl.uniform1f(locate(program, 'uCycle'), autoCycle ? Math.sin((clock / 720) * Math.PI * 2) : 0);
    gl.uniform2f(locate(program, 'uPulsePos'), pulsePos[0], pulsePos[1]);
    gl.uniform1f(locate(program, 'uPulseAge'), pulseAt < 0 ? -1 : (now - pulseAt) / 1000);
    for (const key of Object.keys(params)) {
      const value = locate(program, uniformName(key));
      if (value) gl.uniform1f(value, params[key]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    drawnSkin = activeSkin.id;
    frameCount += 1;
  } catch (error) {
    fail(error);
    stop();
    return;
  }

  frames += 1;
  framesSinceAdapt += 1;
  if (!ready) {
    ready = true;
    firstFrameMs = performance.now();
    post({ type: 'bs-cosmos-ready', skin: activeSkin.id });
  }

  // 帧率与自适应分辨率（每 1.5 秒评估一次，与海面渲染器同一套策略）
  const span = now - fpsWindowStart;
  if (span >= 500) {
    fps = (frames * 1000) / span;
    frames = 0;
    fpsWindowStart = now;
  }
  if (now - adaptStart >= 1500) {
    const measured = (framesSinceAdapt * 1000) / (now - adaptStart);
    framesSinceAdapt = 0;
    adaptStart = now;
    if (measured > 0) {
      if (measured < TARGET_FPS - 6 && scale > MIN_SCALE) {
        scale = Math.max(MIN_SCALE, +(scale * 0.92).toFixed(3));
        applySize();
      } else if (measured > TARGET_FPS + 8 && scale < 1) {
        scale = Math.min(1, +(scale * 1.05).toFixed(3));
        applySize();
      }
    }
  }
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  render(now);
}

function start() {
  if (paused || raf) return;
  lastFrame = performance.now();
  lastRender = 0;
  raf = requestAnimationFrame(tick);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function redraw() {
  // 暂停时尺寸变化也要补一帧，否则画面会被拉伸
  lastRender = 0;
  render(performance.now());
}

// ---------------------------------------------------------------------------
// 消息
// ---------------------------------------------------------------------------

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  if (PARENT_ORIGIN && event.origin !== PARENT_ORIGIN) return;
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'bs-skin' && SKINS.has(data.skin)) {
    activeSkin = SKINS.get(data.skin);
    params = defaultsFor(activeSkin);
    for (const key of Object.keys(params)) {
      if (data.params && Number.isFinite(Number(data.params[key]))) params[key] = Number(data.params[key]);
    }
    // 编译新皮肤；失败由 render() 的 try 捕获并上报，父页回退海面
    try {
      programFor(activeSkin);
    } catch (error) {
      fail(error);
    }
    redraw();
  } else if (data.type === 'bs-set') {
    if (data.params && typeof data.params === 'object') {
      for (const key of Object.keys(params)) {
        if (Number.isFinite(Number(data.params[key]))) params[key] = Number(data.params[key]);
      }
    }
    if (data.auto !== undefined) autoCycle = data.auto !== false;
  } else if (data.type === 'bs-pointer') {
    const x = Number(data.x);
    const y = Number(data.y);
    if (Number.isFinite(x) && Number.isFinite(y)) pointerTarget = [x, y];
  } else if (data.type === 'bs-pulse') {
    const x = Number(data.x);
    const y = Number(data.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pulsePos = [x, y];
      pulseAt = performance.now();
    }
  } else if (data.type === 'bs-pause') {
    paused = data.paused !== false;
    if (paused) stop(); else start();
  }
});

window.addEventListener('resize', () => {
  applySize();
  if (raf) redraw();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop(); else start();
});

// 自动化自检用的读数（与 shared/ocean.js 的 __bsState 对应）
window.__bsState = () => ({
  skin: activeSkin.id,
  drawnSkin,
  params: { ...params },
  autoCycle,
  fps,
  renderScale: scale,
  paused,
  frames: frameCount,
  firstFrameMs,
  drawingBuffer: [canvas.width, canvas.height],
  webgl2: Boolean(gl),
});

if (gl) {
  try {
    applySize();
    start();
  } catch (error) {
    fail(error);
  }
}
