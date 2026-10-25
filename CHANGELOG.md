# Changelog

All notable changes to Backspace are documented here.

## Unreleased

### 本地视频素材列表

- 新增第四个「本地视频」入口，支持多选导入、缩略图列表、单选启用、重命名及单项移除。
- 素材和选择仅在本机 IndexedDB 保存，重启恢复；扩展路径按宿主 origin 隔离，不同步视频内容。
- 检查实际容器、编码、大小、分辨率与时长；错误可见，播放或存储失败时回退海面。
- 静音循环播放，遵守总开关、页面可见性和减少动态设置；未新增运行时依赖。

### 设置面板

- 更新设置入口、深浅色面板、逐项帮助提示及键盘操作；窄屏内容可滚动。
- 各皮肤独立保存效果参数、自动光影和通用配置，迁移旧设置并保留原值。
- 恢复默认仅作用于当前皮肤，先显示标题与确认按钮；切换时同步中间区域高度。

### 日常背景开销

- 宇宙背景在静稳工作状态采用 10 FPS 帧预算，设置预览、视角切换、视差和点击效果的活跃阶段恢复完整帧预算；不缩放流动速度、亮度或任何可调参数，保留原生清晰度。
- 显式暂停非当前海面的绘制与内部 RAF；关闭设置后释放非当前类的 iframe，保留所选背景持续动态。再次选择另一类皮肤时按已保存参数重建。
- 过滤零强度及重复交互消息，消息流新增内容不再反复触发入口定位；保留锚点迟到、替换和窗口调整的定位行为。

### 1.3.0-rc.1 本地候选版

- 将事件视界与吸积涡旋的八项共享参数接入正式插件，切换视角保留参数和同一画布；迁移已有配置并保留旧记录。
- 优化宇宙渲染调度：静止画面按需绘制，高刷新屏的装饰动画限制为 30 FPS；保留原生 Retina 分辨率和原有着色器视觉。
- 减少逐帧参数归一化，补充参数迁移、插件生命周期和渲染唤醒回归。
- 本版本用于本地 Desktop 验证，未发布到 npm。

### Changed

- 事件视界与吸积涡旋合并为一个吸积场景：共享星空、光线积分与辉光，保留紫红侧视和铜金俯视的视觉标定，并以约 2.2 秒连续切换。
- 本地宇宙预览页提供两种视角和同一组八项参数；切换保留调参，支持中途反向、暂停补帧和减少动态效果。现有旧参数入口保持兼容。
- 提升宇宙皮肤的 Retina 分辨率、近缘光弧采样和自适应画质恢复；补充浏览器回归检查。

- **New code-level defaults**, matching the shipped skin baseline: sea state
  **50**, daylight **55** (afternoon), glass opacity **70%**, automatic day
  cycle on, and the independent conversation background **on at 90%**. Earlier
  installs keep their saved values; the new defaults apply to fresh installs
  and to the panel's "Reset to defaults" button, whose note now names them.

### Added

- **Independent conversation background** in the skin settings panel. A
  switch reveals a slider that sets the center conversation column's own
  opacity from **40% to 100%**; 100% is indistinguishable from unthemed Harness
  because the paint is derived from Harness's own
  `--dsw-static-neutral-bluish-*` palette and only scaled by `color-mix()`.
  With the switch off the conversation follows the workspace glass, exactly as
  before, and the sidebars and details columns keep that glass in both modes.
  On by default at 90%; stored as `bsChatCustom` / `bsChatOpacity` (localStorage) and
  `skinChatCustom` / `skinChatOpacity` (extension sync storage). The control is
  wired through all install paths: DSH bundle, static installer and MV3
  extension.

### Fixed

- Floating Harness surfaces no longer inherit the workspace glass opacity.
  Harness paints its hover preview cards — including the edited-file diff
  popover — with `--dsw-alias-bg-layer-1`, and dialogs and floating dock
  windows with `--dsw-alias-bg-layer-2`. Both are opaque in Harness's own
  palette, but the skin had overridden them with the glass alpha, so page
  content showed through the preview card's diff text. They now keep a
  near-opaque `ELEVATED_ALPHA` (0.97, the same value the settings dialog
  already used) while `--dsw-alias-bg-base` still follows the glass setting.
- The community desktop details column no longer composites two nested
  translucent fills when the independent conversation background is on.

## 1.2.6 — 2026-10-20

### 修复 / Fixed

- 将浮层背景与工作区玻璃值分离：插件广场使用的 overlay token 保持 97% 不透明度。
- 语义 dialog / alertdialog 与设置弹窗使用独立可读底色，覆盖 body portal 中的二级插件配置弹窗；不改遮罩、层级和海洋效果。感谢 #16 的复现信息。
- Keep overlay tokens and semantic modal cards legible independently of workspace glass opacity, including sibling-portalled plugin configuration dialogs.

### 验证范围 / Verification scope

- macOS / Windows 页面结构、浅深色、40% / 90% 工作区玻璃组合回归；确认工作区透明度与 shell overlay 不变，停用后样式清除。
- 核对官方 Harness 0.2.1-rc.2 安装文档及 Modal 结构。不是 Windows 原生安装或该新版完整实机兼容认证。
- 中文安装指引明确 npm 插件优先、社区市场可选、浏览器扩展不适用于桌面客户端。Logo 未修改。

## 1.2.5 — 2026-10-10

### Fixed

- Official DeepSeek Harness Desktop `0.2.0-rc.2` now paints one glass layer
  across the sidebar, conversation, and rightbar. The conversation's nested
  background no longer compounds opacity, while the composer remains readable.
- Official Desktop Settings stays opaque enough to read when workspace glass
  is set to its minimum 40%.

### Tested

- Installed the release package into an isolated official macOS Desktop
  `0.2.0-rc.2` profile with its bundled CLI and visually verified the shell.
- Added a 0.2.x shell regression fixture for macOS/Windows structure in light
  and dark modes. Windows is fixture-tested, not native Windows E2E-tested.

### Documentation

- Clarified the Desktop install path and distinguished the GitHub release from
  the older npm package currently available through registries.

## 1.2.4 — 2026-09-09

### Fixed

- Quick controls follow asynchronous Harness document-language changes in both
  Chinese and English, including accessibility labels, without losing focus or
  control state. The observer is removed on disposal. Thanks to @Max-Null for
  reporting the issue in #6; the fix lives in the shared source and all generated
  install targets.

### Documentation

- Recommend the prebuilt npm package to avoid Git transport failures during
  installation; explain why a `git ls-remote` error is not proof of a blocked
  build script (#8).

## 1.2.3 — 2026-09-07

### Fixed

- DSH Desktop advanced and extended layouts now paint a single shared glass
  background. The sidebar, conversation and details panes no longer differ
  in opacity due to transparent sidebar overrides and stacked conversation fills.
- Composer cards and dialogs retain their own backgrounds. Disabling or
  unloading Backspace restores the desktop's original styles.

### Tested

- Desktop shell regression based on DSH Desktop Beta `2.0.5-beta.1`: 24
  combinations of layout, native material, light/dark mode and glass opacity,
  plus settings, text input, disable/re-enable and disposal in Chromium.
- The old `1.2.2` bundle fails this regression: at 40% glass the sidebar's
  effective opacity is 0%, while nested conversation fills reach 64%.

## 1.2.2 — 2026-09-01

### Added

- Quick-controls panel gains an enable toggle, an automatic day-cycle toggle,
  and a reset-to-defaults button. Disabling the skin now only tears down the
  ocean surface while keeping the button and panel, so the skin can always be
  re-enabled from the same page.
- Public npm publishing metadata and guarded release automation for DSH
  Desktop managed installation.

### Fixed

- Dragging the daylight slider now unchecks the automatic day-cycle toggle to
  match the persisted state.
- Native source integration now supports Harness `0.1.2-alpha.3` and its split
  client store, renderer, and session services.
- Browsers without WebGPU can use a capped low-end WebGL2 fallback instead of
  stopping at an unavailable screen.

## 1.2.1 — 2026-08-18

### Changed

- The Chrome/Edge extension is now Harness-only and no longer replaces the
  browser new-tab page.
- Loopback pages must match the DeepSeek Harness title, root element, and
  server-injected boot marker before the extension changes their DOM.
- Browser acceptance now proves that real Harness pages are skinned while a
  generic localhost app and an existing third-party new-tab homepage remain
  untouched.

## 1.2.0 — 2026-08-17

### Added

- A root `dsh.bundle` package that installs directly into DeepSeek Harness.
- Lower-left quick controls for wave size, daylight, glass opacity, and the
  automatic day/night cycle in the one-line DSH installation.
- A DeepSeek Harness-specific marketplace cover and four 40%-glass gallery
  animations covering dark mode, light mode, waves, and sunset.
- Host-route boundary tests for local renderer assets.

### Fixed

- Kept the native Settings dialog above the conversation composer at wide
  aspect ratios.
- Restored the lower-left Skin settings launcher and persisted every control.

## 1.1.0 — 2026-08-17

- Added the native Harness source integration, static installer, browser
  acceptance coverage, and bilingual 40%-glass gallery.

## 1.0.0 — 2026-08-14

- Initial Backspace WebGPU showcase and Chrome/Edge extension.
