// 皮肤 B · 吸积涡旋（Vortex）
//
// 视觉命题：同一段参考素材、完全不同的读法——把它从「侧面悬停的静物」读成
// 「正面俯视正在自转的吸积盘」（借鉴 M87/EHT 那张环状照片的构图语言）：
//   中央纯黑空腔 + 贴边的光子环 + 由开普勒差异自转拉出的湍流细丝 +
//   外层紫罗兰晕 + 绕行的星点；点击在盘面上扩散一圈涟漪。
// 调色板仍取自参考帧（void / violet / rose / hot core），保证同源。
//
// 与皮肤 A 的差别：构图（中心环 vs 偏心侧视）、运动（持续自转 vs 极慢漂移）、
// 交互（点击脉冲是主交互 vs 只做鼠标引力），参数集也完全不同。

export default Object.freeze({
  id: 'vortex',

  props: Object.freeze([
    Object.freeze({ key: 'spin', min: 0, max: 100, def: 50 }),      // 自转速度
    Object.freeze({ key: 'ring', min: 0, max: 100, def: 55 }),      // 盘体半径
    Object.freeze({ key: 'turb', min: 0, max: 100, def: 55 }),      // 湍流细丝
    Object.freeze({ key: 'warm', min: 0, max: 100, def: 60 }),      // 温度色相
    Object.freeze({ key: 'pulse', min: 0, max: 100, def: 70 }),     // 点击脉冲
    Object.freeze({ key: 'parallax', min: 0, max: 100, def: 50 }),  // 鼠标视差
  ]),

  fragment: /* glsl */ `
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
    p = p * 2.03 + vec2(5.2, 11.4);
    amp *= 0.5;
  }
  return sum;
}

float ridge(vec2 p) {
  float sum = 0.0, amp = 0.55;
  for (int i = 0; i < 4; i++) {
    sum += amp * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
    p = p * 2.07 + vec2(8.1, 2.9);
    amp *= 0.55;
  }
  return sum;
}

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
  return on * (0.3 + 0.9 * mag) * smoothstep(0.08, 0.0, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float px = 1.0 / uRes.y;

  vec2 sp = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  const float R0 = 0.088;                          // 中央空腔（比 A 小、正中）
  float r = length(sp);
  float a = atan(sp.y, sp.x);

  float spin = 0.25 + 1.75 * uSpin / 100.0;         // 自转
  float turbAmt = uTurb / 100.0;
  float ringR = 0.115 + 0.155 * uRing / 100.0;     // 盘体半径

  // 鼠标视差：整个盘在其中「歪一点」，像探头看
  vec2 par = uPointer * (0.006 + 0.035 * uParallax / 100.0);
  vec2 p = sp - par;

  // ---- 开普勒差异自转：内快外慢，把噪声拉成切向细丝 ---------------------
  float omega = 1.0 / pow(r + 0.055, 1.45);
  float aa = a + uTime * spin * omega * 0.55;
  vec2 dq = vec2(cos(aa), sin(aa)) * (r + 0.02);
  float turb = fbm(dq * vec2(9.0, 6.5) + 2.0);
  float fil = ridge(dq * vec2(26.0, 13.0) + 5.0);

  // ---- 径向结构：空腔边缘极亮的光子环 → 盘体 → 外层晕 --------------------
  float photon = exp(-pow((r - R0 - 0.010) / (0.0035 + 0.004 * turb), 2.0));
  float disk = smoothstep(R0 + 0.004, R0 + 0.035, r) * (1.0 - smoothstep(ringR * 0.72, ringR * 1.45, r));
  float halo = 1.0 - smoothstep(ringR * 1.05, 0.74, r);
  float beam = 0.55 + 0.45 * cos(a - 0.55);         // 多普勒增亮：一侧更热

  float heat = photon * 1.5 + disk * beam * (0.35 + 1.05 * turb) * (0.55 + 0.75 * turbAmt);
  heat += disk * pow(fil, 3.2) * (0.35 + 0.65 * turbAmt) * 1.15 * beam;

  // ---- 点击涟漪：三圈同源脉冲 --------------------------------------------
  float pulse = 0.0;
  if (uPulseAge >= 0.0) {
    vec2 pp = vec2(uPulsePos.x * aspect * 0.5, uPulsePos.y * 0.5);
    float pd = length(sp - pp);
    for (int i = 0; i < 3; i++) {
      float age = uPulseAge - float(i) * 0.16;
      if (age > 0.0) {
        float radius = age * 0.62;
        float width = 0.015 + age * 0.10;
        float ring = exp(-pow((pd - radius) / width, 2.0));
        pulse += ring * exp(-age * 1.5) * (1.0 - float(i) * 0.28);
      }
    }
    pulse *= 0.25 + 0.9 * uPulse / 100.0;
  }

  // ---- 外层旋涡：另一套更慢的角速度，拉出稀疏旋臂填满画面 ------------------
  float outerOmega = 1.0 / pow(r + 0.14, 0.85);
  float oa = a + uTime * spin * outerOmega * 0.20;
  vec2 od = vec2(cos(oa), sin(oa)) * (r + 0.05) * vec2(1.0, 0.85);
  float outer = ridge(od * vec2(5.0, 3.4) + 11.0);
  outer = pow(clamp(outer, 0.0, 1.0), 2.4) * smoothstep(0.16, 0.30, r)
        * (1.0 - smoothstep(0.42, 0.78, r));

  // ---- 调色板（取自参考帧），温度滑块在两极之间插值 ----------------------
  vec3 cVoid    = vec3(0.004, 0.004, 0.008);
  vec3 cNebDark = vec3(0.031, 0.031, 0.051);
  vec3 cNebMid  = vec3(0.075, 0.071, 0.118);
  vec3 cNebLit  = vec3(0.243, 0.161, 0.255);
  vec3 cBody    = vec3(0.655, 0.357, 0.431);
  vec3 cCore    = vec3(0.957, 0.682, 0.667);

  float warm = uWarm / 100.0;
  vec3 body = mix(vec3(0.36, 0.30, 0.62), cBody, warm);     // 冷紫 → 玫瑰
  vec3 core = mix(vec3(0.72, 0.75, 0.98), cCore, warm);     // 冷白 → 暖白

  // 背景：外层晕 + 星云
  float neb = smoothstep(0.32, 0.95, fbm(sp * 1.6 + vec2(0.0, uTime * 0.004)));
  vec3 col = mix(cVoid, cNebDark, smoothstep(0.12, 0.6, neb));
  col = mix(col, cNebMid, pow(neb, 1.8) * 0.8);
  col = mix(col, cNebLit, pow(neb, 3.0) * 0.9 * halo);
  col *= mix(0.88, 1.12, 0.5 + 0.5 * uCycle);

  vec3 hot = mix(body, core, clamp(heat * 0.9, 0.0, 1.0));
  col += hot * heat * 1.45;
  col += mix(cNebLit, body, 0.45) * outer * 0.85 * (0.4 + uTurb / 100.0);
  col += mix(body, core, 0.5) * pulse * (0.8 + 0.6 * disk);

  // ---- 星点：整片随自转缓慢绕行 ------------------------------------------
  float rot = uTime * 0.012 * (0.3 + spin);
  vec2 sr = vec2(cos(rot) * sp.x - sin(rot) * sp.y, sin(rot) * sp.x + cos(rot) * sp.y);
  float stars = starLayer(sr * 400.0 + 9.0, 0.004 + 0.055 * turbAmt, 0.0)
              + starLayer(sr * 170.0 + 23.0, 0.0002 + 0.03 * turbAmt, 53.0) * 1.7;
  col += vec3(0.86, 0.88, 1.0) * stars * (1.05 - 0.45 * smoothstep(0.1, 0.4, r));

  col = hueShift(col, mix(-14.0, 14.0, warm));

  // ---- 空腔：硬边纯黑 -----------------------------------------------------
  float hole = smoothstep(R0 - px * 1.5, R0 + px * 1.5, r);
  col *= hole;

  float vig = 1.0 - 0.55 * pow(clamp(length(uv - 0.5) * 1.38, 0.0, 1.0), 2.0);
  col *= vig;

  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`,
});
