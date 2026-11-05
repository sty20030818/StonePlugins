# 文档工作流

v0.6.1 提供 task、verify、review。Codex 限定入口为 `$stoneplugins:task`、`$stoneplugins:verify`、`$stoneplugins:review`，自动发现由技能描述与宿主处理，现有工程 hook 不路由这些工作流。

## 职责与使用

| 入口 | 适用请求 | 主要结果 |
| --- | --- | --- |
| [task](../plugins/stoneplugins/skills/task/SKILL.md) | 接续或拆分已明确的阶段任务 | 交付、唯一任务记录、证据和接续点 |
| [verify](../plugins/stoneplugins/skills/verify/SKILL.md) | 验收明确对象、复验、核对证据 | 逐条件结果、版本化证据和局限 |
| [review](../plugins/stoneplugins/skills/review/SKILL.md) | 阶段评审、复盘、按授权收尾 | 阶段判断、遗留处置和实际归档结果 |

同一执行者可以连续推进任务和验证，再根据证据写回结果。review 独立读取阶段资料，缺证据才补验证。修改状态遵守共同规则，不把 task 变成其他技能必须回调的状态工具。

## 规则作者源与分发

当前版本采用 StoneDocs 的共同约定与九项独立 SOP；此前的单体 SOP 与独立模板已退出运行资源。

共同规则在 StoneDocs 的 docs/conventions.md，独立流程在 docs/sop/；流程要求、记录骨架和示例由对应 SOP 统一维护，构成单一事实源。包内[共同约定](../plugins/stoneplugins/references/docs-system/conventions.md)、[SOP 导航](../plugins/stoneplugins/references/docs-system/sop/README.md)与九项流程是明确时点的逐字副本，共十一份 Markdown 资源。[来源清单](../plugins/stoneplugins/references/docs-system/source.json)记录仓库、基线提交、源状态、精确路径与哈希。StoneDocs 的 docs/guide.md 面向使用者串联流程，不随运行包分发；技能只保留项目读取、工具适配与输出路由，直接读取共同约定和对应 SOP 的“输出结构与示例”，不再维护独立模板或复制规则正文。

更新规则应先改作者源，同步上述十一份资源后重算来源清单并检查一致性，不手改包内副本。本版 sourceState 为 commit，baseCommit 指向真实作者源提交；发布时逐项从该提交读取原文并核对包内字节。开发中尚未提交的修改必须标为 working-tree，发布检查拒绝这类来源。

运行包不查找作者电脑或远端 latest。项目注明采用版本和明确差异，插件升级不会自动改写项目规范。首版验证范围为完整插件包，单独复制新技能文件夹的分发尚未支持。

## 本地验证

沿用 npm run check，覆盖类型、生成 hook、工程规则检查、文档工作流包级校验和测试。行为评测只在隔离资料中执行，显式读取技能文件不等于真实宿主自动路由或安装已经通过。

任务状态由 StoneDocs 的对应阶段持有，不在这里复制。本版结果见 [v0.6.1 验证](evals/v0.6.1.md)；[v0.6.0 验证](evals/v0.6.0.md)和[开发验收](evals/document-workflow-development.md)为历史结果，不替代本版实际宿主验收。
