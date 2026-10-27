<div align="center">
  <img src="https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/extension/icons/icon128.png" width="80" height="80" alt="Zed Space 标志" />
  <h1>Zed Space Skin</h1>
  <p>DeepSeek Harness 动态背景与界面皮肤</p>
  <p><strong>简体中文</strong> · <a href="README.en.md">English</a></p>
</div>

海洋、宇宙双视角和本地视频，让 Harness 随你的工作场景变化。每个场景单独保存参数，切换时平滑衔接。

**当前为 1.0.0 候选版，技术包名为 `dsh-zed-space`。npm、GitHub Release、插件市场和新版 Pages 均未发布。** 仓库代码可用于本地构建验收，请勿把候选包名当成已发布的安装入口。

[源代码](https://github.com/hetonghao/dsh-zed-space) · [发布前说明](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/install.zh.md) · [问题反馈](https://github.com/hetonghao/dsh-zed-space/issues)

本项目是 DeepSeek Harness 的社区插件，不是 DeepSeek 官方产品，也不适用于 DeepSeek 网页聊天站点。

## 当前功能

| 场景或功能 | 可以做什么 |
| --- | --- |
| 实时海洋 | 调节波浪、日光，或启用自动昼夜变化。 |
| 宇宙双视角 | 在地平线和漩涡视角间切换，分别调整光晕、星点与运动参数。 |
| 每场景参数 | 各场景保存自己的参数和玻璃浓度；可单独调整对话面板背景。 |
| 本地视频库 | 多选导入、缩略图列表、勾选启用一个、重命名和移除，重新打开后恢复。 |
| 平滑切换 | 新画面就绪后交叠过渡；宇宙双视角在同一个渲染器内切换。 |

单个视频上限为 **32 MiB、30 秒、1080p**，支持范围及存储说明见[本地视频背景](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/video-background.md)。素材保存在本机，不会自动上传或随浏览器账号同步。**本地验收版已接入官方视频皮肤画廊**：在「本地视频」中点击「发现官方精美动态皮肤」，即可搜索、预览和下载；校验入库后再显式应用。市场服务目前仅在本机运行，详见[本地市场接入](docs/market-integration.md)。

## 场景展示

以下截图使用真实插件代码，在项目自带的**隔离验收界面**中渲染。它们用于展示当前场景和设置，**不是原生 Harness 实拍**；视频示例使用程序生成的测试素材。

### 宇宙 · 地平线

![Zed Space Skin 宇宙地平线及设置，隔离验收界面](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-horizon.png)

### 宇宙 · 漩涡

![Zed Space Skin 宇宙漩涡及设置，隔离验收界面](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-vortex.png)

### 海洋 · 波浪与日光

![Zed Space Skin 海洋及设置，隔离验收界面](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-ocean.png)

### 本地视频 · 素材管理

![Zed Space Skin 本地视频导入与播放，隔离验收界面](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-video.png)

## 本地构建与预览

需要 Node.js 20+。在仓库目录运行：

```sh
npm ci
npm run build
npm run build:site
npm test
```

`pages-dist/` 是官网静态产物，可通过本地 HTTP 服务预览。本轮仅做本地审核；Pages 工作流只保留手动触发，不随推送自动发布。

开发者接入方式见[插件构建说明](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/dsh-plugin.md)和[源码集成](https://github.com/hetonghao/dsh-zed-space/blob/main/harness-plugin/README.md)。旧版迁移注意事项见[安装说明](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/install.zh.md)，不要删除整个 Harness 配置或会话目录。

## 常见问题

**现在能从 npm 或市场安装新版吗？**

不能。1.0.0 尚未发布；发布后会更新安装说明和下载入口。

**有共享壁纸市场吗？**

已接通本地官方视频皮肤画廊，与 Zed Space 网站复用目录。支持在 DSH 内浏览、下载到「我的视频」并应用；尚未公开发布，启动条件见[本地市场接入](docs/market-integration.md)。

**历史 Backspace 内容为什么还在？**

本项目从 Backspace 演进而来。历史版本、变更记录和旧媒体保留溯源用途，不代表 Zed Space Skin 已发布。上游作者和许可记录见 [THIRD_PARTY_NOTICES.md](https://github.com/hetonghao/dsh-zed-space/blob/main/THIRD_PARTY_NOTICES.md) 与 [LICENSE](https://github.com/hetonghao/dsh-zed-space/blob/main/LICENSE)。

## 开发资料

[变更记录](https://github.com/hetonghao/dsh-zed-space/blob/main/CHANGELOG.md) · [贡献指南](https://github.com/hetonghao/dsh-zed-space/blob/main/CONTRIBUTING.md) · [隐私说明](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/privacy.md) · [安全政策](https://github.com/hetonghao/dsh-zed-space/blob/main/SECURITY.md)
