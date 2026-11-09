---
name: task
description: "在采用文档工作流的项目中，拆分、接续、执行或移交已明确的阶段任务。用于继续指定任务、推进已确认成果、记录阻塞和交接工作。"
---

# Task

拆分、接续、执行或移交已明确的阶段任务。先读取项目入口、[共同约定](../../tools/stonedocs/rules/docs/conventions.md)与[任务 SOP](../../tools/stonedocs/rules/docs/sop/task.md)；任务操作、移交及完成判断由这些文档维护。记录骨架见[任务输出结构与示例](../../tools/stonedocs/rules/docs/sop/task.md#输出结构与示例)，资源版本见[固定快照清单](../../tools/stonedocs/rules/source.json)。

## 项目读取

沿项目入口定位所属 Goal 下的 Phase plan 与唯一 tasks，以及关联的 design、行为标准、决定和已有证据，使用项目现有路径。先识别本次是讨论、只读审查还是执行写回及实际授权；按项目采用的 SOP 版本和明确差异解释资料，版本未知或契约冲突按共同约定处理。

## 执行适配

按任务 SOP 使用项目已有工具和工程约束推进，所需能力以实际环境为准。需要验证时按 [verify SOP](../../tools/stonedocs/rules/docs/sop/verify.md) 处理，同一执行者可以连续完成；任务状态由当前执行者按共同约定和任务 SOP 写回，无需为状态循环调用技能。

按[配套 CLI 用法](../../references/cli.md)定位实际安装的工具，用 task show/list 读取本次对象。需要拆分时用 task new 创建所属 Phase 的任务；获准执行时用 task start，实际完成或明确取消后分别用 task done/cancel。前置 Goal/Phase 的创建或推进仅在本次范围已确认且获准时独立执行，不因 Task 自动推进父级。任务实质内容、代码和移交仍由当前执行者完成。

## 输出

说明本次任务及所属阶段、实际产物、适用验证结果、当前状态和必要接续信息，项目记录按任务 SOP 写回对应所有者。
