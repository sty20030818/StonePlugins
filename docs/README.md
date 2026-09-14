# StonePlugins 文档索引

## 先区分版本与实现

`v0.5.1` 为完整 Codex 插件：`stoneplugins` 同包提供 `engineering` Skill 与 Hooks，生命周期直接送达核心，核心生命周期与本地安装验收已通过。`v0.5.0` 基线仍是独立 Skill＋Hook-only 插件，必须结合版本、来源、目录与证据判断实际实现。

`0.5.1` 发布时的 60 次行为/token 对照延期仍是历史事实，见 [v0.5.1 评测](evals/v0.5.1.md)。`0.5.2` 恢复完整常驻原则与按需方法，保留三份主题细则的一级路由，取消二级选择器与格式文件必读；早先的过度精简中间稿不作为成功结果。检查与验收边界由 [v0.5.2 评测](evals/v0.5.2.md)持有，不继承旧版本结论。今后的评测先核对语义映射，再选少量正反触发和关键行为案例，按发现的问题扩大，采用当时默认模型并记录实际配置。

| 文档职责 | 唯一入口 | 使用规则 |
| --- | --- | --- |
| 当前安装与使用 | [仓库 README](../README.md) | 固定版本安装、本地试验与旧版迁移 |
| 当前架构决定 | [ADR-0004](adr/0004-codex-first-bundled-engineering.md) | 决定与取舍；不代替宿主验收 |
| 重构执行与待办 | [重构计划](plans/2026-09-14-codex-first-refactor.md) | 唯一活动实施清单，含 Claude/Grok 后置适配 |
| 领域语言 | [CONTEXT](../CONTEXT.md) | 概念定义，不作为实现规格 |
| 当前运行时核心与细则 | [SKILL.md](../plugins/stoneplugins/skills/engineering/SKILL.md) | 包内唯一正文与资源目录，不保留根目录副本 |
| 方法解释与晋升 | [methodologies](methodologies.md) | 语义映射与维护评审，不是运行时指令或必读目录 |
| 活动行为验收 | [behavior-cases](evals/behavior-cases.md) | 稳定案例库、小样本探索与按风险扩大的验收 |
| 本轮精简与纠偏依据 | [指令精简研究](research/2026-09-14-astra-instruction-simplification.md) | 保留原研究及方法删减的纠正，不要求指定模型，实施状态由活动计划持有 |
| 0.5.2 检查与验收边界 | [版本评测](evals/v0.5.2.md) | 区分候选检查、远端产物、更新安装与真实宿主接收 |
| 0.5.1 正式验收与发布证据 | [版本评测](evals/v0.5.1.md) | 持有生命周期结果、本次特定延期及实际发布状态 |
| 首次候选安装历史 | [开发验证](evals/codex-first-bundled-development.md) | 保留当时的信任状态、hash 与缓存检查，不能当作当前版本结果 |

## ADR 的保留与废弃边界

- [ADR-0001](adr/0001-decision-centered-methodology-disclosure.md)：历史记录；按决定说明真实影响的原则保留，旧标题与模板所有权不再适用。
- [ADR-0002](adr/0002-persistent-execution-contract.md)：常驻契约与条件细则原则继续有效；旧二级路由、格式文件所有权和 Hook 实现按当时版本理解。
- [ADR-0003](adr/0003-independent-skill-and-loader-hooks.md)：记录已发布 `0.5.0` 基线；其“插件不带 Skill、必须两步安装、Hook 只能提醒”已被 `0.5.1` 取代。
- [ADR-0004](adr/0004-codex-first-bundled-engineering.md)：`0.5.1` 已实现并通过核心生命周期验收，现补充已批准的完整方法保留与一级路由；单一来源、授权和验证要求保留。

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

[v0.3.4](evals/v0.3.4.md)、[v0.3.5](evals/v0.3.5.md)、[v0.3.6](evals/v0.3.6.md)、[v0.3.7](evals/v0.3.7.md)、[v0.4.0](evals/v0.4.0.md)、[v0.4.1](evals/v0.4.1.md)、[v0.5.0 候选](evals/v0.5.0.md)、[独立 Skill 开发验证](evals/independent-skill-development.md)、[完整插件首次候选验证](evals/codex-first-bundled-development.md) 与 [v0.5.1 评测](evals/v0.5.1.md)均为对应版本的历史证据；当前版本的证据边界见 [v0.5.2 评测](evals/v0.5.2.md)。

保留原始成功、失败、PENDING 和证据不足，不改写为新版本通过。v0.5.0 文件开头“尚未发布”属于当时的候选快照；发布状态与宿主行为验收本来就是两种证据。新方案必须留下自己的原始轨迹，不能继承这些结论。

## 归档方式

采用原位状态归档，不复制、不移动目录、不删除正文，保留已有链接与 Git 可追溯性。只有活动入口、错误的“现行路径”导航和替代关系会更新；历史代码示例和旧路径仍作为快照保留。当前没有要运行的历史待办，也没有为归档新增运行时兼容层。
