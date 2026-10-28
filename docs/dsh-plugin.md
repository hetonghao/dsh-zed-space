# DSH bundle 安装

根目录是 `dsh-zed-space` 的可安装 DSH bundle，展示名为 Zed Space Skin。`1.0.1` 的发布进度见[发布记录](publishing/releases/1.0.1.md)；安装方法见[安装与排错](install.zh.md)，旧包迁移见[迁移说明](publishing/migration.md)。

bundle 通过 Host、Web client module 和同源只读资源路由加载背景，无需修改 Harness 源码。安装后核对 profile 中只有一个新插件实例，并检查以下资源响应正常：

```text
/plugins/dsh-zed-space/client.js
/dsh-zed-space/skin.html
/dsh-zed-space/cosmos.html
/dsh-zed-space/video.html
/dsh-zed-space/styles.css
```

安装时使用精确版本或审核过的本地 tarball。Desktop 与 Web 使用不同 profile；在 Web 安装不等于 Desktop 已更新。

旧 `harness-plugin/` React 源码集成是另一条路径，仅接海洋。多背景功能范围以根目录 bundle、静态安装和浏览器扩展的实际验收为准；不要同时启用多条路径。

DSH bundle 已接入 [Zed Space 公网壁纸市场](https://zed-space.ai-cove.com/wallpapers)，使用插件同源的只读接口校验目录和下载视频。全窗口浏览、校验导入、手动应用与网络范围见[壁纸市场接入](market-integration.md)。无需启动本地市场服务；Web 验证不能替代原生 Electron 验证。
