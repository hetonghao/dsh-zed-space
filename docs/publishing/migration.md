# 从 Backspace 迁移到 Zed Space Skin

## 名称和仓库

展示名改为 **Zed Space Skin**，npm 包、DSH 插件标识和仓库名改为 `dsh-zed-space`。新仓库为 [hetonghao/dsh-zed-space](https://github.com/hetonghao/dsh-zed-space)，正式版本从 `1.0.0` 开始，渠道状态见[发布记录](releases/1.0.0.md)。

新项目从旧项目已提交的多背景代码继续维护；保留 Git 提交、历史分支和 tags。旧仓库继续保留，旧 Issues/PR 不迁移。历史票据的具体链接仍指向 `hetonghao/dsh-backspace`；新反馈请到[新仓库 Issues](https://github.com/hetonghao/dsh-zed-space/issues)。原目录未提交的文档不混入此次源码迁移，`.scratch/` 既有记录保留历史含义。

## DSH 插件

1. 记录当前 Harness 版本、安装 profile 和已启用背景；保留导入视频的原始文件。
2. 在当前实例停用并卸载 `dsh-backspace`，确认没有旧插件继续运行。
3. 安装 `dsh-zed-space@1.0.0`，或使用 Release 中的 `dsh-zed-space-1.0.0.tgz`。
4. 重启同一实例，检查背景、玻璃设置、宇宙视角、视频列表与刷新恢复。

Web 的例子（本地 tarball 路径须换成真实文件）：

```sh
dsh plugin --profile web remove dsh-backspace
dsh plugin --profile web add /absolute/path/to/dsh-zed-space-1.0.0.tgz
```

Desktop 使用自己的 `desktop` profile；优先通过其插件页卸载旧包，或使用 Desktop 内置 CLI 安装本地包。不要因迁移删除整个 `.dsh`、会话目录或 lockfile。

## 保存的数据

为沿用旧设置，`bs*`、`skin*` 持久化键、`backspace-videos` 数据库以及源码集成的 `ui-backspace` 设置域保留原名。包名和资源路径改变，不要求清空这些数据。

数据仍受 origin 和浏览器 profile 隔离。**同一 origin、同一 profile 且原数据未被清除**时，现有设置和本地视频可以继续读取；改域名、端口、协议、profile 或清除站点数据会进入另一份存储或丢失已有数据。

浏览器扩展重装或换扩展 ID 可能改变扩展 origin，不能承诺原视频自动保留。视频没有跨扩展迁移或云同步功能；迁移前保留原文件，必要时重新导入。单纯保留数据库名称不能跨 origin 读取数据。

## 其他安装方式

静态安装用户使用新仓库 `native-dist/install-skin.sh` 的 `--update` 更新；安装器会清理旧名与新名的注入标记，再保留一份新注入。保留同源站点数据，升级后核对只出现一个设置入口。

旧 React 源码集成的私有包与 Cordis id/name 已改为 `dsh-zed-space@1.0.0` / `dsh-zed-space`；安装器原位更新旧包引用和旧 Cordis 标识。继续保留 `packages/client/ui-backspace` 和 `ui-backspace` 设置域，目前仍只接海洋。它不等同于根目录的可安装 DSH bundle，不承诺宇宙和本地视频。需要多背景时，先撤销旧源码集成，再切换到 bundle 安装路径。

## 回退

卸载新包后，使用迁移前留存且验证过的旧本地制品恢复旧安装。不要假定旧包可从 registry 下载；本项目不补发旧版本。回退时保留同源数据，旧版本不认识的新参数可能被忽略，本地视频也不保证在旧版本显示。

## 许可和来源

独立仓库与新品牌不改变历史代码来源。保留 Open Sea Skin、Backspace 版权和 MIT 许可，三方字体与渲染库继续遵守各自许可。详见 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。
