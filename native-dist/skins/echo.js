// 皮肤 D · 余响（Echo）—— 来自 PK-B 的「余响」
//
// 视觉命题：偏心黑盘 + 斜向椭圆轨道回响。与皮肤 B（vortex，正面俯视同心环）
// 是同一参考片的两种读法：vortex 是「你在盘的正上方」；echo 是「盘在你侧前方，
// 轨道被投影成椭圆」。上半圈冷青、下半圈暖铜，多层细环缓慢呼吸。
// 保留 B 的三参数（轨道流速 / 黑盘尺度 / 光环密度）。
//
// 适配点（同 void.js）：B 的 `clock`→`uTime`、`resolution`→`uRes`、
// `settings.xyz`→独立 uniform；移除 mode 分支。

export default Object.freeze({
  id: 'echo',
  props: Object.freeze([
    Object.freeze({ key: 'flow', min: 0, max: 100, def: 35 }),    // 轨道流速
    Object.freeze({ key: 'radius', min: 0, max: 100, def: 50 }),  // 黑盘尺度
    Object.freeze({ key: 'bands', min: 0, max: 100, def: 55 }),   // 光环密度
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

  float clock = uTime * (0.35 + uFlow/100.0 * 1.3);

  p -= vec2(.27,.03);
  float radius = .075 + uRadius*.14;
  float r = length(p);
  float angle = atan(p.y,p.x);
  vec3 col = nebula(p+vec2(.3,-.2),.65)*vec3(.65,.9,1.05);
  vec2 orbit = mat2(.96,-.28,.28,.96)*p;
  float elliptical = length(orbit*vec2(.72,1.9));
  float grain = fbm(p*90.0+vec2(clock*.0008));
  float arc = .0;
  for (int i=0; i<7; i++) {
    float n = float(i);
    float ring = radius+.07+n*.048;
    float drift = .003*sin(angle*4.0+clock*.08+n);
    float dd = abs(elliptical-ring-drift);
    float visible = smoothstep(n/8.0,n/8.0+.12,uBands);
    arc += exp(-dd*(260.0-n*18.0))*visible*(.7+.3*sin(angle*3.0+n+clock*.04));
  }
  float dust = pow(grain,3.0)*3.2;
  vec3 copper = vec3(.69,.35,.23), ice = vec3(.23,.51,.58);
  vec3 hue = mix(copper,ice,smoothstep(-.5,.7,sin(angle)));
  col += hue*arc*dust*.65;
  col += hue*exp(-abs(r-radius)*480.0)*.85;
  col += hue*exp(-abs(r-radius-.015)*48.0)*dust*.13;
  col *= smoothstep(radius-.001,radius+.001,r);

  float edge = 1.0-.22*smoothstep(.4,1.1,length(p+vec2(.27,.03)));
  fragColor = vec4(clamp(col*edge,0.0,1.0),1.0);
}
`,
});
