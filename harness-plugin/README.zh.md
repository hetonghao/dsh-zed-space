# Zed Space Skin 源码集成

此目录保留旧 React 源码集成，当前仍只接海洋背景。它与根目录的 `dsh-zed-space` DSH bundle 不同，不包含宇宙双视角或本地视频设置。需要多背景时参阅[根目录安装文档](../docs/install.zh.md)。

当前 1.3.0 为未发布候选版；本次迁移尚未验证完整 Harness 源码编译。

## 集成到 Harness 源码

```sh
bash harness-plugin/install-into-harness.sh /absolute/path/to/deepseek-harness
cd /absolute/path/to/deepseek-harness
corepack pnpm install --no-frozen-lockfile
corepack pnpm run build
corepack pnpm dsh web
```

安装器继续使用 `packages/client/ui-backspace` 目录和 `ui-backspace` 设置域，以沿用既有集成和设置。包名称改为 `dsh-zed-space`，资源路由为 `/dsh-zed-space`。安装器为布局增加 `shell.background` 插槽，并登记 Host、Client 与设置入口。

历史集成基线是 Harness `0.1.2-alpha.3`、提交 `dd6322d60`；这不代表新版本 Harness 已验证。上游定位点变化时安装器退出，需重新核对后适配。

## 功能边界

- 下方快捷设置和「设置 → 通用」调节海洋、光照、玻璃及画质。
- 海洋 iframe 使用同源资源，设置由 Harness 设置服务保存。
- 保留旧 DOM 防重复标识；同一实例应只启用一种安装方式。
- 画质变更会重新加载海洋 iframe；此路径面向 Web，未承诺 Electron/file 协议资产加载。
- 不增加模型上下文、工具或请求，不修改 KV cache 行为。

宇宙、视频和皮肤切换来自根目录 bundle 的共享运行时；不能因 assets 中包含这些文件，就宣称本 React UI 已接入它们。
