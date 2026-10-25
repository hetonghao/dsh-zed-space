# 01: 阻塞小修（5 处，各 1–10 行）

## 2026-10-25 进度核对

皮肤字符串键已由三个入口支持；本次补齐本地素材和实验目录的忽略规则。视频 MIME、写入合并与失败提示、通用背景验收入口仍未完成，保持打开。

**What to build:** 五个已定位的小缺陷，它们单独看都不起眼，但每一处都会让后续任一张票
"静默失败"——不是报错，而是看起来成功了实际没生效。合在一个 PR 里落地，每处配一条回归断言。

### 1. 两张 MIME 表都没有视频类型

- `plugin/index.js:14-19`（4 项：css/html/js/woff2）
- `scripts/browser-support.mjs:6-16`（9 项，有 jpg/png/gif/svg 但**没有 mp4/webm**）

未知扩展名回落 `application/octet-stream`，且响应带 `x-content-type-options: nosniff`。
两条静态服务都会把视频喂成 octet-stream。

**修**：两张表各加 `.mp4 → video/mp4`、`.webm → video/webm`。只加实际用到的，
**永远不加** `text/html`、`image/svg+xml`。

### 2. 存储适配器把字符串枚举吃掉

`shared/native-entry.js:13-20` 的 `read()` 与 `scripts/build-dsh-bundle.mjs:21-31` 的
`readSetting()` 是同一份逻辑：非 `enabled`/`autoCycle`/`chatCustom` 的键一律
`return Number(value)`。新增 `background: 'video'` 这类字符串字段会被转成 `NaN`，
`normalize()` 落回默认值 ⇒ **设置静默丢失**。

（扩展路径是另一个机制：`shared/extension-entry.js` 用 `chrome.storage.sync.get({默认值})`，
没有 Number 转换；但新键若不写进那个默认对象，值同样永远读不回来。三处都要改。）

**修**：三处各加一个字符串分支/键。**不要动 `Number` 路径**，那是现有数值键的依赖。

### 3. 滑块写入无合并，会撞 `chrome.storage.sync` 配额

`shared/skin-core.js:608/614/622/647` 四个滑块绑 `input` 事件，每次都
`void save(patch)` → 扩展路径 `chrome.storage.sync.set`。配额是 120 次写/分；
一分钟内多次拖动必然撞上。而 `save()` 失败只 `console.warn`（`:428-430`），
用户完全看不到——表现为"调完滑块，重开 Harness 设置回退"。

**修**：`save()` 内做 250–500ms 尾随合并（约 10 行），失败时面板显示一行可见提示。

### 4. 测试素材未忽略，且缺许可声明

`git check-ignore` 确认 `docs/wallpaper-samples/`（65MB）、`.archify/`、`.scratch/`
**都没被 `.gitignore` 覆盖**，只是 untracked。一字之差就进历史。
且 `docs/wallpaper-samples/README.md` 只写来源，**没有任何授权声明**。

**修**：`.gitignore` 加这三个目录；README 补"来源 / 生成方式 / 再分发许可"三列，
未落纸的一律标"未确认"。**素材入库前必须先把许可落实**——派生物同样算。

### 5. 验收脚本在无 canvas 的皮肤下挂 45 秒

`scripts/browser-support.mjs:106-113` 的 `waitForOcean()` 等完 `body.ready` 还要等
`canvas` 可见。新皮肤若不用 canvas（CSS/SVG 实现）或加载失败回退中间态，
`desktop-acceptance.mjs:41,154` 与 `official-desktop-acceptance.mjs:37,109` 共 4 处调用
会各挂 **45 秒超时**——不是断言失败，是超时，排障成本最高。

**修**：`goto` 前 pin `localStorage.setItem('bsBackground','builtin')`（与现有
`bsAutoCycle`/`bsChatCustom` 同风格），并新增 `waitForBackground(page, skinId)`；
`waitForOcean` 只用于海面皮肤。

**Blocked by:** None (can start immediately)

**Status:** in-progress

- [ ] 两张 MIME 表各有 `.mp4`/`.webm`，`tests/bundle.test.mjs`（已用假 req/res 直调 route handler）断言 `content-type === 'video/mp4'`
- [ ] 三条路径各验一次"写字符串枚举 → 重载 → 仍在"，且该断言在改回 `Number` 时必红
- [ ] 模拟 200 次 `input` 后断言 `storage.set` 调用次数 ≤ 2；超配额时面板出现可见提示
- [ ] `git check-ignore docs/wallpaper-samples/ .archify .scratch` 全部命中
- [ ] 两套桌面验收脚本在 `bsBackground=builtin` 下全绿，`body.ready` ≤500ms
- [ ] `npm run check` 全绿（当前 22 项）
- [ ] 未新增运行时依赖
