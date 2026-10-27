# DSH 社区市场提交资料

## 目标与状态

本次目标是 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，即 dsh-market 使用的社区清单。它与 `DshMarketPlace/awesome-dsh-plugin` 是不同项目，不套用后者的提交数要求。当前未提交市场 PR，也未声明已经收录。

于 2026-10-26 重新核验官方仓库，规则固定到 `a7ae7b2a1295e96b2a84268ed0443f1aead14f33`：[贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/a7ae7b2a1295e96b2a84268ed0443f1aead14f33/contributing.md)。正式提交前应再核对最新规则。

## 可以提交的文件

将 [hetonghao__dsh-zed-space.yml](data/plugins/hetonghao__dsh-zed-space.yml) 原样复制到目标仓库的 `data/plugins/hetonghao__dsh-zed-space.yml`。PR 只增加这一个条目，不改生成的 README 或其他插件。

必填字段为 `url`、`name`、`category`、`description.en`；中文描述可选。当前使用展示名 `Zed Space Skin` 和 `theme` 分类。不要增加 `npm` 或 `version`：原版[校验器](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/a7ae7b2a1295e96b2a84268ed0443f1aead14f33/scripts/lib/entries.mjs)会拒绝额外字段。

`icon` 已填写新仓库 `extension/icons/icon128.png` 的 raw URL，需等新 main 推送后核对可达。该字段可选，仅接受 GitHub 托管的 HTTPS 位图（PNG/JPG/JPEG/WebP），不接受 SVG。`tarball` 可选；没有 npm 且不能源码安装时，需要提供 GitHub Release 上的预构建包。本轮未发 Release，所以不填写尚不存在的下载链接。若用 `latest/download/`，资产名应固定为 `dsh-zed-space.tgz`；版本化文件名应绑定具体 release tag。

## 提交前条件

- 新仓库公开可读，包含真实可用源码；`package.json` 声明 `dsh.bundle`，并有可用的 patch 文件。
- 仓库创建至少满 1 天；没有最低提交数门槛。迁移的旧提交日期不能替代新仓库的创建时间。
- GitHub topic 含 `dsh-plugin`；npm keyword 不能替代 topic。
- 最终新品牌制品完成安装验证，描述、截图和实际可用功能一致。
- 保留上游来源与许可；相较已收录海洋皮肤，说明新增宇宙双视角、本地视频及各皮肤配置。换名字本身不构成收录差异。

以上来自官方贡献指南。fork 可以因新增功能或维护质量被收录，但 CI 通过只是前提，维护者仍会读代码决定是否重复或描述夸大。

截图可在本仓库根 `screenshots.json` 声明 1–8 张真实界面图片，路径不能越出目录；图形资产完成后逐个核对。视频市场目前只完成本地接入，公网尚未开放；提交材料应区分本地验收能力与普通用户可用的在线服务。

## npm 映射和 Discover

清单的 [npm 探测器](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/a7ae7b2a1295e96b2a84268ed0443f1aead14f33/scripts/probe-npm.mjs)读取仓库根 `package.json.name`，随后检查 registry 包的 `repository` 是否回指同一 GitHub 仓库。因此根包必须为 `dsh-zed-space`，且 npm 元数据也指向新仓库；不在 YAML 手写 npm 映射。

未发 npm 不自动阻止清单收录，但该项目的 [Discover 索引导出器](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/a7ae7b2a1295e96b2a84268ed0443f1aead14f33/scripts/lib/market-index.mjs)会过滤缺少 npm、版本和发布时间的记录。清单出现、网页出现和 Discover 可安装各自核验，不视为同一完成状态。

## 本地校验与后续操作

本轮用固定 SHA 的原版 `readEntries` 解析实际 YAML，再执行 `validateEntries`；记录在本地 `.omo/zed-migration/market-validation.json`。字段验证不检查远程仓库年龄、实际安装、图标可达性，也不代替完整市场 CI。

发布负责人核对新仓库创建时间和可安装性后，将这个 YAML 复制到自己的市场 fork，并运行该仓库校验。只有收到提交授权后才创建 PR。本次没有登录市场账号、创建市场 PR 或提交条目。

建议 PR 正文：

> 新增 Zed Space Skin，面向 DeepSeek Harness 的动态背景与界面皮肤。基于 Open Sea Skin / Backspace 的海洋实现，保留来源与许可；新增宇宙双视角、本地视频素材管理、各皮肤独立配置与背景切换。根目录提供可安装的 dsh.bundle。旧 React 源码集成仍仅接海洋；视频市场已完成本地接入，公网平台尚未开放；无法连接时提示用户继续使用本地视频。仓库、制品和验证链接请在正式提交前填写实际公开地址。
