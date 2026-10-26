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

- 渲染器、three.js 与字体随包提供，不加载远程代码或遥测。DSH 视频市场新增固定
  loopback 目录与媒体读取，用于用户主动浏览和添加视频；范围见下文。
- Preferences contain only appearance values and stay in `localStorage` or
  `chrome.storage.sync`, depending on the installation path.
- DSH Host 静态路由仅提供包内 `native-dist` 文件；市场路由另外提供受限的目录与媒体
  读取。两者仅接受 `GET` 和 `HEAD`。
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

## 本地视频市场网络边界

市场页面固定为 `http://127.0.0.1:4173`。新增请求仅用于读取
`http://127.0.0.1:8080/api/catalog` 的 Ed25519 签名目录及目录内
`http://127.0.0.1:9000/zed-space-public/` 媒体；插件使用固定公钥，禁止重定向、
任意 URL 代理及通过 HTTP 修改信任配置。此接入不上传素材、不加入遥测。

嵌入通信校验实际窗口、准确 origin、版本和 session；网站提交的素材 ID 与哈希必须
重新匹配可信目录。插件下载时校验字节数及 SHA-256，现有视频接收端再次检查哈希、
真实容器和兼容性后才写入 IndexedDB。来源去重按当前 owner 范围执行，不跨宿主读取。
导入不等于应用；取消可能保留已原子写入的副本，但不会因下载完成而自动切换背景。

嵌入握手失败时不回退浏览器下载。独立市场网站的下载行为保留；完整流程和本地服务
要求见[视频市场接入](docs/market-integration.md)。CLI 登录地址含认证信息，不应公开。
