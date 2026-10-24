// 事件视界：弯曲光线穿过倾斜的发光气体，保留前后遮挡与紫红星云。
// 坐标以画面高度为单位；渲染与消息协议由 shared/cosmos.js 提供。

export default Object.freeze({
  id: 'horizon',

  // 已发布宿主的参数入口；共享预览参数由 accretion.js 定义。
  props: Object.freeze([
    Object.freeze({ key: 'glow', min: 0, max: 100, def: 70 }),   // 吸积亮度
    Object.freeze({ key: 'curl', min: 0, max: 100, def: 50 }),   // 细丝曲率
    Object.freeze({ key: 'hue', min: -60, max: 60, def: 0 }),    // 色相偏移
    Object.freeze({ key: 'stars', min: 0, max: 100, def: 45 }),  // 星点密度
    Object.freeze({ key: 'drift', min: 0, max: 100, def: 30 }),  // 流动速度
    Object.freeze({ key: 'pull', min: 0, max: 100, def: 55 }),   // 鼠标引力
  ]),

});
