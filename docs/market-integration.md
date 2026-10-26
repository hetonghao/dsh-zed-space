# DSH 视频市场接入

当前为 `1.0.0` 未发布候选版的本地接入：DSH 插件在全窗口画廊中复用市场的搜索和详情页。市场页面、目录和媒体服务均须在本机运行；尚未提供公网市场地址或原生 Electron 完整验收结论。

## 使用流程

1. 打开皮肤设置的「本地视频」，点击「发现官方精美视频皮肤」。
2. 在画廊搜索、打开详情并选择兼容的视频规格，点击添加。插件下载并校验后，将视频保存到「我的视频」。
3. 点击「应用视频并返回」才切换背景并返回 DSH；也可以先返回本地视频，稍后从列表选择。

顶部「返回本地视频」或 Esc 关闭画廊，并恢复发现入口的焦点。若已点击应用且仍在处理，返回请求会等待这次应用成功或失败后再关闭。重新打开会保留本次插件运行期间的搜索与筛选。原有磁盘文件导入方式继续可用。

- 每个视频最多 **32 MiB、30 秒、长边 1920 / 短边 1080 像素**，须通过现有 MP4/WebM 容器、编码和视频轨检查；具体要求见[本地视频背景](video-background.md)。超限规格可以预览，但不能添加到插件。
- 同一素材标识和 SHA-256 对应的来源已在当前素材库时复用已有条目，不重复入库，也不覆盖用户改过的显示名称。不同内容的版本可以成为新条目。
- 下载或校验阶段取消、关闭会停止后续导入。进入原子保存阶段后，「停止等待」或关闭可能留下已完成的副本；它会留在「我的视频」，不会自动应用。应用始终要求单独点击。
- 连接失败可点击「重新连接」。嵌入模式不会降级为浏览器另存文件；独立打开市场网站时，原有浏览器下载方式保留。

## 本地启动与安装

需要插件仓库、独立市场仓库，以及已经配置好的本地目录和公开媒体服务：

| 用途 | 当前固定地址 |
| --- | --- |
| 市场页面 | `http://127.0.0.1:4173/wallpapers` |
| 签名目录 | `http://127.0.0.1:8080/api/catalog` |
| 公开媒体前缀 | `http://127.0.0.1:9000/zed-space-public/` |
| 隔离 DSH Web 验证示例 | `http://127.0.0.1:4175/` |

市场站位于独立 `zed-space` 仓库的 `apps/website`，不是本插件仓库中的 `website/` 静态展示站。使用 Node.js 24，在该目录安装依赖、构建后启动：

```sh
cd /absolute/path/to/zed-space/apps/website
npm ci
npm run build
npm start
```

`npm start` 固定监听 `127.0.0.1:4173`；开发时可改用 `npm run dev`，同样占用 4173。网站启动命令不负责启动 8080/9000 服务，请按市场仓库的部署说明准备；端口已有服务时不要重复启动或结束正在使用的进程。

在插件仓库构建本地候选包：

```sh
cd /absolute/path/to/dsh-zed-space
npm ci
npm run build
npm pack
```

以下为 macOS 官方 CLI 的隔离安装示例。在同一终端执行，替换 tarball 的绝对路径；`mktemp` 创建专用目录，`DSH_HOME` 仅对各条 CLI 命令生效：

```sh
market_dsh_home="$(mktemp -d /tmp/zed-space-market-dsh.XXXXXX)"
market_dsh_cli="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
DSH_HOME="$market_dsh_home" "$market_dsh_cli" plugin --profile web add /absolute/path/to/dsh-zed-space/dsh-zed-space-1.0.0.tgz
DSH_HOME="$market_dsh_home" "$market_dsh_cli" web --host 127.0.0.1 --port 4175 --no-open
```

打开 CLI 打印的登录地址，勿将其中的认证参数复制进文档、截图或公开日志。其他安装位置使用对应官方 CLI；Web 与 Desktop 使用不同 profile，本示例不改变主 Desktop 的配置。停止隔离 Web 可在其终端按 Ctrl-C；保留隔离目录便于复查。常规安装及迁移见[DSH 安装说明](dsh-plugin.md)。

这些命令是可复现的安装步骤，不能单独证明整条流程验收通过。官方 CLI Web 的验证与原生 Electron 的验证应分别记录；原生 Electron 尚未验证。

## 下载与存储边界

新增网络访问用于展示官方画廊、读取可信目录并取得用户选中的视频。插件服务只对上述固定 loopback 上游发起读取请求，不接受任意 URL、不跟随重定向、不上传用户素材，也不加入遥测或远程代码执行。

- `plugin/market-server.js` 用固定 Ed25519 公钥验证原始目录签名；同源 `GET/HEAD /dsh-zed-space/market/catalog` 返回去除媒体 URL 的最小目录，`GET/HEAD /dsh-zed-space/market/media?asset=…&file=…` 只读取目录内的兼容视频。
- 市场消息只提交素材 ID 和 SHA-256，不提交下载 URL、Blob 或磁盘路径。双方核对实际窗口、准确 origin、协议版本及本次 session；查询参数中的 `parentOrigin` 不构成下载授权。
- `shared/market-download.js` 重新读取插件的可信目录，检查声明规格、响应字节数和 SHA-256；随后由现有视频接收端再次核验来源哈希并运行 `inspectVideo`，最后以 IndexedDB 事务入库。
- 文件和缩略图仍保存在 `backspace-videos`，遵守 iframe origin 与宿主 owner 隔离、浏览器存储配额和既有删除规则。市场网站不能直接读写这个库；更换 DSH 域名、端口或浏览器 profile 不会自动迁移素材。

接口只接受 GET/HEAD；非法参数为 400、未知素材为 404、超限规格为 413、签名或上游失败为 503。媒体响应开始后的流错误会断开连接，客户端完整性检查阻止残缺内容入库。安全边界及漏洞反馈见[安全说明](../SECURITY.md)。
