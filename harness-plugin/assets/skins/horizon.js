// 皮肤 A · 事件视界（Horizon）
//
// 视觉命题：忠实复刻参考片 docs/pk-ref/cosmic-black-hole.mp4 的一帧——
//   正圆黑盘（半径 0.160·H，圆心 (0.5, 0.505)）+ 极细高光边 +
//   自右上掠入、绕过盘缘、从右下流出的丝状热流 +
//   深紫罗兰 FBM 星云 + 稀疏星点。
//
// 坐标约定：单位为「画面高度」，原点在画面中心，y 向上。
//   圆心 (0, 0.005)，黑盘半径 0.160。
//
// 通用 uniform 由 shared/cosmos.js 注入：uRes / uTime / uPointer / uCycle /
// uPulsePos / uPulseAge，以及本文件 props 声明的 uGlow…uPull。
//
// 本文件只导出 GLSL 源码与参数定义；渲染与消息协议在 shared/cosmos.js。

export default Object.freeze({
  id: 'horizon',

  // 面板据此生成滑块；uniform 名 = 'u' + key 首字母大写。
  props: Object.freeze([
    Object.freeze({ key: 'glow', min: 0, max: 100, def: 70 }),   // 吸积亮度
    Object.freeze({ key: 'curl', min: 0, max: 100, def: 50 }),   // 细丝曲率
    Object.freeze({ key: 'hue', min: -60, max: 60, def: 0 }),    // 色相偏移
    Object.freeze({ key: 'stars', min: 0, max: 100, def: 45 }),  // 星点密度
    Object.freeze({ key: 'drift', min: 0, max: 100, def: 30 }),  // 流动速度
    Object.freeze({ key: 'pull', min: 0, max: 100, def: 55 }),   // 鼠标引力
  ]),

  fragment: /* glsl */ `
// ---- 噪声 ----------------------------------------------------------------
float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * vnoise(p);
    p = p * 2.02 + vec2(13.7, 7.1);
    amp *= 0.5;
  }
  return sum;
}

// 脊状噪声：1-|2n-1|，细丝的「纤维感」来自这里
float ridge(vec2 p) {
  float sum = 0.0, amp = 0.55;
  for (int i = 0; i < 4; i++) {
    sum += amp * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
    p = p * 2.11 + vec2(3.3, 9.4);
    amp *= 0.55;
  }
  return sum;
}

// 绕亮度轴的近似色相旋转（够用、零查表）
vec3 hueShift(vec3 c, float deg) {
  float a = radians(deg);
  float s = sin(a), k = cos(a);
  const vec3 w = vec3(0.299, 0.587, 0.114);
  return vec3(
    c.r * (w.r + k * (1.0 - w.r)) + c.g * (w.g - k * w.g) + c.b * (w.b - k * w.b) + s * (c.b * w.g - c.g * w.b) * 1.6,
    c.g * (w.g + k * (1.0 - w.g)) + c.r * (w.r - k * w.r) + c.b * (w.b - k * w.b) + s * (c.r * w.b - c.b * w.r) * 1.6,
    c.b * (w.b + k * (1.0 - w.b)) + c.r * (w.r - k * w.r) + c.g * (w.g - k * w.g) + s * (c.g * w.r - c.r * w.g) * 1.6
  );
}

float starLayer(vec2 p, float density, float seed) {
  vec2 g = floor(p);
  vec2 f = fract(p) - 0.5;
  float h = fract(h21(g + seed) * 7.31);
  float on = step(1.0 - density, h);
  vec2 off = vec2(h21(g + seed + 19.3), h21(g + seed + 71.7)) - 0.5;
  float d = length(f - off * 0.72);
  float mag = pow(h21(g + seed + 3.7), 7.0);
  return on * (0.25 + 0.95 * mag) * smoothstep(0.072, 0.0, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float px = 1.0 / uRes.y;

  // 画面坐标：单位 = 高度，y 向上；圆心略低于正中，与参考帧一致
  vec2 sp = vec2((uv.x - 0.5) * aspect, uv.y - 0.495);

  const float R = 0.160;
  float r = length(sp);
  float a = atan(sp.y, sp.x);

  float t = uTime * (0.08 + 1.4 * uDrift / 100.0);

  // 鼠标引力：采样域朝指针轻推，越靠外越明显（近似视差）
  vec2 pull = uPointer * (0.004 + 0.026 * uPull / 100.0);
  vec2 sp2 = sp - pull * smoothstep(0.03, 0.62, r);

  // ==== 星云：域扭曲的紫罗兰 FBM + 脊状纤维 ================================
  vec2 np = sp2 * 1.35;
  float w1 = fbm(np * 1.05 + vec2(3.1, 1.7) + vec2(t * 0.020, -t * 0.014));
  float w2 = fbm(np * 1.75 + vec2(-2.3, 4.4) - vec2(t * 0.016, t * 0.022));
  vec2 wq = np + (vec2(w1, w2) - 0.5) * 1.55;
  float base = fbm(wq * 0.92 + 1.3);
  float wisp = ridge(wq * 2.45 + 7.0);

  // 低频布局：左上更亮、右下更暗，贴近参考帧的整体分布
  float spread = 0.55 + 0.55 * smoothstep(-0.55, 0.75, -(sp2.x + sp2.y * 0.5));
  float cloud = smoothstep(0.26, 0.86, fbm(wq * 0.52 + 21.0 + vec2(t * 0.008, 0.0)));
  float neb = smoothstep(0.22, 0.70, base) * spread;
  float lit = pow(neb, 2.1) * (0.16 + 1.45 * pow(wisp, 2.5)) + pow(cloud, 3.0) * 0.20 * spread;

  vec3 cVoid    = vec3(0.004, 0.004, 0.008);   // #010102
  vec3 cNebDark = vec3(0.031, 0.031, 0.051);   // #08080D
  vec3 cNebMid  = vec3(0.075, 0.071, 0.118);   // #13121E
  vec3 cNebLit  = vec3(0.243, 0.161, 0.255);   // #3E2941

  vec3 col = mix(cVoid, cNebDark, clamp(0.46 + neb * 1.0 + cloud * 0.18, 0.0, 1.0));
  col = mix(col, cNebMid, clamp(lit * 1.9, 0.0, 1.0));
  col = mix(col, cNebLit, pow(lit, 1.05));
  // 长周期昼夜：星云整体冷暖呼吸（复用海面的自动昼夜能力）
  col *= mix(0.84, 1.18, 0.5 + 0.5 * uCycle);

  // ==== 细丝热流：右上掠入 → 绕过盘缘 → 右下流出 ==========================
  float rimNoise = fbm(vec2(a * 2.4, t * 0.08) + 7.0);
  float rimW = 0.0035 + 0.0075 * rimNoise;
  float rim = exp(-pow((r - R - 0.0035) / rimW, 2.0));
  rim *= 0.16 + 0.84 * pow(0.5 + 0.5 * cos(2.0 * a - 1.15), 2.2);

  float wing = mix(0.34, 0.60, uCurl / 100.0);
  // 靠近盘缘时丝带上掠角度更陡，越往外越向右偏，形成参考帧那种斜扫的走向
  float lean = 0.62 * smoothstep(R + 0.02, 0.52, r);
  float upCone = exp(-pow((a + lean - mix(1.16, 1.66, uCurl / 100.0)) / wing, 2.0));
  float dnCone = exp(-pow((a + mix(0.78, 1.16, uCurl / 100.0)) / (wing * 0.82), 2.0)) * 0.62;
  float llCone = exp(-pow((a + mix(2.30, 2.05, uCurl / 100.0)) / (wing * 0.9), 2.0)) * 0.34;
  float armBand = smoothstep(R + 0.003, R + 0.055, r) * (1.0 - smoothstep(0.26, 0.60, r));
  // 两层不同尺度的脊状噪声叠加，避免条纹过于规律
  vec2 sway = vec2(fbm(sp2 * 2.6 + 5.0), fbm(sp2 * 2.6 + 9.0)) - 0.5;
  float strands = ridge(sp2 * vec2(12.0, 4.4) + sway * 3.2 + vec2(t * 0.03, -t * 0.05)) * 0.72
                + ridge(sp2 * vec2(28.0, 9.0) + sway * 5.0 - vec2(t * 0.02, t * 0.04)) * 0.34;
  strands = pow(clamp(strands, 0.0, 1.2), 2.0);
  float arm = (upCone + dnCone + llCone) * armBand * (0.28 + 1.15 * strands);
  // 盘顶 12 点方向的一条淡弧
  arm += exp(-pow((a - 1.57) / 0.85, 2.0)) * smoothstep(R, R + 0.016, r)
       * (1.0 - smoothstep(R + 0.016, R + 0.10, r)) * pow(wisp, 3.0) * 0.85;

  // 点击：热流亮度脉冲 + 涟漪
  float pulse = 0.0;
  if (uPulseAge >= 0.0) {
    vec2 pp = vec2(uPulsePos.x * aspect * 0.5, uPulsePos.y * 0.5 + 0.005);
    float pd = length(sp - pp);
    float ring = 1.0 - smoothstep(0.0, 0.10 + uPulseAge * 0.30, abs(pd - uPulseAge * 0.55));
    pulse = ring * exp(-uPulseAge * 1.5);
  }

  vec3 cBody = vec3(0.655, 0.357, 0.431);      // #A75B6E
  vec3 cCore = vec3(0.957, 0.682, 0.667);      // #F4AEAA
  float gain = 0.38 + 0.95 * uGlow / 100.0;
  float heat = (rim * 1.45 + arm * 0.95) * gain * (1.0 + 0.45 * pulse);
  vec3 hot = mix(cBody, cCore, clamp(heat * 0.85, 0.0, 1.0));
  col += hot * heat;
  col += vec3(1.0, 0.92, 0.90) * pow(clamp(heat, 0.0, 1.2), 3.0) * 0.30;
  // 盘缘外的一点辉光，避免高光像贴上去的圆环
  col += hot * 0.055 * exp(-max(0.0, r - R) * 16.0);

  // ==== 星点 ==============================================================
  float sd = 0.002 + 0.055 * uStars / 100.0;
  float s1 = starLayer(sp2 * 430.0 + 3.0, sd, 0.0);
  float s2 = starLayer(sp2 * 205.0 + 17.0, sd * 0.5, 41.0) * 1.5;
  vec3 starTint = mix(vec3(0.62, 0.68, 0.95), vec3(1.0, 0.86, 0.80), h21(floor(sp2 * 205.0)));
  col += starTint * (s1 + s2) * (0.55 + 0.5 * uStars / 100.0);

  // ==== 色相、暗角、黑盘 ==================================================
  col = hueShift(col, uHue);

  float vig = 1.0 - 0.48 * pow(clamp(length(vec2((uv.x - 0.5) * 1.05, uv.y - 0.5)) * 1.45, 0.0, 1.0), 2.0);
  col *= vig;

  // 黑盘：硬边 + 约 1.5px 抗锯齿；盘内保持纯黑（参考帧盘内亮度 < 0.1%）
  col *= smoothstep(R - px * 1.5, R + px * 1.5, r);
  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`,
});
