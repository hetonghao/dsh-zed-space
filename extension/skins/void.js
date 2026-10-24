// 皮肤 C · 深渊（Void）—— 来自 PK-B 的「事件视界」
//
// 视觉命题：与皮肤 A（horizon）同源同构图，但走另一条近似路线——
//   A 用「锥 × 带 × 脊噪声」解析构造丝带；C 用「路径函数 + 域扭曲 + 纤维噪声」，
//   星云密度更厚（这是 PK-B 在并排对照里唯一明显胜过 A 的地方）。
// 保留 B 的三参数（流速 / 辉光 / 星云浓度），映射到 A 的 props 契约。
//
// 注意：本文件的 GLSL 主干直接取自 PK-B 的 shared/cosmic.js，只做了两处适配：
//   1. B 用 `clock`（秒，已乘流速）、`resolution`、`settings.xyz`；
//      这里改用 A 的 `uTime`（秒）、`uRes`、独立 float uniform。
//   2. B 的 main() 里带 mode 分支与本文件无关，移除；末尾 vignette 保留。

export default Object.freeze({
  id: 'void',
  props: Object.freeze([
    Object.freeze({ key: 'flow', min: 0, max: 100, def: 20 }),   // 细丝流速
    Object.freeze({ key: 'glow', min: 0, max: 100, def: 50 }),   // 细丝辉光
    Object.freeze({ key: 'cloud', min: 0, max: 100, def: 50 }),  // 星云浓度
  ]),
  fragment: /* glsl */ `
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = .52;
  for (int i=0; i<5; i++) {
    v += a*noise(p);
    p = mat2(.8,-.6,.6,.8)*p*2.03 + 13.7;
    a *= .48;
  }
  return v;
}
float starField(vec2 p, float scale, float threshold) {
  vec2 g = p*scale;
  vec2 cell = floor(g);
  vec2 at = vec2(hash(cell+12.8), hash(cell+78.1));
  float d = length(fract(g)-at);
  float seed = hash(cell);
  return step(threshold, seed)*exp(-d*d*300.0)*(.22+.78*hash(cell+19.0));
}
vec3 nebula(vec2 p, float amount) {
  vec2 q = p*4.0;
  vec2 warp = vec2(fbm(q+8.3), fbm(q-3.2));
  float clouds = fbm(q*3.0+warp*3.0);
  float fine = fbm(p*150.0+warp*6.0);
  float lane = exp(-pow((p.x+.72*p.y+.17)*3.5, 2.0));
  float dust = smoothstep(.38,.69,clouds)*pow(fine,2.1);
  vec3 col = vec3(.011,.012,.021) + vec3(.028,.027,.043)*fine;
  col += vec3(.32,.18,.31)*dust*(.15+lane*2.1)*amount;
  col *= .35+.9*smoothstep(.3,.58,fbm(p*14.0+warp*1.5));
  col += vec3(.49,.45,.57)*(starField(p+2.0,380.0,.965)*.65+starField(p-9.0,100.0,.975));
  return col;
}

void main() {
  vec2 p = (gl_FragCoord.xy - uRes*.5)/uRes.y;
  p.y += .005;

  float radius = .160;
  float r = length(p), angle = atan(p.y,p.x);
  float flow = uTime * uFlow * .0125;
  vec2 warp = vec2(fbm(p*8.0),fbm(p*8.0+9.0));
  vec3 col = nebula(p, uCloud*2.0);
  float distortion = (fbm(p*38.0+warp*5.0+flow)-.5);
  float outer = r-radius;
  float rim = exp(-abs(outer)*650.0);
  float ring = exp(-abs(outer-.009-distortion*.018)*85.0);
  float ringThread = .25+pow(fbm(vec2(angle*11.0+flow,outer*310.0)+warp*3.0),3.0)*6.0;
  float upper = smoothstep(.09,.19,p.y);
  float path = .105 - .58*(p.y-.19) + .028*sin((p.y-.16)*23.0)+.025*(noise(vec2(p.y*19.0,3.0))-.5);
  float width = .025 + .19*max(p.y-.16,0.0);
  float d = (p.x-path+distortion*.047)/width;
  float plume = exp(-d*d*.7)*upper;
  float thread = fbm(vec2((p.x-path)*190.0,p.y*35.0-flow*6.0)+warp*9.0);
  float fibers = pow(thread,3.0)*3.8*(.5+fbm(p*110.0+flow)*1.5);
  float lowerPath = .34*(-p.y-.16) + .027*sin(p.y*22.0);
  float tail = exp(-pow((p.x-lowerPath+distortion*.06)/.047,2.0))*smoothstep(.13,.24,-p.y)*exp((p.y+.16)*6.0);
  float lowerThread = pow(fbm(vec2((p.x-lowerPath)*160.0,p.y*28.0+flow*4.0)+warp*7.0),3.0)*3.0;
  float energy = plume*(fibers+.09)*1.8 + ring*ringThread*(.8+.45*sin(angle*2.0)) + tail*lowerThread;
  float hot = exp(-length((p-vec2(.105,.123))*vec2(1.0,1.8))*95.0);
  float gain = uGlow*2.0;
  col += vec3(.74,.33,.41)*energy*gain;
  col += vec3(1.0,.71,.65)*pow(max(energy-.4,0.0),1.45)*gain;
  col += vec3(.91,.49,.54)*rim*(.5+.3*noise(vec2(angle*22.0,1.0)))*gain;
  col += vec3(1.0,.78,.73)*hot*4.8*gain;
  col += vec3(.6,.35,.52)*exp(-abs(p.y-.123)*1800.0)*exp(-abs(p.x-.105)*25.0)*.3*gain;
  col = 1.0-exp(-col);
  col *= smoothstep(radius-.001,radius+.0008,r);

  float edge = 1.0-.22*smoothstep(.4,1.1,length(p));
  fragColor = vec4(clamp(col*edge,0.0,1.0),1.0);
}
`,
});
