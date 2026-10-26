# 参与 Zed Space Skin 开发

新问题与规格提交至 [hetonghao/dsh-zed-space Issues](https://github.com/hetonghao/dsh-zed-space/issues)。请说明受影响路径：DSH bundle、旧 React 源码集成、静态安装或 Chrome/Edge 扩展。历史票据仍在旧仓库，具体链接保持原目标。

## 开发

使用 Node.js 20 或更高版本：

```sh
npm ci
npm run build
npm run check
npm run test:browser
```

共享运行时代码在 `shared/`；修改后运行构建，同步各安装路径的生成副本。`plugin/client.js` 由 `scripts/build-dsh-bundle.mjs` 生成，`plugin/index.js` 负责同源静态资源路由。新增网络访问、远程代码、遥测或扩展权限需另行说明理由和范围。

## 界面与截图

保持键盘可操作性和减少动态效果支持。截图来自实际运行界面；注明 Harness、插件版本与安装路径，核对深浅色及窄屏。根目录 `screenshots.json` 声明市场展示图片，提交前逐张检查路径和内容。

## 提交与发布

改动保持聚焦，说明用户能看到的变化、运行过的检查与未覆盖范围；重要变化更新 `CHANGELOG.md`。不提交 Harness 用户配置、令牌、私人对话、用户视频或临时测试输出。

当前 `1.3.0` 是未发布候选版。发布与市场提交按 [发布资料](docs/publishing/README.md)执行；源码合并不等于 npm 发布。保留原版权、上游来源和第三方许可。
