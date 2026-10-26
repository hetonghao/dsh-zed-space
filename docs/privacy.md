# 🔒 权限与隐私 / Privacy

Zed Space Skin 没有聊天内容上传、统计分析或遥测功能。皮肤会读取 Harness 页面标记、主题与布局来注入背景和样式，因此「完全不访问任何数据」并不准确。

- **浏览器扩展：** 仅申请 `storage` 和本机 `127.0.0.1` / `localhost` 页面权限。视觉偏好保存在 `chrome.storage.sync`；开启浏览器同步时，这些偏好可能由 Chrome / Edge 同步到其他设备。皮肤不会把聊天内容写入同步存储。
- **DSH npm 插件与静态加载器：** 视觉偏好保存在当前页面的 localStorage。
- **原生源码集成：** 使用 Harness 设置服务保存偏好。
- **安装版与当前官网：** 海洋渲染依赖和字体随包提供。官网、npm 与 GitHub 的页面访问、安装和更新本身仍需要网络。
- **历史演示 `site/`：** 保留原版实现，会使用 jsDelivr；不包含在安装版或当前官网中。

以上只描述 Zed Space Skin，不代表浏览器同步、宿主客户端或托管平台的数据处理方式。

## English

Zed Space Skin does not collect, transmit, sell, or share personal information,
usage data, page content, prompts, conversations, or identifiers.

The browser extension uses:

- `storage`: to retain the on/off state and visual preferences.
- `http://127.0.0.1/*` and `http://localhost/*`: to inject the background into a
  locally served DeepSeek Harness interface.

There are no remote host permissions, analytics SDKs, advertising systems,
tracking pixels, or network APIs. three.js and Geist are included locally.
Visual preferences use browser sync storage for the extension and may sync across
devices when browser sync is enabled. The npm plugin and static installer use
localStorage; the native source integration uses Harness's settings service.
The skin reads page markers, theme and layout to apply its UI; it does not upload
chat content. Website visits, package installation and updates still use the network.

The unchanged reference implementation under `site/` is not part of the
extension and uses public jsDelivr URLs to load its documented dependencies.

## 本地视频

导入的视频、缩略图、显示名称与启用项保存在背景 iframe 的 `backspace-videos` IndexedDB 中；不进入 `chrome.storage.sync`，不上传。扩展按宿主 origin 隔离素材。总容量受浏览器配额约束，清除站点或扩展数据可能删除素材；更换扩展 ID 后不能保证自动恢复。原始磁盘文件不受面板移除操作影响。文件限制与清理方式见[本地视频说明](video-background.md)。
