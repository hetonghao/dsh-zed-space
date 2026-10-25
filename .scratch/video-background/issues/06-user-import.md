# 06: 用户导入本地视频（预检 + 素材归属 + 移除）

## 2026-10-25 进度核对

用户已明确要求下一步实现本票，并先制作界面原型。测试边界为真实面板、播放/重启恢复/移除、错误回退、扩展跨源传输和三路径产物；实现审查以整理既有代码后的提交为基线。

**What to build:** 用户从本地选一个视频作为背景——**用户导入是唯一的视频来源，不内置任何视频素材**。

### 不做转码

已实测：转码约 1× 实时（8.09s 处理 7.98s 素材），是成本不是优化；重编码必然有损；
用户素材不进包，转码对包体积零影响；本地 `VideoEncoder` 不支持 `avc1`。

改为**导入前预检**：只读元数据（毫秒级，不解码）。

### 预检判据（必须有数字，否则无法验收、也无法写文案）

```
≤1920×1080   ≤30s   ≤32MB   mp4|webm   h264|vp9|av1   必须含视频轨
```

判据只用 `videoWidth > 0` + `Number.isFinite(duration)` + `size > 0` +
`loadedmetadata` **3 秒超时**。`file.type` **永不作判据**（MIME 由 OS 提供、可伪造）。
拒绝时给出具体原因与改法（例如附 ffmpeg 命令），不是只说"不支持"。

⚠️ 构造过的 mp4（坏 `moov`、`duration=Infinity`、`videoWidth=0`）会让
`loadedmetadata` 永不触发 ⇒ 预检必须超时，否则面板挂死。

### 素材归属（这是本票的核心设计）

三条路径的 origin 关系不同，**不能"各自读同一存储"**：

| 路径 | iframe origin | 与宿主页 |
|---|---|---|
| DSH 插件 / 静态安装 | 同源 | 可共享 `blob:` URL |
| 浏览器扩展 | `chrome-extension://` | **跨源**，读宿主 blob 抛 `SecurityError` |

而且 content script 在宿主页 origin、iframe 在扩展 origin，**`IndexedDB` 不共享**。

**定死契约**：
- 素材由 **iframe 自己持有的存储**保存（在 iframe 的 origin 建库）。
- 控制器只**投递一次 Blob**（`postMessage`，结构化克隆；峰值内存 ≈ 2× 文件体积）。
- **不扩 `options.storage` 契约**——它是三个适配器的标量存储，塞 Blob 会撞
  `chrome.storage.sync` 单条 8KB，且开启同步时**会把用户视频上传到其 Google 账号**。
- **不加 `unlimitedStorage` 权限**（扩权限面，触发市场复审）。
- 读不到字节时（另一台设备只同步了"模式=视频"）**回退海面**，且面板**不得**显示"已导入"。

### 零散但必须做的四件

1. 扩展路径 iframe 加 `allow="autoplay"`（`skin-core.js:497` 现在没有这个属性）。
   跨源 iframe 的 autoplay 属 permission policy，缺失可能导致只停首帧，且只在扩展路径复现。
2. `<video>` 必须 `muted`（带音轨素材不得出声）。
3. `play()` 返回 Promise，必须 `catch`——被拦时保持首帧，不得抛未捕获 rejection。
4. 两条静态服务都没有 `Range`/206 支持。Chrome 可 200 播放但不可 seek；Safari 需要 206。
   **要么**给 route 加最小 Range 实现，**要么**明确声明"仅 Chromium、不支持 seek"写进文档。

### 安全

文件名与素材元数据一律走 `textContent` / `element.value`，**禁止拼进 `innerHTML`**——
面板整体是 `panel.innerHTML = \`...\`` 模板串（`skin-core.js:541`），这是本仓库既有的渲染
方式，最容易被顺手沿用，而扩展页里的存储型 XSS 危害远高于普通页面。
`SECURITY.md:22` 的"Preferences contain only appearance values"会变成不实陈述，需同步改。

**Blocked by:** 01（MIME 表与存储键）、02（分派骨架）

**Status:** ready-for-agent

- [ ] 面板可选择一个本地视频，接受后立即播放
- [ ] 六个上限各有一条拒绝用例，拒绝文案含具体改法
- [ ] 坏 `moov` / 截断 / 0 字节 / `.mp4` 改名的图片：3 秒内给出拒绝，面板不挂死
- [ ] `emerald-dive.mp4`（35MB / 19.6Mbps）被拒绝并给出理由
- [ ] `File.type` 伪造成 `video/mp4` 时仍按真实元数据判定
- [ ] 合格素材重启后仍在；一键移除后退回海面且存储被清理
- [ ] 浏览器扩展路径可用：跨源传 3MB Blob，接收端 `size` 与 sha256 一致且可播放
- [ ] 只同步了模式、无字节时回退海面，面板不显示"已导入"
- [ ] 文件名 `<img src=x onerror=alert(1)>.mp4` 导入后面板显示为纯文本、无弹窗
- [ ] 竖拍（rotation 元数据）旋转正确，`object-fit: cover` 无变形
- [ ] 解码失败 / `play()` 被拒 / 配额耗尽 全部回退海面，不白屏
- [ ] `npm pack --dry-run` 里没有任何媒体文件；`dependencies` 仍为 `{}`
- [ ] `SECURITY.md` 新增"用户素材存储"一节（位置/上限/清除方式/不外传）
