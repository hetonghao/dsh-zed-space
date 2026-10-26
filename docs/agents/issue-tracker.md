# 票据管理：GitHub

本项目的票据与规格以 [GitHub Issues](https://github.com/hetonghao/dsh-zed-space/issues) 为唯一维护入口，使用 `gh` CLI；`.scratch/` 只存本地临时资料。
所有命令显式指定 `--repo hetonghao/dsh-zed-space`，避免操作到 `upstream` 仓库。

## 操作约定

- 创建票据或规格：`gh issue create --repo hetonghao/dsh-zed-space --title "标题" --body-file <正文文件>`。
- 读取票据：`gh issue view <编号> --repo hetonghao/dsh-zed-space --json number,title,body,state,labels,comments`。
- 查询待办：`gh issue list --repo hetonghao/dsh-zed-space --state open --limit 100 --json number,title,body,labels`；按需使用 `--label` 筛选并处理分页。
- 更新正文：`gh issue edit <编号> --repo hetonghao/dsh-zed-space --body-file <正文文件>`。
- 追加证据：`gh issue comment <编号> --repo hetonghao/dsh-zed-space --body-file <记录文件>`。
- 设置标签：`gh issue edit <编号> --repo hetonghao/dsh-zed-space --add-label <标签>`；移除用 `--remove-label`。
- 结票：先记录完成范围、验收证据和被后续决定替代的旧约定，再用 `gh issue close <编号> --repo hetonghao/dsh-zed-space --reason completed`。

多行正文先写 UTF-8 文件，通过 `--body-file` 传入。技能要求“发布到 issue tracker”时创建 GitHub Issue；要求“获取相关票据”时同时读取正文、标签和评论。

## 规格、状态与关联

- 总规格维护在一个 Issue，使用 `documentation` 标签；实施票链接总规格，总规格列出实施票清单。
- 使用 GitHub 子 Issue 表示规格与实施票的关系；不可用时保留总规格任务清单和实施票中的 `Part of #<规格编号>`。
- 阻塞关系使用原生 issue dependencies；不可用时在票据顶部写 `Blocked by: #<编号>`，所有阻塞票关闭后才解除阻塞。
- 实施票使用 `bug` 或 `enhancement` 分类，分诊标签按 `triage-labels.md`。分诊表示是否可交付执行，正文 `Status` 记录执行进度；迁移保留既有状态，领取时才设置负责人。
- 未完成验收保持未勾选；`done` 映射为 GitHub 已完成关闭，进行中和待执行保持打开。公开发布单独验收，本机安装不等于发布。
- 进度与原型决策作为相关 Issue 的评论保存。后续直接更新 GitHub，不维护第二份本地票据或规格。
- 只上传规格、票据与文字结论；素材、截图、安装包和原始日志留在本地。

历史 Issues/PR 仍在 `hetonghao/dsh-backspace`，已有具体链接保持原目标；新票据在本仓库创建。需要读取旧票据时显式指定旧仓库，不能按旧编号向新仓库写入。

## PR 分诊开关

**PRs as a request surface: no.**

GitHub Issue 与 PR 共用编号；明确引用 PR 时用 `gh pr view` 识别，不作为待分诊票据自动采集。
