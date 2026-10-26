# npm 发布审核：dsh-zed-space

## 当前状态与包信息

`1.0.0` 是未发布的待审候选版本，尚未执行 `npm publish`。产品名称为 **Zed Space Skin**，定义为“Zed Space Skin · DeepSeek Harness 动态背景与界面皮肤”。

| 字段 | 候选值 |
| --- | --- |
| `name` | `dsh-zed-space` |
| `version` | `1.0.0` |
| `description` | Zed Space Skin · DeepSeek Harness 动态背景与界面皮肤 |
| `repository.url` | `git+https://github.com/hetonghao/dsh-zed-space.git` |
| `homepage` | `https://github.com/hetonghao/dsh-zed-space` |
| `bugs` | `https://github.com/hetonghao/dsh-zed-space/issues` |
| `license` | `MIT`；上游及第三方声明随包保留 |
| `publishConfig.access` | `public` |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| Node.js | `>=20` |

包名和版本由 npm 标识具体制品，展示名不作为安装参数。npm 必填的 `name`、`version` 及随包文件规则见 [package.json 文档](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)。

Zed Space Skin 使用独立版本序列，首发候选版为 `1.0.0`。Backspace 的历史 tags 和 `1.3.0-rc.*` 本地记录保留原版本号，不是新包的发布记录。

## 发布前验收

在仓库根目录运行：

```sh
npm ci
npm run check
npm run test:browser
npm run test:desktop
npm run test:video
npm run test:transitions
npm pack --dry-run --json
npm pack --pack-destination /absolute/path/to/review
```

逐项审阅最终 tarball：包名和版本、`cordis.patch.yml`、Host/Client 入口、海洋/宇宙/视频资源、MIT 许可、three.js MIT、Geist OFL、`THIRD_PARTY_NOTICES.md`。检查没有用户视频、令牌、浏览器配置或 QA 临时文件。实际安装这个 tarball 并验证三个背景、两个宇宙视角、参数恢复和旧存储迁移；构建通过不能替代安装验证。

README 的图片使用新仓库可读取的绝对 HTTPS 地址，文档链接也要在 npm 展示环境可访问。公开推送前的新 URL、尚未启用的 Pages 地址不算已验证可用链接。Pages 暂不启用；未来启用后再决定是否更改 homepage。相对链接若依赖未随包提供的文件，改用源码文档地址。

产品说明只描述已实现能力：海洋、宇宙双视角、本地视频、独立玻璃配置与背景切换。壁纸市场仍属规划。旧 React 源码集成仍仅接海洋，不作为多背景验收路径。

## 发布身份与审批边界

发布前由包维护者核对 npm 账户与包名权限。官方要求使用启用 2FA 的账户，或符合策略的 granular access token；CI 可按 npm 的 trusted publishing 流程配置。不要把令牌写入仓库、截图或本地证据。见 [npm 发布身份说明](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)和 [trusted publishing](https://docs.npmjs.com/trusted-publishers/)。本次未读取账户秘密，未配置 npm 发布凭据。

下面是**批准发布后才执行**的命令。本次仅准备资料：

```sh
npm whoami --registry=https://registry.npmjs.org
npm view dsh-zed-space@1.0.0 version --registry=https://registry.npmjs.org
npm publish /absolute/path/to/review/dsh-zed-space-1.0.0.tgz --access public --registry=https://registry.npmjs.org
```

`npm view` 返回 404 只说明此刻官方源取不到目标，不保证名字可注册。成功发布过的 `name@version` 不能复用；若发布后验证失败，应修复并增加版本，不能删除后重发同一版本。若改为预发布版本，显式使用 `--tag next`，避免覆盖 `latest`。[npm publish 规则](https://docs.npmjs.com/cli/v11/commands/npm-publish/)

## 发布后核验（尚未执行）

从官方 registry 下载对应 tarball，核对 `dist.integrity` 与本地审核制品；再验证精确版本安装。GitHub Release 若随后获批，上传与 registry 字节一致的 `dsh-zed-space-1.0.0.tgz` 和 `dsh-zed-space.tgz`，不另行重新打包。工作流必须手动触发且使用已核准 tag；本轮不触发。

```sh
npm view dsh-zed-space@1.0.0 name version repository dist --json --registry=https://registry.npmjs.org
node scripts/verify-release.mjs github.tgz registry.tgz dist.json
```

新仓库的历史 tags 来自迁移历史，不能当作 Zed Space Skin 已发布凭证。正式发布时间、registry 核验、GitHub 资产和市场收录各自记录。
