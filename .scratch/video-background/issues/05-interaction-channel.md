# 05: 交互通道（鼠标 / 点击 → postMessage）

## 2026-10-25 进度核对

鼠标视差、点击脉冲、按帧合并和卸载清理已实现，宿主回归已有覆盖。原票的鉴权要求和实际频率边界尚未完整验收，不结票。视频导入使用独立的受限消息边界，不把本票未完成项当作已有保障。

**What to build:** 让皮肤能响应鼠标移动、点击等宿主页事件。

### 为什么需要一条新通道

背景 iframe 是 `pointer-events: none` 且 `aria-hidden="true"`（`shared/skin-core.js:497-505`），
**iframe 内部收不到任何鼠标事件**。必须在父页 `document` 上监听，再通过现有
`postMessage` 通道转发进 iframe。现有接收端在 `shared/ocean.js` 的 `if (SKIN)` 块里，
只接受 `ev.source === window.parent` 并校验 origin。

### 消息协议

沿用现有 `bs-set` 那一套风格。建议：

```
parent → iframe:  { type: 'bs-pointer', x, y, down }     归一化坐标 + 按下状态
                  { type: 'bs-click',   x, y }            一次点击事件
```

**节流**：鼠标移动按帧（或 ≥30Hz）合并，不要在 `mousemove` 里直接 postMessage——
高频 `postMessage` 会拖慢主线程，正好违背"背景不干扰前台"的既有前提。

**卸载**：`controller.stop()` 必须移除监听并取消已排队的帧，否则皮肤关掉后仍在接收事件。

### 安全（必须做，3 行）

`shared/ocean.js:31` 的 `parentOrigin` 来自查询串，由嵌入方自填，是**自证**；
`extension/manifest.json:41` 的 `web_accessible_resources` 匹配 `http://localhost/*` 与
`http://127.0.0.1/*`，意味着**任意 loopback 页面都能嵌入这个 iframe 并驱动它**。

今天只影响画面参数（低危）。但这条通道一旦承载点击/坐标，就给了任意本地页面一个
可控的输入通路；等 06 票让它承载 Blob 时，就升级为**素材库投毒**。

**修**：挂载时生成 per-mount `crypto.randomUUID()` 放进 iframe URL，要求每条入站消息
回带；缺失即丢弃。**不要把安全寄托在 `parentOrigin` 上**——
不要为了修这个去动 `extension-entry.js` 的 origin 计算，那是另一条线。

**Blocked by:** 02

**Status:** in-progress

- [ ] 皮肤对鼠标移动有可见响应（由皮肤自己决定响应方式）
- [ ] 点击能触发一次事件；连点不堆积、不漏
- [ ] `mousemove` 转发频率 ≤60Hz（实测计数，不靠断言）
- [ ] 切到不响应交互的皮肤后，事件不再转发，且无残留监听
- [ ] 从另一个 loopback origin 发一条不带 token 的 `bs-pointer` → 被丢弃，渲染器状态不变
- [ ] 无未捕获异常；`prefers-reduced-motion: reduce` 时交互不引起大幅运动
- [ ] 未新增运行时依赖
