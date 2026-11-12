---
name: idea
description: "在项目文档工作流中，记录、整理或处理尚未承诺实施的想法与改进设想。用于随手记、想法去重和处理去向；记录不代表批准实施。"
---

# Idea

处理尚未承诺实施的项目想法。按[规则与方法读取](../../references/cli.md#规则与方法读取)先定位项目本地适用规范；包内[共同约定](../../tools/stonedocs/rules/docs/conventions.md)与[想法 SOP](../../tools/stonedocs/rules/docs/sop/idea.md)供未采用讨论或显式版本核对；处理方式和完成判断由这些文档维护。记录骨架见[想法输出结构与示例](../../tools/stonedocs/rules/docs/sop/idea.md#输出结构与示例)，资源版本见[固定快照清单](../../tools/stonedocs/rules/source.json)。

## 项目读取

按当前问题定位产品目标、ideas 及相关计划或任务，使用项目现有路径；已有资料或用户明确输入足够时可独立进入，不要求先调用其他技能或补建 Goal、Phase。先识别本次是讨论、只读整理还是授权写回，按项目采用的规则版本和明确差异处理；版本未知或契约冲突按共同约定处理。

## 执行适配

按想法 SOP 记录或处理，不把灵感改成已批准的范围、阶段或任务。已有承接工作时关联其唯一记录；采纳时说明接收去向，Goal 包含 Phase，Task 只能属于实际承接的 Phase。需要比较或确认时通过问题、依据和链接交接，不强制调用前序或后续技能。

需要按对象定位承接范围或读取项目 SOP 时，按[配套 CLI 用法](../../references/cli.md)使用只读入口。想法内容和去向仍按本 SOP 写回，不为记录灵感创建 Goal、Phase 或 Task。

## 输出

说明本次想法、期待价值、待讨论问题及已有去向；授权写回时更新项目 ideas，讨论或只读请求只返回建议。普通 Markdown 和 Git 即可使用，不依赖 CLI 或 Linear。
