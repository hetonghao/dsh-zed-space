# DSH 社区市场提交资料

目标为 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，即 dsh-market 使用的社区清单。首次收录 [PR #9976](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/9976) 已于北京时间 2026-10-29 合并。产品定位更新见[1.0.2 发布记录](releases/1.0.2.md)。

2026-10-28 核对规则，版本为 `0b3d3606b217699e7097a3c4d531bb90c6c3887c`：[贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/0b3d3606b217699e7097a3c4d531bb90c6c3887c/contributing.md)。

## 提交内容

PR 只修改 `data/plugins/hetonghao__dsh-zed-space.yml`，内容见[本地 YAML](data/plugins/hetonghao__dsh-zed-space.yml)。不修改生成的 README 或其他条目。

- 产品展示名为 Zed Space Skin；市场保留维护者采用的条目名 `hetonghao/dsh-zed-space`，分类为 `theme`。
- 产品定位：Zed Space Skin · DeepSeek Harness 动态背景与界面皮肤。原生个性化动态背景皮肤，以及市场下载精美的动态壁纸。
- 中英文描述同步原生动态背景与市场下载能力，并保留维护者追加的 Open Sea Skin 来源与避免同时安装提示。
- `icon` 指向仓库中的产品 PNG；使用 GitHub 托管的 HTTPS 位图，不使用作者头像或 SVG。
- `tarball` 使用 `releases/latest/download/dsh-zed-space.tgz`，固定资产名，后续版本继续提供同名文件。
- 不添加 `npm` 或 `version` 字段；市场从根 `package.json.name` 探测 npm，并核对 npm 元数据中的仓库地址。

根 `screenshots.json` 列出五张真实 Harness Web 截图：两种黑洞、海面及两种视频。每张均展示当前配置面板，截图参数与来源见[截图说明](../screenshots/README.md)。

## 收录条件与边界

仓库需公开、有可运行代码、创建满一天、带 `dsh-plugin` topic，并在 `package.json` 声明可用的 `dsh.bundle`。本项目保留 Open Sea Skin 来源与 MIT，差异为宇宙双视角、本地视频素材管理、各皮肤独立配置和切换效果。

[公网壁纸市场](https://zed-space.ai-cove.com/wallpapers)已上线，`1.0.1` 接入该服务，验证结果见[发布记录](releases/1.0.1.md)。文案更新 PR 仍需维护者审核；清单合并、网页展示与 Discover 可安装分别核验。

## 校验

用上述市场源码版本的 `readEntries` 与 `validateEntries` 检查实际 YAML，再运行该仓库的 submission gate 检查目标仓库、年龄、topic 和 bundle。提交时附 npm、Release 与验证记录链接，不把本地字段校验视为市场审核通过。
