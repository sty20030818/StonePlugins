<!-- stonedocs:linear-guide:v1 {"schemaVersion":1,"source":{"repository":"https://github.com/sty20030818/StoneDocs","revision":"659543825e8ad2586132afd0eb53b1e3aa3bcf8b","state":"commit","path":"handbook/integrations/linear.md"},"sha256":"6921c971d955e999b19771417c4abdb3063126f0d80075c3e4e99474c5aab073"} -->
# 使用 Linear 管理文档工作

本指南拥有文档工作流与 Linear 的适配方式、操作路线及官方资料入口。Goal、Phase、Task 的定义、状态和验收依据由项目采用的共同约定与对应 SOP 维护。仓库保留正式事实，Linear 展示进展和原生协作信息；本指南不维护账号、安装状态或另一份任务清单。

## 对象与归属

个人多项目默认保留个人 Workspace，各项目使用专属 Team；已有项目先核对真实协作边界和明确映射，不自动迁移其他项目。Team 不增加文档层级。

| 文档对象 | 默认 Linear 表达 | 负责什么 |
| --- | --- | --- |
| 项目 | 专属 Team | 区分项目工作域与 Issue 工作流 |
| Goal | Team 下的目标总览文档 | 展示成果、整体判断、阶段入口及独立验收入口 |
| Goal 的阶段成员 | Project 标签，例如 `StoneDocs/V1` | 聚合属于本 Goal 的阶段，可用 Project 过滤视图查看 |
| Phase | Project | 展示阶段成果、范围和实际进展 |
| Task | Issue | 展示一个可独立验收的工作成果 |

目标总览使用 Team 文档，不挂在某个阶段 Project 下。Project 标签按仓库和 Goal 命名，避免不同项目的 V1 混淆；Workspace 级 Project 标签适用于所有套餐，不默认依赖付费的 Team 标签。Issue 可通过所属 Project 的标签筛选，无须每项重复添加 Goal 标签。原有 Project、Issue 及仓库稳定 ID 保持；Linear 可读编号不替换文档 ID。官方能力见 [Documents](https://linear.app/docs/documents)、[Project labels](https://linear.app/docs/project-labels)。

Initiative 可作为已有项目的明确选择；本默认方案不依赖其接口，不要求先创建 Initiative 才能接续工作。已有项目采用其他明确映射时先核对，转换需有适用范围及授权。

## Goal 总览写什么

目标总览保持简短：成果与范围摘要、带来源和同步时点的整体判断及风险、阶段 Project 链接、正式 Goal plan 与整体条件入口，以及实际取得后的 Goal verification 入口。尚未执行验收就明确说明，不预建空报告或虚构通过。不要复制完整计划、全部任务或验收正文。

Goal 状态来自仓库 plan，达成判断来自独立验收；Issue 完成率和已结束阶段数量只表示工作进展。Linear 文档没有本工作流的原生 Goal 生命周期；由执行者在明确节点刷新摘要，不能把文本摘要反向变成任务事实源。

## 原生协作信息由谁维护

仓库拥有成果、范围、完成条件、正式状态与证据。Linear 拥有负责人、操作优先级、排期、标签、关系、评论及 Project updates。更新展示时保留人工协作信息，只改本次明确的托管内容。新范围或验收结论先按文档流程处理，再显式刷新看板；人工状态变化先核对理由，不自动反向接受，也不无视语义覆盖。

未承诺想法先留在 ideas 或讨论；Project 围绕阶段成果，Issue 用具体任务或问题标题，简记交付条件与来源。用户故事及 BDD 场景用于产品行为讨论与验收，不强迫每张 Issue 套故事句式。阶段保持约定规模，Task 按可独立交付结果细化；不按提交数、聊天次数或固定周数强拆阶段。

每个 Project 和执行中的 Issue 明确责任人；AI 当前执行与任务移交另按项目资料解释。状态沿用项目已有语义，不为每个工具步骤新增状态。以上是本工作流对 [Linear Method](https://linear.app/method/introduction)与 [Issue 写法](https://linear.app/method/write-issues-not-user-stories)的适配，不把官方团队习惯当所有项目的硬规则。

## 操作前确认什么

先读项目入口、实际采用规则、Goal/Phase plan、任务及必要证据，区分讨论、只读查询和执行。用当前连接器核对 Workspace、Team、当前身份及具体对象；桌面打开、连接成功或技能触发均不代表本批外部写入已获授权。已有授权内的常规接续继续推进，不重复制造审批；新增目标、范围、覆盖或迁移影响再说明。

首次接入形成精确对象与字段清单，说明来源、目标、历史回填及读回办法。批量授权只覆盖该范围，不顺手修改其他项目、全局工作流、自动化、成员或计费配置。覆盖已有物质性内容前保留必要现值及恢复方式。

优先使用宿主现有连接器；官方方式见 [MCP](https://linear.app/docs/mcp)。 新工作区需要独立核对认证上下文，切换网页工作区或重连不保证已有会话随之切换；官方 MCP 的多工作区说明要求分别认证。现有连接不能访问明确目标时，先说明缺口，获准后可增加独立官方连接，保留旧连接；仍以 whoami／工作区／Team 的实际读回决定写入目标，不凭简称或授权页面完成就开始写入。当前工具定义决定参数格式，实际调用和独立读回决定本轮是否成立；不能只凭官方示例或工具声明认定可用。缺少操作时说明具体缺口，可用范围继续；确需 UI 时请求最短的人工步骤，不绕用私人浏览器、token 或新建另一套客户端。

## 一次操作怎样接续

1. 读取本地正式事实。可用配套 CLI 对应 `list`、`show <ID>` 定位对象，显式指定 `--project`；参数从实际 help 获取。 `list` 用于定位；生成交付物或完成条件摘要前，继续读取 `show` 或唯一原文中的相应字段，不能把索引未返回的字段当空内容写入。必需摘要缺失时先核对来源。没有 CLI 时按项目 SOP 手工读取，不自动安装、升级或借作者模式绕过采用故障。
2. 沿已有映射按 UUID 查询；无映射时结合仓库身份、稳定 ID、来源链接和父级查找，并处理分页、重名及归档对象。接口失败不能当作对象不存在。
3. 对照授权审查差异。首次接入分别准备 Team 目标总览、Goal Project 标签、阶段 Project 和 Task Issue，明确依赖与可独立部分；视图只是展示入口。已有对象使用 UUID 更新，不因改展示方式重建阶段和任务。
4. 执行最小修改。正文先读最新内容，使用唯一锚点的 patch 或核对后编辑；集合优先按增删参数处理，整体替换前核对完整现值。保留负责人、标签和关系等人工内容。
5. 独立读回 UUID、名称、归属、状态及实际修改字段。 新建对象还要核对交付摘要、条件与来源入口有实际内容，不能只核对身份和状态。正文可能把 Issue 编号转为原生提及元素，核对实体和语义，不因序列化差异重复追加。读回未确认时保留返回身份及待核对事实，不能宣称完整成功。
6. 保存必要身份与实际结果、失败及接续点。部分成功只接续未完成部分，不从头重建；Task 状态仍写所属唯一 tasks.md，不由看板工具自动推进父级或归档。

创建超时或响应未知时，先按原来源与身份查找，唯一匹配后接续；不能立即再创建。更新、评论或 update 响应未知也先读回，不反复发送。当前流程没有整批事务保证，不能把部分成功描述为全批完成。

确需持久映射时，`docs/.stonedocs-linear.json` 仅记录格式版本、仓库身份、Workspace/Team UUID 及远端身份和链接。Goal 记录总览文档与 Project 标签两项身份，视图身份只在真实取得后保存；不预填、不存凭据、任务状态、完成率或字段镜像。目前该记录由执行者维护，不是配套 CLI 已提供的 Linear 同步命令。已有映射按实际格式核对，未知身份先确认，不能仅凭同名覆盖。

## 看什么、何时更新

先使用两个目的明确的入口：按 Goal 标签筛选的阶段总览，以及当前执行任务。需要时再保存为 [Custom view](https://linear.app/docs/custom-views)；工具未提供保存操作时，可以先用实际过滤查看或经授权由 UI 保存，保存视图不是工作流完成的硬前置。

开工、取得验收结果、阻塞和交接时刷新对应 Issue；阶段开工/收尾、目标范围或整体判断变化时刷新 Goal 总览。重要成果或风险写简短 Project update，持续推进的阶段可每周汇总完成内容、阻碍和下一步，不为每次文件改动发通知。依据见 [Updates](https://linear.app/docs/initiative-and-project-updates)。

Issue 状态先读取目标 Team 的实际配置，按 todo/doing/done/cancelled 语义对应未开始/进行中/完成/取消。Project 状态单独按 lead Team 核对，不能套 Issue 状态 UUID。原地归档独立于 Linear 自动归档，不能把归档改为取消；已有自动化导致差异时先查明效果，不为试跑改全局设置。依据见 [Project status](https://linear.app/docs/project-status)。

## 按需要使用其他能力

Cycle 管固定时间窗口，Phase 管成果，Release 管实际交付；只有需要周期选任务时才启用 Cycle。Project milestone 可表达阶段内真实交付节点，不新增文档生命周期。Release 先核对流水线及账号能力，不代替 GitHub 发版；适用功能不因声明存在就自动启用。[Cycles](https://linear.app/docs/use-cycles)、[Milestones](https://linear.app/docs/project-milestones)、[Releases](https://linear.app/docs/releases)

负责人、优先级、标签、关系、评论和 updates 按实际需要维护。模板、视图和 Team 配置等操作以当次工具与权限为准，不复制整站文档或预建双向同步后台。

## 同 Workspace 调整 Team

先核对目标 Team、成员与状态，读取精确旧对象及人工字段。给原 Project 添加新 Team 并读回后，再按原 UUID 试搬一条 Issue，明确保留 Project 和目标状态；核对成功后分批移动。全部 Issue 归属正确后调整 Project lead Team 并核状态；确认旧 Team 无范围外 Issue 或必要贡献后才移除参与关系，不整体覆盖或删除共享 Team。

可读编号和 URL 会变，仓库 Task ID 不变；UUID 与原生信息仍须前后核对。Team 标签及 Cycle 可能有损，先明确当前值和去向；无法保留或涉及范围外贡献时停止受影响动作。旧 URL 重定向是官方说明，不以旧编号 API 查询成功代替浏览器实测，也不承诺移回能还原所有字段。依据见 [移动 Issue](https://linear.app/docs/creating-issues)。

## 与工作流技能配合

plan 产生 Goal/Phase 成果与依赖后可维护总览、归属和 Project；task 接续工作后维护 Issue；verify 先把真实结果写回交付项目，再在看板链接结果；review 形成有据结论后更新摘要及必要的阶段状态。linear 负责外部展示适配，不代替这些文档职责；同一执行者可以直接继续，不要求兄弟技能调用记录或增加状态回路。

没有 skill 时人或 AI 可直接依本指南操作；没有连接器时继续本地文档工作并保留外部待办。CLI 提供已有确定性本地操作，连接器处理 Linear 原生对象，执行者负责授权、语义判断和正确写回。
