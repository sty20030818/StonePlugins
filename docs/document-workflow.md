# 文档工作流

v0.6.0 提供 task、verify、review。Codex 限定入口为 `$stoneplugins:task`、`$stoneplugins:verify`、`$stoneplugins:review`，自动发现由技能描述与宿主处理，现有工程 hook 不路由这些工作流。

## 职责与使用

| 入口 | 适用请求 | 主要结果 |
| --- | --- | --- |
| [task](../plugins/stoneplugins/skills/task/SKILL.md) | 接续或拆分已明确的阶段任务 | 交付、唯一任务记录、证据和接续点 |
| [verify](../plugins/stoneplugins/skills/verify/SKILL.md) | 验收明确对象、复验、核对证据 | 逐条件结果、版本化证据和局限 |
| [review](../plugins/stoneplugins/skills/review/SKILL.md) | 阶段评审、复盘、按授权收尾 | 阶段判断、遗留处置和实际归档结果 |

同一执行者可以连续推进任务和验证，再根据证据写回结果。review 独立读取阶段资料，缺证据才补验证。修改状态遵守共同规则，不把 task 变成其他技能必须回调的状态工具。

## 规则作者源与分发

通用规则在 StoneDocs 的 docs/sop.md，模板在 docs/templates.md。包内[规范](../plugins/stoneplugins/references/docs-system/sop.md)和[模板](../plugins/stoneplugins/references/docs-system/templates.md)是明确时点的逐字副本，[来源清单](../plugins/stoneplugins/references/docs-system/source.json)记录仓库、基线提交、源状态与哈希。

更新规则应先改作者源，同步这两个文件后重算来源清单并检查一致性，不手改包内副本。v0.6.0 的 sourceState 为 commit，baseCommit 为 `67c3a415f95b92e0c802165df0c326099409e411`，已逐字核对真实源提交。未来更新也须固定实际源版本；发布检查拒绝 working-tree 来源。

运行包不查找作者电脑或远端 latest。项目注明采用版本和明确差异，插件升级不会自动改写项目规范。首版验证范围为完整插件包，单独复制新技能文件夹的分发尚未支持。

## 本地验证

沿用 npm run check，覆盖类型、生成 hook、工程规则检查、文档工作流包级校验和测试。行为评测只在隔离资料中执行，显式读取技能文件不等于真实宿主自动路由或安装已经通过。

开发试跑由 StoneDocs P002 管理，发布安装与宿主验证由 P003 承接，任务状态不在这里复制。当前版本结果见 [v0.6.0 验证](evals/v0.6.0.md)，历史结果保留在[开发验收](evals/document-workflow-development.md)。
