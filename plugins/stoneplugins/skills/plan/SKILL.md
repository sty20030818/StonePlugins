---
name: plan
description: "在项目文档工作流中，规划或调整产品目标（Goal）或成果阶段（Phase）的范围、验收条件、依赖和推进路线。用于形成目标或阶段计划；不用于一般生活安排。"
---

# Plan

根据已确认成果规划或调整 Goal 或 Phase，先明确本次对象。先读取项目入口、[共同约定](../../tools/stonedocs/rules/docs/conventions.md)与[计划 SOP](../../tools/stonedocs/rules/docs/sop/plan.md)；输入、操作、写回与完成判断由这些文档维护。填写结构见[计划输出结构与示例](../../tools/stonedocs/rules/docs/sop/plan.md#输出结构与示例)，资源版本见[固定快照清单](../../tools/stonedocs/rules/source.json)。

## 项目读取

沿项目入口读取PRD、roadmap、已有 Goal 及其 Phase、适用规则和已确认依赖。可直接从用户明确给出的成果与约束进入，不要求 idea、story 或其他技能已经运行；优先接续同一成果的已有计划。按项目采用的规则版本和明确差异解释材料，版本未知或契约冲突按共同约定处理。

## 执行适配

按计划 SOP 使用项目既有路径组织 Goal、所属 Phase 与 roadmap 的关系。故事、技术方案或任务需要进一步展开时，可由当前执行者按相应 SOP 补充所需工作，不把兄弟技能的可用性或调用记录设为规划前置；本次实际产出仍由授权范围决定。

按[配套 CLI 用法](../../references/cli.md)定位实际安装的工具。需要创建已确认的 Goal/Phase 时，用对应 new 命令预览及应用；已有计划的语义调整仍直接编辑其所有者。明确发布意图才使用 release plan/show，不从 Goal 标识推断版本。首次采用或明确规范升级时分别查看 init/upgrade 帮助，先预览；插件更新不触发项目升级。

## 输出

说明本次对象、成果、范围、验收条件、组成或依赖及未决事项，给出实际计划与导航入口或讨论草案；计划成立与交付完成分别表述。
