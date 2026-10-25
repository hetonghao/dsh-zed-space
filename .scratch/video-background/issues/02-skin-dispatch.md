# 02: 皮肤分派与失败回退

**Status:** done
**Blocked by:** None

## 已确认的实现

后续已确认的实现替代最初的 `skin-boot.js` 单入口草案：海面使用 `skin.html`，
事件视界与吸积涡旋共用 `cosmos.html` 和一块场景画布。控制器负责选择、挂载、暂停与释放。
三条安装路径从 shared 源码生成，宇宙初始化失败或超时回退海面。
`ocean.js` 字节不变的原约束已由后续明确要求的后台暂停与生命周期修复替代。

## 结票依据（2026-10-25）

- [x] 三个皮肤 id 可分派，未知 id 归一化为海面。
- [x] 宇宙失败、未报告首帧时回退海面。
- [x] 三路径生成产物与资源白名单有静态回归。
- [x] 已有宿主与宇宙浏览器验收覆盖切换、失败和生命周期。
- [x] 本轮生成一致性和单元检查通过，未新增运行时依赖。

证据：`tests/skins.test.mjs`、`scripts/cosmic-acceptance.mjs`、
`scripts/background-host-acceptance.mjs`；执行记录见 `../progress.md`。
视频背景作为 06 的新 surface 接入，不重新实现已完成的皮肤分派。
