// 吸积涡旋：俯视弯曲的吸积盘，铜色旋臂向下收拢，冷色薄雾显出层次。

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

});
