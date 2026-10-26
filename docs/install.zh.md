# Zed Space Skin 安装与排错

Zed Space Skin · DeepSeek Harness 动态背景与界面皮肤

当前 `dsh-zed-space@1.3.0` 是未发布候选版。npm、GitHub Release 与市场条目尚未发布，不能把新包名当作当前可下载版本。现阶段使用经审核的本地 tarball；[发布资料](publishing/README.md)说明后续步骤。

## 迁移与安装

已安装 Backspace 时，先在同一 profile 卸载 `dsh-backspace`，再安装新包。不要删除 `.dsh`、会话目录或浏览器站点数据；数据边界见[迁移说明](publishing/migration.md)。

维护者可在仓库根运行 `npm ci`、`npm run build`、`npm pack` 生成本地候选包。构建完成后仍需安装验收。

Harness Web（在运行服务的电脑执行）：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-zed-space-1.3.0.tgz
```

重启 Web 服务，再刷新页面。Desktop 使用独立的 `desktop` profile；macOS 标准安装路径可完全退出 Desktop 后运行：

```sh
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add /absolute/path/to/dsh-zed-space-1.3.0.tgz
```

替换为真实 tarball 路径。[官方插件管理说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.md#installing-a-bundle)明确支持 tarball 与绝对本地路径；这些命令是安装指引，不能单凭文档视为本次候选版安装已验收。非标准应用位置请查找 Desktop 内置 CLI；Windows 不复制 macOS 路径。本次未提供 Windows 原生完整安装验证。

正式发布后，可在 Desktop「插件 → 添加插件」输入 `dsh-zed-space@1.3.0`，或在 Web 使用同版本 npm 包。只有 registry 可查询该版本后，这个入口才成立；选择镜像不会加速 GitHub 链接。

## 使用

打开左下角「皮肤设置」，选择海洋、事件视界、吸积涡旋或本地视频。两个宇宙入口是同一场景的不同视角。各皮肤分别保存设置；玻璃不透明度与对话面板独立背景可以分别调整。详见[本地视频](video-background.md)。

同一实例只启用一种安装方式。Chrome/Edge 扩展作用于浏览器中的 Harness 页面，不能给 Desktop 换肤。旧 React 源码集成仍只支持海洋。

## 常见情况

| 现象 | 处理 |
| --- | --- |
| npm 返回 404 | 候选版尚未发布；使用审核过的本地包，不要反复切换镜像 |
| 安装后没有设置入口 | 核对 profile，确认启用并重启对应实例 |
| `ERR_PNPM_MISSING_TARBALL_INTEGRITY` | 保留配置和 lockfile，使用已核验的本地 tarball，记录完整错误 |
| 迁移后视频列表为空 | 核对 origin、profile 和扩展 ID；保留原文件并按需重新导入 |
| 面板或文字看不清 | 降低背景影响，记录明暗模式、系统、Harness 和插件版本后反馈 |

卸载 Web 包用 `dsh plugin --profile web remove dsh-zed-space`；Desktop 在插件页停用或卸载。卸载不保证清理本地视频库；需要清理时在面板逐项移除，原文件不变。

新问题提交至 [GitHub Issues](https://github.com/hetonghao/dsh-zed-space/issues)，附安装方式、系统和版本；日志请先移除令牌与私人对话。
