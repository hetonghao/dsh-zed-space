// 事件视界 / 吸积涡旋：同一个吸积场景的两个观察状态，共用 GPU 程序。
//
// 对外协议（父页 ↔ 本帧）：
//   父页 → 本帧
//     { type: 'bs-skin',   skin }            切换皮肤 id（horizon / vortex）
//     { type: 'bs-set',    params, auto }    设置参数 + 公共昼夜开关（controls=shared 使用共用参数）
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
import vortex from './skins/vortex.js';
import accretion, { SCENE_PROPS, sceneParams } from './skins/accretion.js';

const SKINS = new Map([
  [horizon.id, horizon],
  [vortex.id, vortex],
]);
const QUERY = new URLSearchParams(location.search);
const SHARED_CONTROLS = QUERY.get('controls') === 'shared';
const TRANSITION_SECONDS = 2.2;
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

const COSMIC_GLOW = {
  id: 'cosmic-glow', props: [],
  fragment: `
uniform sampler2D uFrame;
uniform float uPixelRatio;
vec3 highlight(vec2 uv) {
  vec3 color = texture(uFrame, uv).rgb;
  float peak = max(color.r, max(color.g, color.b));
  return color * smoothstep(0.35, 0.85, peak);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 pixel = 1.0 / uRes;
  vec2 glowPixel = pixel * uPixelRatio;
  vec3 color = texture(uFrame, uv).rgb;
  vec3 adjacent = (texture(uFrame, uv + vec2(pixel.x, 0.0)).rgb
    + texture(uFrame, uv - vec2(pixel.x, 0.0)).rgb
    + texture(uFrame, uv + vec2(0.0, pixel.y)).rgb
    + texture(uFrame, uv - vec2(0.0, pixel.y)).rgb) * 0.25;
  color = mix(color, adjacent, clamp(length(color - adjacent) * 3.0, 0.0, 0.40));
  vec3 glow = highlight(uv) * 0.20;
  for (int i = 0; i < 8; i++) {
    float angle = float(i) * 0.7853981634;
    vec2 direction = vec2(cos(angle), sin(angle));
    glow += highlight(uv + direction * glowPixel * 3.0) * 0.065;
    glow += highlight(uv + direction * glowPixel * 10.0) * 0.035;
  }
  fragColor = vec4(1.0 - (1.0 - color) * exp(-glow * 0.48), 1.0);
}`,
};

const FRAME_CAP = REDUCED_MOTION ? 20 : 30;
const FRAME_MS = 1000 / FRAME_CAP;
const TARGET_FPS = REDUCED_MOTION ? 18 : 28;
const MIN_SCALE = 0.55;
const START_SCALE = 1.0;
const PIXEL_CAP = 2.0;
const MAX_RENDER_PIXELS = 6_000_000;

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
// 只编译场景与辉光两个程序；视角切换不编译、不创建新画布
// ---------------------------------------------------------------------------

const programs = new Map();
const locations = new Map();
let glowTarget = null;

function cosmicGlowTarget() {
  if (!glowTarget) {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    glowTarget = { texture, framebuffer, width: 0, height: 0 };
  }
  if (glowTarget.width !== canvas.width || glowTarget.height !== canvas.height) {
    gl.bindTexture(gl.TEXTURE_2D, glowTarget.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, glowTarget.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glowTarget.texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Cosmic glow framebuffer unavailable');
    }
    glowTarget.width = canvas.width;
    glowTarget.height = canvas.height;
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return glowTarget;
}

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
  // 按参数声明生成 uniform，避免维护第二份名称列表。
  const own = skin.props.map((prop) => `uniform float ${uniformName(prop.key)};`).join('\n');
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, `${HEAD}${own}\n${skin.fragment}`);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'link failed');
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
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

function propsFor(skin) { return SHARED_CONTROLS ? SCENE_PROPS : skin.props; }

function updateParams(input, base = params) {
  for (const prop of propsFor(activeSkin)) {
    if (input?.[prop.key] === undefined) continue;
    const value = Number(input[prop.key]);
    if (Number.isFinite(value)) base[prop.key] = Math.max(prop.min, Math.min(prop.max, value));
  }
  return base;
}

function defaultsFor(skin) {
  return Object.fromEntries(propsFor(skin).map(prop => {
    const value = Number(QUERY.get(prop.key) ?? prop.def);
    return [prop.key, Number.isFinite(value) ? Math.max(prop.min, Math.min(prop.max, value)) : prop.def];
  }));
}

let activeSkin = SKINS.get(QUERY.get('skin')) || horizon;
let params = defaultsFor(activeSkin);
const savedParams = new Map();
let view = activeSkin.id === 'vortex' ? 1 : 0;
let viewFrom = view;
let viewTarget = view;
let transitionElapsed = TRANSITION_SECONDS;
let targetParams = sceneParams(activeSkin.id, params, SHARED_CONTROLS);
let displayedParams = { ...targetParams };
const parameterUniforms = Object.keys(targetParams).map(key => [key, uniformName(key)]);
let paramsFrom = { ...displayedParams };
const phases = [0, 0];

function advanceScene(dt) {
  transitionElapsed = Math.min(TRANSITION_SECONDS, transitionElapsed + dt);
  const t = transitionElapsed / TRANSITION_SECONDS;
  const blend = t * t * t * (t * (t * 6 - 15) + 10);
  view = viewFrom + (viewTarget - viewFrom) * blend;
  const target = targetParams;
  const parameterBlend = SHARED_CONTROLS ? 1 : blend;
  for (const [key] of parameterUniforms) {
    displayedParams[key] = paramsFrom[key] + (target[key] - paramsFrom[key]) * parameterBlend;
  }
  // 速度改变只影响此后的相位增量，避免贴图在切换或拖动滑杆时跳帧。
  const speed = displayedParams.spin / 50;
  phases[0] = (phases[0] + dt * (0.0896 + (0.0475 - 0.0896) * view) * speed) % (Math.PI * 2);
  phases[1] = (phases[1] + dt * (0.0384 + (0.0175 - 0.0384) * view) * speed) % (Math.PI * 2);
}

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
  const maxDimension = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const dpr = Math.min(window.devicePixelRatio || 1, PIXEL_CAP,
    Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, window.innerWidth * window.innerHeight)),
    maxDimension / Math.max(1, window.innerWidth), maxDimension / Math.max(1, window.innerHeight));
  const width = Math.max(1, Math.floor(window.innerWidth * dpr * scale));
  const height = Math.max(1, Math.floor(window.innerHeight * dpr * scale));
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
  const dt = paused ? 0 : Math.max(0, Math.min((now - lastFrame) / 1000, 0.1));
  lastFrame = now;
  const sceneDt = dt * (REDUCED_MOTION ? 0.12 : 1);
  clock += sceneDt;
  advanceScene(sceneDt);
  // 指针平滑：跟随宿主鼠标，但留一点惯性
  for (let axis = 0; axis < 2; axis++) {
    const delta = pointerTarget[axis] - pointer[axis];
    pointer[axis] = Math.abs(delta) < 0.00001 ? pointerTarget[axis] : pointer[axis] + delta * Math.min(1, dt * 6);
  }
  // 十秒后脉冲已低于 8 位颜色精度，清除尾迹以允许静止画面休眠。
  if (pulseAt >= 0 && (displayedParams.pulse === 0 || clock - pulseAt >= 10)) pulseAt = -1;

  if (now - lastRender < FRAME_MS - 0.5) return false;
  lastRender = now;

  try {
    // 先调整尺寸再绘制，避免画质恢复时清空刚画好的帧。
    if (!paused && now - adaptStart >= 1500) {
      const measured = (framesSinceAdapt * 1000) / (now - adaptStart);
      framesSinceAdapt = 0;
      adaptStart = now;
      if (measured > 0) {
        if (measured < TARGET_FPS - 6 && scale > MIN_SCALE) {
          scale = Math.max(MIN_SCALE, +(scale * 0.92).toFixed(3));
          applySize();
        } else if (measured > TARGET_FPS && scale < 1) {
          scale = Math.min(1, +(scale * 1.05).toFixed(3));
          applySize();
        }
      }
    }
    const program = programFor(accretion);
    const glow = cosmicGlowTarget();
    const glowProgram = programFor(COSMIC_GLOW);
    gl.bindFramebuffer(gl.FRAMEBUFFER, glow.framebuffer);
    gl.useProgram(program);
    gl.uniform2f(locate(program, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(locate(program, 'uTime'), clock);
    gl.uniform1f(locate(program, 'uView'), view);
    gl.uniform2f(locate(program, 'uPhase'), phases[0], phases[1]);
    gl.uniform2f(locate(program, 'uPointer'), pointer[0], pointer[1]);
    gl.uniform1f(locate(program, 'uCycle'), autoCycle ? Math.sin((clock / 720) * Math.PI * 2) : 0);
    gl.uniform2f(locate(program, 'uPulsePos'), pulsePos[0], pulsePos[1]);
    gl.uniform1f(locate(program, 'uPulseAge'), pulseAt < 0 ? -1 : (clock - pulseAt));
    for (const [key, name] of parameterUniforms) {
      const value = locate(program, name);
      if (value) gl.uniform1f(value, displayedParams[key]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(glowProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, glow.texture);
    gl.uniform1i(locate(glowProgram, 'uFrame'), 0);
    gl.uniform2f(locate(glowProgram, 'uRes'), canvas.width, canvas.height);
    gl.uniform1f(locate(glowProgram, 'uPixelRatio'), canvas.height / Math.max(1, window.innerHeight));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(program);
    drawnSkin = transitionElapsed >= TRANSITION_SECONDS ? activeSkin.id : null;
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
    fpsWindowStart = adaptStart = firstFrameMs;
    frames = framesSinceAdapt = 0;
    post({ type: 'bs-cosmos-ready', skin: activeSkin.id });
  }

  // 统计最近半秒的实际帧率。
  const span = now - fpsWindowStart;
  if (span >= 500) {
    fps = (frames * 1000) / span;
    frames = 0;
    fpsWindowStart = now;
  }
  return true;
}

// 静止时保留已合成的画面；只有仍会改变像素的输入才维持渲染。
function needsAnimation() {
  return autoCycle || displayedParams.spin > 0 || transitionElapsed < TRANSITION_SECONDS
    || pulseAt >= 0 || pointer.some((value, axis) => value !== pointerTarget[axis]);
}

function tick(now) {
  raf = 0;
  const drawn = render(now);
  if (!errorReported && !paused && !document.hidden && (!drawn || needsAnimation())) {
    raf = requestAnimationFrame(tick);
  } else {
    if (!errorReported && !paused && !document.hidden && scale < 1) {
      scale = 1;
      applySize();
      redraw();
    }
    fps = 0;
  }
}

function start() {
  if (!gl || errorReported || paused || document.hidden || raf) return;
  lastFrame = performance.now();
  fpsWindowStart = adaptStart = lastFrame;
  frames = framesSinceAdapt = 0;
  lastRender = 0;
  raf = requestAnimationFrame(tick);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  fps = 0;
}

function redraw() {
  // 暂停时尺寸变化也要补一帧，否则画面会被拉伸
  lastRender = 0;
  lastFrame = performance.now();
  if (!raf) {
    fpsWindowStart = adaptStart = lastFrame;
    frames = framesSinceAdapt = 0;
  }
  render(lastFrame);
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
    if (data.skin !== activeSkin.id) {
      savedParams.set(activeSkin.id, { ...params });
      paramsFrom = { ...displayedParams };
      activeSkin = SKINS.get(data.skin);
      if (!SHARED_CONTROLS) params = savedParams.get(data.skin) || defaultsFor(activeSkin);
      viewFrom = view;
      viewTarget = data.skin === 'vortex' ? 1 : 0;
      transitionElapsed = paused || REDUCED_MOTION ? TRANSITION_SECONDS : 0;
    }
    updateParams(data.params);
    targetParams = sceneParams(activeSkin.id, params, SHARED_CONTROLS);
    if (paused && data.params) paramsFrom = { ...targetParams };
    redraw();
    if (needsAnimation()) start();
  } else if (data.type === 'bs-set') {
    updateParams(data.params);
    targetParams = sceneParams(activeSkin.id, params, SHARED_CONTROLS);
    if (paused && data.params) paramsFrom = { ...targetParams };
    if (data.auto !== undefined) autoCycle = data.auto !== false;
    if (paused) redraw(); else start();
  } else if (data.type === 'bs-pointer') {
    const x = Number(data.x);
    const y = Number(data.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pointerTarget = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
      if (paused) {
        pointer = [...pointerTarget];
        redraw();
      } else start();
    }
  } else if (data.type === 'bs-pulse') {
    const x = Number(data.x);
    const y = Number(data.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pulsePos = [x, y];
      pulseAt = clock;
      if (paused) redraw(); else start();
    }
  } else if (data.type === 'bs-pause') {
    paused = data.paused !== false;
    if (paused) stop(); else start();
  }
});

window.addEventListener('resize', () => {
  if (!gl) return;
  applySize();
  redraw();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop(); else start();
});

// 自动化自检用的读数（与 shared/ocean.js 的 __bsState 对应）
window.__bsState = () => ({
  skin: activeSkin.id,
  drawnSkin,
  scene: accretion.id,
  view,
  transitioning: transitionElapsed < TRANSITION_SECONDS,
  phases: [...phases],
  programs: programs.size,
  params: { ...params },
  autoCycle,
  fps,
  renderScale: scale,
  paused,
  idle: ready && !paused && !raf && !document.hidden,
  frameCap: FRAME_CAP,
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
