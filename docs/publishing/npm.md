# npm 发布与核验：dsh-zed-space

当前版本为 `1.0.1`，实际结果见[发布记录](releases/1.0.1.md)。产品名称为 **Zed Space Skin**，定义为“Zed Space Skin · DeepSeek Harness 动态背景与界面皮肤”。

## 包信息

| 字段 | 值 |
| --- | --- |
| `name` | `dsh-zed-space` |
| `version` | `1.0.1` |
| `description` | Zed Space Skin · DeepSeek Harness 动态背景与界面皮肤 |
| `repository.url` | `git+https://github.com/hetonghao/dsh-zed-space.git` |
| `homepage` | `https://github.com/hetonghao/dsh-zed-space` |
| `bugs` | `https://github.com/hetonghao/dsh-zed-space/issues` |
| `license` | MIT；保留上游及第三方声明 |
| `publishConfig.access` | `public` |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| `icon` | `./native-dist/icons/icon128.png`，随包提供 |
| Node.js | `>=20` |

安装参数使用技术包名，展示名通过 `./locale/*.json` 导出。字段规则见 [npm package.json 文档](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)。旧 tag 经备份后清理，新仓库从 `v1.0.0` 开始；历史提交和变更记录保留。

## 发布前检查

```sh
npm ci
npm run build
npm run check
npm run test:browser
npm run test:desktop
npm run test:video
npm run test:transitions
npm run package:extension
npm pack --dry-run --json
npm pack --ignore-scripts --pack-destination /absolute/path/to/review
```

检查最终 tarball 的包名、版本、patch、Host/Client 入口、图标、locale、海洋/宇宙/视频资源、MIT、three.js MIT、Geist OFL 和第三方声明。包中不应含用户视频、令牌、浏览器配置或测试临时文件。用临时 Harness profile 安装最终 tarball，核对插件列表图标、设置面板和背景。

README 图片必须可公开访问。[公网壁纸市场](https://zed-space.ai-cove.com/wallpapers)已上线，发布前核对页面连接、目录签名和视频下载；旧 React 源码集成仍只接海洋。Pages 和浏览器扩展商店单独发布。

## 发布

先核对 npm 身份和目标版本是否存在，再发布已审核的同一个 tarball。首次发布可在本机完成登录与 2FA；后续 CI 可配置 [trusted publishing](https://docs.npmjs.com/trusted-publishers/)。不要把凭据写入仓库或日志。

```sh
npm whoami --registry=https://registry.npmjs.org
npm view dsh-zed-space@1.0.1 version --registry=https://registry.npmjs.org
npm publish /absolute/path/to/review/dsh-zed-space-1.0.1.tgz --ignore-scripts --access public --registry=https://registry.npmjs.org
```

已成功发布的 `name@version` 不能重复使用；修复后必须增加版本。预发布显式使用 `--tag next`，避免覆盖 `latest`。见 [npm publish 规则](https://docs.npmjs.com/cli/v11/commands/npm-publish/)。

## 发布后核验

从官方 registry 下载 tarball，核对 `dist.integrity`、SHA-256 和本地制品，再验证精确版本安装。GitHub Release 上传相同字节的 `dsh-zed-space-1.0.1.tgz` 与 `dsh-zed-space.tgz`，另附扩展 ZIP 和 `SHA256SUMS`。

```sh
npm view dsh-zed-space@1.0.1 name version repository dist --json --registry=https://registry.npmjs.org
node scripts/verify-release.mjs github.tgz registry.tgz dist.json
```

现有 Actions 发布工作流只支持手动触发，要求已存在 Release 和 `NPM_TOKEN`。本机已发布的版本不要再次触发该工作流。
