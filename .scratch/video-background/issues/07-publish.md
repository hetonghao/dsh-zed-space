# 07: 发布（npm + 插件市场 + 文档）

## 2026-10-25 进度核对

当前仍为本地候选版本；2026-10-25 查询官方 npm 返回 E404。等待 06 视频导入及集成验收，尚未发布，也不把本机安装视为发布。

**What to build:** 让用户能真正装到这一版。

### 现状是功能性缺陷

`dsh-backspace` 在 npm registry 返回 **404，从未发布**，而 `README.zh.md:150` 已经让用户
`dsh plugin --profile web add dsh-backspace@1.2.6`。按文档操作必然失败。

插件市场通过 npm 包名 + `dsh-plugin` 生态标识发现插件，所以包必须先发布。
`hetonghao/dsh-backspace` 的 Issues 目前是关闭的（`package.json` 的 `bugs` 指向它）。

### 文档要改的三处

1. **`README` 的产品定位**。第 44 行现在用"不是一个循环壁纸视频"来差异化——
   加了用户导入视频之后这句话不再成立。要么改，要么给出新的差异化表述。
2. **皮肤清单**。从"一个海洋皮肤"改成"3 个内置皮肤 + 可导入视频"，
   并写清每个皮肤的特性与配置项。
3. **安装/排错**。版本号、包名、能力矩阵（是否支持 Safari/iOS 要明确写，
   不要含糊——仓库没有任何 Safari/iOS 自动化，`README.zh.md:160-165` 的扩展安装也只承诺
   Chrome/Edge）。

### 发布前必须绿

- `npm run check`（`build:site` + `check:generated` + `test`）
- `npm run test:desktop`（两套桌面验收）
- `npm pack --dry-run` 清单核对：无媒体文件、无参考帧、无测试素材
- `dependencies` 仍为 `{}`，`devDependencies` 只有 playwright
- `THIRD_PARTY_NOTICES.md` 完整

**Blocked by:** 04（三皮肤完整）、06（导入可用）

**Status:** blocked

- [ ] `npm view dsh-backspace version` 返回已发布的版本号，不再是 404
- [ ] `dsh plugin --profile web add dsh-backspace@<新版本>` 在干净环境装得上
- [ ] 在 DSH 里能切换 3 个皮肤，每个皮肤有独立配置，公共配置生效
- [ ] 在插件商店按名称能搜到并正常下载安装
- [ ] 文档里的版本号与实际发布一致；按文档从零装一遍能成功
- [ ] 能力矩阵明确写了 Safari/iOS 支持与否
- [ ] `SECURITY.md` 与实现一致（特别是用户素材存储那一节）
- [ ] npm 包内不含视频/图片/参考帧；包体 ≤ 500KB
