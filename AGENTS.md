# HTH 编码规范

- 交流及给用户看的文档统一用中文。
- Matt Pocock 与 OMO 的同类流程技能，除非用户点名，否则默认不同时使用。
- 主 Agent 在任务非简单且改动意图有明显二义性或风险时，先向用户确认；子 Agent 按主 Agent 已确认范围执行。
- 重构及业务逻辑调整遵循奥卡姆剃刀与第一性原理，删除不再需要的旧逻辑。
- 存在 `.codegraph/` 时，理解或定位代码先用 CodeGraph；目录不存在时不建立索引。

# 项目 Agent 约定

## Agent skills

### Issue tracker

票据与规格统一维护在 `hetonghao/dsh-zed-space` 的 GitHub Issues；创建、领取、更新或结票前读取 `docs/agents/issue-tracker.md`。

### Triage labels

使用 Matt Pocock 默认五类分诊标签；分诊时读取 `docs/agents/triage-labels.md`。

### Domain docs

采用 single-context：根目录 `GLOSSARY.md` 与 `docs/adr/`；探索领域概念或设计决策前读取 `docs/agents/domain.md`。

发布前读取 `docs/publishing/README.md`；实际渠道状态见 `docs/publishing/releases/1.0.0.md`。历史 `.scratch/` 资料、旧 Issues/PR 链接与版权声明保留原含义。
