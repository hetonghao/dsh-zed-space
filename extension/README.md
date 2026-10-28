# Zed Space Skin（Chrome / Edge 扩展）

为 DeepSeek Harness 提供海洋、事件视界、吸积涡旋和本地视频背景；两个宇宙入口是同一场景的不同视角。在本机 Harness 界面
（`http://127.0.0.1/*`、`http://localhost/*`）背后渲染背景，并把界面面板变成
半透明玻璃。扩展不会接管新标签页、修改浏览器主页或影响用户已有的新标签页扩展，
也不会修改其他本地网站。此扩展作用于浏览器中的 Harness，不能给 Desktop 换肤。

仓库与技术名为 `dsh-zed-space`，当前版本为 `1.0.1`。可从 [GitHub Release](https://github.com/hetonghao/dsh-zed-space/releases/tag/v1.0.1) 下载扩展 ZIP 后解压加载，也可 clone [仓库](https://github.com/hetonghao/dsh-zed-space) 后加载本地目录。Chrome/Edge 扩展商店尚未上架；npm 包用于 Harness 插件安装。

## 加载本地扩展

1. 打开 Chrome/Edge：地址栏输入 `chrome://extensions`（Edge 是 `edge://extensions`）。
2. 右上角打开 **开发者模式**。
3. 点 **加载已解压的扩展程序**，选择 clone 后的 `dsh-zed-space/extension` 文件夹。
4. 完成。打开或刷新 `127.0.0.1:3080` 的 DeepSeek Harness 即可看到背景皮肤。

打开页面左下角「皮肤设置」切换背景。关闭皮肤：点工具栏的扩展图标 → 弹窗里关掉「界面海洋背景」（当前开关标签）。同一实例只启用一种安装方式。

扩展虽然需要覆盖 `127.0.0.1` 和 `localhost` 的不同端口，但注入前会验证 Harness
标题、`#root` 节点和服务端注入的 `window.__DSH_BOOT__` 标记。三项同时满足才会
启动皮肤，因此普通本地开发页面保持原样。扩展资源使用扩展自身的 origin；静态安装方式的 `/dsh-zed-space/` 路径不适用于这里。

## 更新与数据边界

设置继续使用既有 `bs*`、`skin*` 键，本地视频库仍名为 `backspace-videos`。保留名称不代表能跨 origin 或浏览器 profile 读取数据。扩展重装或更换 ID 可能改变扩展 origin，不能承诺旧视频自动保留；迁移前保留原文件，必要时重新导入。视频没有跨扩展迁移或云同步功能。详见[迁移说明](../docs/publishing/migration.md)。

## 与原始站点版的区别（占用优化）

以下保留 Backspace 海洋实现的历史对比，仅描述海洋；旧实测数据不是当前版本或宇宙、视频背景的性能验证。

| 项目 | 原始 `site/` | 本扩展 |
| --- | --- | --- |
| 海面网格 | 440×440（19.4 万顶点） | 256×256（6.6 万顶点，省约 8 MB 显存） |
| 像素比 | 固定 min(dpr, 2) | 上限 1.5 + 按帧率自适应 0.5–1.0 缩放 |
| 帧率 | 跟随屏幕刷新率 | 60 fps 封顶（120 Hz 屏省一半 GPU） |
| 抗锯齿 | 4× MSAA | 关闭（后期管线下本就无效，省显存带宽） |
| 片元着色 | 全屏全量 FBM | 距相机 140 单位外跳过细节法线/闪烁/泡沫；反射云仅在可见处计算；天空云仅在云带内计算 |
| 电源 | high-performance | 皮肤模式 low-power；标签页隐藏即暂停渲染 |
| 皮肤模式额外 | — | 自动 12 分钟昼夜循环、超慢自动漂移、淡入 |

所有视觉公式与原始版本一致（同样的五波 Gerstner、FBM 常数、天空函数、ACES + bloom）。

实测（同机同窗口 20s，Chrome 151，软件光栅 SwiftShader）：

- 总 CPU 时间：原版 ≈ 13.2s → 本扩展 ≈ 4.7s（**约 2.8× 下降**）
- 顶点数：194,481 → 66,049（**1/3**，显存少约 8 MB）
- 关闭 MSAA 与半浮点缓冲：渲染目标带宽进一步下降
- 标签页隐藏：渲染循环完全停止（CPU/GPU 近零）


## 文件说明

- `skin.html` — 无 UI 背景页（皮肤 iframe）
- `cosmos.html` / `cosmos.js` / `skins/` — 宇宙场景与视角
- `video.html` / `video.js` / `video-media.js` — 本地视频背景与存储
- `ocean.js` — 共享优化引擎（`?skin=1` 切换皮肤模式）
- `styles.css` — 共享样式（字体已本地化，零网络请求）
- `content.js` — Harness 身份校验与皮肤注入（玻璃令牌覆盖 + iframe）
- `popup.html` / `popup.js` — 皮肤开关
- `vendor/` — 本地化并压缩过的 three.js 0.178（webgpu/tsl/addons）+ Geist 字体

原始网站版本保留在 `../site/`，未做任何改动。

Zed Space Skin 延续 Backspace 的代码与历史；改名不改变既有版权和第三方许可，见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。
