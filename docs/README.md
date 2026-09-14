# StonePlugins 文档索引

## 先区分版本与实现

`v0.5.1` 为完整 Codex 插件：`stoneplugins` 同包提供 `engineering` Skill 与 Hooks，生命周期直接送达核心，核心生命周期与本地安装验收已通过。`v0.5.0` 基线仍是独立 Skill＋Hook-only 插件，必须结合版本、来源、目录与证据判断实际实现。

本次 `0.5.1` 的 60 次行为/token 对照经用户确认后置；默认规范继续保留，延期与正式验收仅由 [v0.5.1 评测](evals/v0.5.1.md)持有。后置项目不能记为通过，也不能用旧候选记录代替新版本证据。

| 文档职责 | 唯一入口 | 使用规则 |
| --- | --- | --- |
| 当前安装与使用 | [仓库 README](../README.md) | 固定版本安装、本地试验与旧版迁移 |
| 当前架构决定 | [ADR-0004](adr/0004-codex-first-bundled-engineering.md) | 决定与取舍；不代替宿主验收 |
| 重构执行与待办 | [重构计划](plans/2026-09-14-codex-first-refactor.md) | 唯一活动实施清单，含 Claude/Grok 后置适配 |
| 领域语言 | [CONTEXT](../CONTEXT.md) | 概念定义，不作为实现规格 |
| 当前运行时核心与细则 | [SKILL.md](../plugins/stoneplugins/skills/engineering/SKILL.md) | 包内唯一正文与资源目录，不保留根目录副本 |
| 方法分类与晋升 | [methodologies](methodologies.md) | 非运行时治理资料，继续有效 |
| 活动行为验收 | [behavior-cases](evals/behavior-cases.md) | 十个稳定案例、评分与按版本区分的加载证据 |
| 0.5.1 正式验收与发布证据 | [版本评测](evals/v0.5.1.md) | 持有生命周期结果、本次特定延期及实际发布状态 |
| 首次候选安装历史 | [开发验证](evals/codex-first-bundled-development.md) | 保留当时的信任状态、hash 与缓存检查，不能当作当前版本结果 |

## ADR 的保留与废弃边界

- [ADR-0001](adr/0001-decision-centered-methodology-disclosure.md)：历史记录；按决定说明真实影响的原则保留，旧标题与模板所有权不再适用。
- [ADR-0002](adr/0002-persistent-execution-contract.md)：常驻契约与条件细则原则继续有效；旧 Hook 实现不直接复活。
- [ADR-0003](adr/0003-independent-skill-and-loader-hooks.md)：记录已发布 `0.5.0` 基线；其“插件不带 Skill、必须两步安装、Hook 只能提醒”已被 `0.5.1` 取代。
- [ADR-0004](adr/0004-codex-first-bundled-engineering.md)：`0.5.1` 已实现并通过核心生命周期验收；取代的是上述实现约束，不是单一来源、授权或验证要求。

## 研究档案

所有研究均原位保留，供追溯来源；其中的“当前”“推荐”“P0/P1”和未完成项只描述研究当时，不能覆盖活动决定或自动生成任务。

| 档案 | 保留价值 |
| --- | --- |
| [工程规则审计](research/2026-08-27-stonefish-engineering-audit.md) | 早期规则与来源审计 |
| [方法索引与路由](research/2026-08-27-methodology-index-and-routing.md) | 条件方法组织的历史理由 |
| [决策透明度](research/2026-08-28-methodology-disclosure-and-decision-transparency.md) | 公开说明的证据边界 |
| [披露文案结构](research/2026-08-29-engineering-rationale-copy-structure.md) | 文案迭代过程；具体格式不再由研究持有 |
| [常驻规则与评测](research/2026-08-31-persistent-engineering-rules-and-evaluation.md) | 常驻契约与行为验收依据 |
| [完整插件首轮研究](research/2026-09-14-plugin-bundled-skills.md) | 打包与跨宿主证据；短提醒优先建议已修正 |
| [Codex 优先工作流比较](research/2026-09-14-codex-first-workflow-patterns.md) | 六个项目的固定源码证据，已形成 ADR-0004 |

## 版本与开发验证档案

[v0.3.4](evals/v0.3.4.md)、[v0.3.5](evals/v0.3.5.md)、[v0.3.6](evals/v0.3.6.md)、[v0.3.7](evals/v0.3.7.md)、[v0.4.0](evals/v0.4.0.md)、[v0.4.1](evals/v0.4.1.md)、[v0.5.0 候选](evals/v0.5.0.md)、[独立 Skill 开发验证](evals/independent-skill-development.md) 与 [完整插件首次候选验证](evals/codex-first-bundled-development.md) 均为历史证据；[v0.5.1 评测](evals/v0.5.1.md)持有当前正式验收。

保留原始成功、失败、PENDING 和证据不足，不改写为新版本通过。v0.5.0 文件开头“尚未发布”属于当时的候选快照；发布状态与宿主行为验收本来就是两种证据。新方案必须留下自己的原始轨迹，不能继承这些结论。

## 归档方式

采用原位状态归档，不复制、不移动目录、不删除正文，保留已有链接与 Git 可追溯性。只有活动入口、错误的“现行路径”导航和替代关系会更新；历史代码示例和旧路径仍作为快照保留。当前没有要运行的历史待办，也没有为归档新增运行时兼容层。
