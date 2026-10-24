// 两个观察状态共用盘体、星空、光线积分和参数；端点保留各自的材质标定。
export const SCENE_PROPS = Object.freeze([
  { key: 'glow', min: 0, max: 100, def: 70, label: '吸积亮度' },
  { key: 'ring', min: 0, max: 100, def: 55, label: '盘体尺度' },
  { key: 'turb', min: 0, max: 100, def: 55, label: '气流细节' },
  { key: 'warm', min: 0, max: 100, def: 60, label: '气体色温' },
  { key: 'spin', min: 0, max: 100, def: 50, label: '流动速度' },
  { key: 'stars', min: 0, max: 100, def: 45, label: '星空浓度' },
  { key: 'parallax', min: 0, max: 100, def: 55, label: '鼠标视差' },
  { key: 'pulse', min: 0, max: 100, def: 70, label: '点击涟漪' },
].map(Object.freeze));

// 宿主仍可发送已保存的旧参数，预览直接使用同一组参数。
export function sceneParams(id, params, shared = false) {
  const result = Object.fromEntries(SCENE_PROPS.map(p => [p.key, p.def]));
  if (shared || id === 'vortex') Object.assign(result, params);
  else Object.assign(result, {
    glow: params.glow, turb: params.curl + 5, stars: params.stars,
    spin: (0.025 + 0.0013 * params.drift) / 0.064 * 50,
    parallax: params.pull,
  });
  result.hue = !shared && id === 'horizon' ? params.hue : 0;
  return result;
}

export default Object.freeze({
  id: 'accretion',
  props: SCENE_PROPS,
  fragment: /* glsl */ `
uniform float uView;
uniform vec2 uPhase;
uniform float uHue;
const float TAU = 6.28318530718;
const float CORE = 0.245;
float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
    mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amp * vnoise(p);
    p = p * mix(2.02, 2.03, uView) + mix(vec2(13.7, 7.1), vec2(5.2, 11.4), uView);
    amp *= 0.5;
  }
  return sum;
}
// 星空的噪声域固定在世界坐标，不随材质状态变化。
float skyNoise(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amp * vnoise(p);
    p = p * 2.03 + vec2(5.2, 11.4);
    amp *= 0.5;
  }
  return sum;
}
vec3 hueShift(vec3 c, float deg) {
  float a = radians(deg), s = sin(a), k = cos(a);
  const vec3 w = vec3(0.299, 0.587, 0.114);
  return vec3(
    c.r * (w.r + k * (1.0-w.r)) + c.g * (w.g-k*w.g) + c.b * (w.b-k*w.b) + s * (c.b*w.g-c.g*w.b)*1.6,
    c.g * (w.g + k * (1.0-w.g)) + c.r * (w.r-k*w.r) + c.b * (w.b-k*w.b) + s * (c.r*w.b-c.b*w.r)*1.6,
    c.b * (w.b + k * (1.0-w.b)) + c.r * (w.r-k*w.r) + c.g * (w.g-k*w.g) + s * (c.g*w.r-c.r*w.g)*1.6);
}
vec3 roseTemperature(vec3 color) {
  color = mix(color * vec3(0.38, 0.75, 1.3), color, clamp(uWarm / 60.0, 0.0, 1.0));
  color *= mix(vec3(1.0), vec3(1.15, 1.0, 0.62), clamp((uWarm - 60.0) / 40.0, 0.0, 1.0));
  return hueShift(color, uHue);
}
mat2 rotation(float a) { return mat2(cos(a), sin(a), -sin(a), cos(a)); }
vec3 worldFrame(vec3 p) {
  p.xy = rotation(radians(mix(12.0, -20.0, uView))) * p.xy;
  p.yz = rotation(radians(mix(78.0, 32.0, uView))) * p.yz;
  return p;
}
float diskHeight(float r) {
  return -0.23 * uView * exp(-max(r - 0.30, 0.0) * 2.8);
}
vec3 starField(vec2 p, float pixel, float seed, float density, float period) {
  vec2 cell = floor(p);
  cell.x = mod(cell.x, period);
  if (h21(cell + seed) < 1.0 - density) return vec3(0.0);
  vec2 offset = vec2(h21(cell + seed + 19.3), h21(cell + seed + 71.7)) - 0.5;
  float d = length(fract(p) - 0.5 - offset * 0.78);
  float magnitude = pow(h21(cell + seed + 3.1), 5.0);
  float width = max(0.018 + magnitude * 0.022, pixel * 0.75);
  float point = 1.0 - smoothstep(0.0, width, d);
  float halo = exp(-pow(d / (width * 3.5), 2.0)) * magnitude * magnitude * 0.035;
  vec3 tint = mix(vec3(0.48, 0.64, 0.95), vec3(1.0, 0.74, 0.50), h21(cell + seed + 8.5));
  return mix(tint, vec3(1.0), magnitude * 0.35) * ((0.35 + magnitude * 1.5) * point + halo);
}
vec3 background(vec3 direction, float pixel) {
  // 固定星空轴，球面经纬投影不再把前后半球折叠在一起。
  direction.yz = rotation(radians(-32.0)) * direction.yz;
  direction.xy = rotation(radians(20.0)) * direction.xy;
  float longitude = atan(direction.x, -direction.z);
  float latitude = asin(clamp(direction.y, -1.0, 1.0));
  vec2 p = vec2(longitude, latitude) * 1.55;
  vec2 cloudP = vec2(sin(longitude), latitude) * 3.41 + vec2(11.0, 5.0);
  vec2 warp = vec2(skyNoise(cloudP), skyNoise(cloudP + 7.0));
  vec2 domain = cloudP + warp * 1.7;
  float cloud = skyNoise(domain), detail = skyNoise(domain * 3.5 + 3.0);
  float dust = smoothstep(0.32, 0.70, skyNoise(domain * 1.8 + 19.0));
  float band = exp(-pow((p.y + sin(longitude) * 0.85 - 0.10 + (warp.x-0.45)*0.32)/0.30, 2.0));
  float starlight = band * (0.20+0.80*smoothstep(0.20,0.65,cloud)) * (0.60+detail) * (1.0-dust*0.55);
  vec3 col = vec3(0.003,0.005,0.013);
  col += mix(vec3(0.060,0.080,0.22), vec3(0.18,0.090,0.17),warp.x) * min(starlight,0.5)*2.2;
  float amount = uStars / 45.0;
  // 整数经向格数保证星点在球面接缝处一致；视角变化只改变观察方向。
  vec2 spherical = vec2(longitude / TAU + 0.5, latitude / TAU);
  col += starField(spherical*1364.0, pixel*140.0,0.0,(0.025+band*0.080)*amount,1364.0)*0.35;
  col += starField(spherical*536.0, pixel*55.0,37.0,(0.025+band*0.040)*amount,536.0)*0.95;
  col += starField(spherical*176.0, pixel*18.0,83.0,0.050*amount,176.0)*1.2;
  return col;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 screen = vec2((uv.x-0.5)*aspect,uv.y-0.5);
  float fit = min(1.0, aspect/mix(1.1,1.05,uView));
  vec2 p = screen / fit;
  float pixel = 1.0/uRes.y/fit;
  // 黑洞半径不变；将旧侧视构图按相同比例换算到世界单位。
  float units = mix(CORE/0.275, 1.0, uView);
  vec3 eye = vec3(uPointer*mix(vec2(0.80,0.50),vec2(0.85,0.65),uView)*uParallax/100.0,
    mix(3.7,3.8,uView)) * units;
  vec3 forward = normalize(-eye);
  vec3 right = normalize(cross(forward,vec3(0.0,1.0,0.0)));
  vec3 up = cross(right,forward);
  vec3 ray = worldFrame(normalize(forward*mix(1.75,1.55,uView)+p.x*right+p.y*up));
  eye = worldFrame(eye);
  float outerRadius = mix(1.50*units,1.345,uView) + (uRing-55.0)*0.009;
  float bound = outerRadius+0.25;
  float innerRadius = mix(0.38*units,0.32,uView);
  float turbulence = max(0.0,uTurb-mix(5.0,0.0,uView))/100.0;
  float warmth = pow(uWarm/100.0,0.55);
  float pulse = 0.0;
  if (uPulseAge >= 0.0) {
    vec2 click = vec2(uPulsePos.x*aspect*0.5,uPulsePos.y*0.5);
    float d = length(screen-click);
    pulse = exp(-pow((d-uPulseAge*mix(0.4,0.32,uView))/mix(0.08,0.06,uView),2.0))
      * exp(-uPulseAge*mix(1.6,1.4,uView))*uPulse/100.0;
  }
  float gain = (0.50+1.35*uGlow/100.0)/1.445;
  vec3 light = vec3(0.0);
  float transmission = 1.0, closest = 10.0;
  bool captured = false;
  float b = dot(eye,ray);
  float discriminant = b*b-dot(eye,eye)+bound*bound;
  if (discriminant > 0.0) {
    vec3 position = eye+ray*max(0.0,-b-sqrt(discriminant));
    for (int i=0;i<96;i++) {
      float radius = length(position);
      if (radius < CORE) { captured=true; break; }
      if (radius > bound+0.02) break;
      float stepLength = clamp(radius*0.13,0.020*units,0.11*units);
      // 艺术化透镜标定保持两个原版端点，不是广义相对论求解器。
      vec3 gravity = -position*(mix(0.085*CORE/0.275,0.065,uView)/(radius*radius*radius));
      vec3 nextRay = normalize(ray+(gravity-ray*dot(gravity,ray))*stepLength);
      vec3 nextPosition = position+normalize(ray+nextRay)*stepLength;
      closest = min(closest,radius);
      if (radius < 0.42) {
        vec3 segment = nextPosition-position;
        float approach = clamp(-dot(position,segment)/dot(segment,segment),0.0,1.0);
        float segmentClosest = length(position+segment*approach);
        closest = min(closest,segmentClosest);
        if (segmentClosest < CORE) { captured=true; break; }
      }
      float surface0 = position.z-diskHeight(length(position.xy));
      float surface1 = nextPosition.z-diskHeight(length(nextPosition.xy));
      float delta = surface1-surface0;
      for (int layer=0;layer<3;layer++) {
        float level = (float(layer)-1.0)*mix(0.040*units,0.035,uView)*sign(delta);
        if ((surface0-level)*(surface1-level)<=0.0 && abs(delta)>0.000001) {
          vec3 disk = mix(position,nextPosition,clamp((level-surface0)/delta,0.0,1.0));
          float r = length(disk.xy);
          if (r < innerRadius || r > outerRadius) continue;
          float a = atan(disk.y,disk.x+0.000001);
          float radial = smoothstep(innerRadius,innerRadius+0.09*units,r)
            *(1.0-smoothstep(outerRadius*mix(0.82/1.50,0.65,uView),outerRadius,r));
          float materialRadius = r/units;
          float logRadius = log(materialRadius/mix(1.0,0.32,uView));
          float twist = a+logRadius*mix(2.0+turbulence*2.0,3.4+turbulence,uView);
          vec2 innerFlow = vec2(cos(twist+uPhase.x),sin(twist+uPhase.x));
          vec2 outerFlow = vec2(cos(twist+uPhase.y),sin(twist+uPhase.y));
          float frequency = materialRadius*mix(32.0,30.0,uView);
          float grain = mix(fbm(innerFlow*frequency+5.0),fbm(outerFlow*frequency+5.0),
            smoothstep(mix(0.45,0.40,uView),mix(1.2,1.15,uView),materialRadius));
          float cloud = fbm(outerFlow*materialRadius*4.0+19.0);
          float arms = pow(0.5+0.5*cos(2.0*a+logRadius*4.2+uPhase.y*2.0+cloud*0.8),2.0);
          float lanes = mix(0.65+0.35*sin(a*2.0+log(materialRadius)*6.0),
            mix(0.85,0.18+arms*1.20,smoothstep(0.40,outerRadius*0.55,r)),uView);
          float threads = pow(smoothstep(mix(0.22,0.20,uView),mix(0.68,0.66,uView),grain),1.8);
          float density = radial*(mix(0.08,0.10,uView)+threads*mix(2.5,2.1+turbulence*1.1,uView))
            *lanes*(0.3+cloud*mix(1.2,1.3,uView));
          if (layer != 1) density = radial*mix(0.18+cloud*0.45,(0.12+cloud*0.32)*(0.5+lanes*0.5),uView);
          float opacity = 1.0-exp(-density*(layer==1 ? mix(0.9,0.95,uView) : mix(0.144,0.17,uView)));
          float temperature = pow(clamp(mix(0.48,0.40,uView)/materialRadius,0.0,1.0),mix(1.8,1.4,uView));
          vec3 rose = mix(vec3(0.19,0.07,0.22),vec3(1.0,0.48,0.42),temperature);
          rose = mix(rose,vec3(1.0,0.87,0.80),pow(temperature,3.0)*0.70);
          rose = roseTemperature(rose);
          vec3 shadow = mix(vec3(0.045,0.035,0.18),vec3(0.24,0.055,0.045),warmth);
          vec3 body = mix(vec3(0.32,0.39,0.88),vec3(1.0,0.41,0.12),warmth);
          vec3 core = mix(vec3(0.78,0.86,1.0),vec3(1.0,0.85,0.61),warmth);
          vec3 gas = mix(shadow,body,smoothstep(0.12,0.70,temperature));
          gas = mix(gas,core,pow(temperature,4.0)*0.78);
          if (layer!=1) gas = mix(gas,vec3(0.12,0.09,0.28),(1.0-temperature)*0.45);
          gas = mix(rose,gas,uView);
          float slope = 0.644*exp(-max(r-0.30,0.0)*2.8)*uView;
          vec3 normal = normalize(vec3(-slope*cos(a),-slope*sin(a),1.0));
          float shapeLight = mix(1.0,0.65+0.35*max(0.0,dot(normal,normalize(vec3(-0.4,0.6,1.0)))),uView);
          float beaming = mix(0.50,0.55,uView)+mix(0.90,0.80,uView)*pow(0.5+0.5*cos(a-mix(0.6,0.8,uView)),2.0);
          light += transmission*max(gas,vec3(0.0))*opacity*beaming*shapeLight*gain
            *mix(1.445*2.8,3.2,uView)*(1.0+pulse*mix(0.25/0.7,0.65,uView));
          transmission *= 1.0-opacity;
        }
      }
      ray=nextRay; position=nextPosition;
    }
  }
  vec3 col = light*(1.0+uCycle*0.055);
  if (!captured) {
    col += background(ray,pixel)*transmission;
    if (closest < 0.36) {
      float gap=closest-CORE, angle=atan(p.y,p.x+0.000001);
      vec2 orbit=vec2(cos(angle+uPhase.x*0.45),sin(angle+uPhase.x*0.45));
      float detail=fbm(orbit*2.5+13.0);
      float silk=fbm(orbit*(4.0+gap*24.0)+vec2(11.0,gap*18.0));
      float fine=vnoise(orbit*16.0+vec2(3.0,gap*45.0));
      float illumination=0.12+pow(0.5+0.5*cos(angle-0.65),3.0)*1.45+pow(0.5+0.5*cos(angle+2.7),7.0)*0.38;
      float photon=exp(-pow((gap-0.003)/(0.0022+detail*0.002),2.0))*illumination*(0.65+detail*0.8);
      float echo=exp(-pow((gap-0.052-detail*0.007)/0.010,2.0))*pow(0.5+0.5*cos(angle+2.1),3.5)*(0.35+detail*0.4);
      float corona=exp(-gap/0.070)*illumination*(0.45+0.60*smoothstep(0.20,0.70,silk)+fine*0.10)
        *(1.0-smoothstep(0.075,0.115,gap));
      vec3 rim=mix(roseTemperature(vec3(1.0,0.72,0.67)),
        mix(vec3(0.60,0.76,1.0),vec3(1.0,0.77,0.40),warmth),uView);
      vec3 halo=mix(vec3(0.34,0.10,0.25),mix(vec3(0.14,0.23,0.60),vec3(0.75,0.27,0.07),warmth),uView);
      col += (mix(rim,vec3(1.0,0.94,0.85),0.65)*photon*mix(0.55,1.4,uView)+rim*echo*mix(0.30,0.80,uView))
        *pow(transmission,2.0)*(1.0+pulse*0.35)*gain;
      col += halo*corona*transmission*mix(0.35,0.65,uView)*gain;
    }
  }
  col=1.0-exp(-max(col,vec3(0.0))*1.2);
  col*=1.0-0.30*smoothstep(0.35,1.1,length(screen));
  fragColor=vec4(col,1.0);
}
`,
});
