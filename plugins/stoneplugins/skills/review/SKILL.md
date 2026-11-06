---
name: review
description: "审阅产品目标（Goal）或成果阶段（Phase）的成果、验收证据、基线同步和遗留处置，形成判断，并在授权范围内收尾归档。用于成果审阅；不替代普通代码或 PR 审查。"
---

# Review

审阅 Goal 或 Phase 的成果与条件，先明确本次对象，按授权记录复盘或收尾；普通代码、PR 审查由相应工程审阅流程承接。先读取项目入口、[共同约定](../../references/docs-system/conventions.md)与[成果审阅 SOP](../../references/docs-system/sop/review.md)；成果判断、遗留处置及收尾归档由这些文档维护。记录骨架见[成果审阅输出结构与示例](../../references/docs-system/sop/review.md#输出结构与示例)，资源版本见[固定快照清单](../../references/docs-system/source.json)。

## 项目读取

沿项目入口定位对应 plan、验收及适用标准，按需读取组成阶段的 plan/tasks、真正受影响的基线和遗留接收依据。先识别只读评审、记录复盘或实际收尾归档及本次授权；按项目采用的规则版本和明确差异解释资料，版本未知或契约冲突按共同约定处理。

## 执行适配

按成果审阅 SOP 使用项目已有工具核对资料。需要补充验证时按 [verify SOP](../../references/docs-system/sop/verify.md) 处理，同一执行者可以连续完成；相关状态由当前执行者按共同约定和成果审阅 SOP 写回，无需为状态循环调用技能。

## 输出

说明 Goal 或 Phase 的结论、依据、遗留去向、实际状态或归档结果及后续建议，已批准工作与待讨论建议分开表达，项目记录按成果审阅 SOP 写回对应所有者。
