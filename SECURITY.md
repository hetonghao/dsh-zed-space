# Security policy

## Supported version

Zed Space Skin 1.0.0 is an unpublished candidate. After its first release, security fixes target the latest maintained release; inherited historical tags do not establish a Zed Space Skin release.

## Reporting a vulnerability

Please use [the new repository's security page](https://github.com/hetonghao/dsh-zed-space/security) and its **Report a vulnerability** form so a
report and any proof of concept remain private until a fix is available. If
private vulnerability reporting is unavailable, open a minimal issue that
does not include exploit details and ask the maintainer for a private channel.

Include the affected installation path (DSH plugin, source integration, static
installer, or browser extension), browser and Harness version, reproduction
steps, and expected impact.

## Security model

- The renderer, three.js modules, and fonts are bundled locally; the skin does
  not fetch remote code, analytics, or content.
- Preferences contain only appearance values and stay in `localStorage` or
  `chrome.storage.sync`, depending on the installation path.
- The DSH Host route serves only files inside the packaged `native-dist`
  directory and accepts only `GET` and `HEAD` requests.
- The extension is limited to `storage` and loopback Harness URLs on
  `127.0.0.1` or `localhost`.

These constraints are covered by repository and browser acceptance tests but
do not replace independent review of code before installation.

## 用户素材存储

用户导入的视频、缩略图、显示名称及启用项仅由背景 iframe 保存在 `backspace-videos`
IndexedDB 中，不进入 localStorage 或 chrome.storage.sync，不外传。每个文件上限 32 MiB，
整体容量受浏览器配额限制；支持面板内逐项移除，也可清除对应站点/扩展的数据。
移除不会改变磁盘上的原始文件。

消息边界校验父窗口来源、实际 origin 和每次挂载生成的 token。素材按浏览器认证的
宿主 origin 隔离；URL 中自报的 parentOrigin 不单独作为访问依据。文件及名称只以 Blob、
textContent 或表单值传递，用户名称不拼接进 HTML。文件大小、容器、编码、视频轨、尺寸、
时长与读取时限均在 iframe 的接收边界检查，写入采用 IndexedDB 事务。
