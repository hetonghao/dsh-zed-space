# Zed Space Skin 静态安装器

此方式适用于运行预构建 Harness、不编译客户端插件的用户。技术名为 `dsh-zed-space`；安装器将皮肤资源复制到前端的 `dsh-zed-space/` 目录，并在 `</head>` 前插入带标记的延迟加载脚本，资源路径为 `/dsh-zed-space/`。

当前 `1.0.0` 是未发布候选版，npm、GitHub Release 与市场条目尚未发布。候选阶段使用新仓库 clone 后的本地脚本；正式远程安装入口须在发布审核通过、制品可获取后再启用。

## 安装、更新与卸载

操作前停止 Harness。完成后重新启动（CLI 用户运行 `dsh web`），保持服务运行，再刷新浏览器。服务停止时，已打开的页面可能显示 **Failed to load plugins**，这不代表前端文件已经损坏。

克隆 [hetonghao/dsh-zed-space](https://github.com/hetonghao/dsh-zed-space) 后，在仓库根目录按需选择命令：

```sh
cd dsh-zed-space
bash native-dist/install-skin.sh --dry-run
bash native-dist/install-skin.sh
bash native-dist/install-skin.sh --update
bash native-dist/install-skin.sh --uninstall
```

`--dry-run` 只列出匹配的安装目录；用 `--dist PATH` 或 `DSH_DIST` 环境变量指定一个准确的前端构建目录。自动检测覆盖 npx 缓存、常见全局 npm 包、相邻的 Harness 源码构建，以及当前目录下的 `apps/web/dist`。

安装和 `--update` 都会清理 `dsh-backspace` 与 `dsh-zed-space` 的旧注入标记和旧资源目录，将清理后的当前首页备份为 `index.html.bs-backup`，再写入一份新加载脚本。已有静态安装可直接用 `--update` 迁移；同一实例只启用一种安装方式，更新后核对只有一个设置入口。

卸载清理新旧注入标记、资源目录及安装器备份，不会用旧首页覆盖已经升级的 Harness。每次升级 Harness 后需重新运行 `--update`，因为升级可能替换前端首页和资源。

## 设置与本地视频

安装器不清理浏览器存储；`bs*`、`skin*` 设置键与 IndexedDB `backspace-videos` 保留原名。同一 origin、同一浏览器 profile 且原数据未被清除时，设置和视频可以继续读取。改域名、端口、协议或 profile 会进入另一份存储；清除站点数据可能丢失视频，迁移前请保留原文件。详见[迁移说明](../docs/publishing/migration.md)。

Zed Space Skin 延续 Backspace 的代码与历史；改名不改变既有版权和第三方许可，见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。
