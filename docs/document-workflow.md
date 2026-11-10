# 文档工作流

## 本版本与独立使用

九项核心文档工作流，另有 engineering 与 linear 适配，共十一个技能入口。各入口可依据足够的目标、约束和事实独立使用，通过项目文件接续；不要求前序调用记录。

v0.9.0 包含 CLI 0.1.1 配套与独立 linear 适配；本版检查、分发、安装与宿主验收的实际结果见 [v0.9.0 验证](evals/v0.9.0.md)。本地正式协议安装、实际调用、固定产物与恢复修复的当前结论由 [StoneDocs P003 验收](https://github.com/sty20030818/StoneDocs/blob/40d6a43e8a663478f2c6addf000216e85c280170/docs/goals/v1/phases/p003-cli/verification.md#result-phase-p003-p003-composed-acceptance)持有，其中引用原技能回合与本轮补验，不将旧版回合外推为新恢复分支的模型通过；既有 v0.8.1 规则、发布、安装和正式宿主结果见 [v0.8.1 验证](evals/v0.8.1.md)；[v0.7.0 验证](evals/v0.7.0.md)保留旧版六项工作流的结果，不直接继承为新模型通过。

## 职责与使用

下表列出本版入口，限定入口名采用 `$stoneplugins:<name>`；源码声明不代表宿主已经发现、安装或验证这些入口。自然语言发现由描述与宿主处理，现有工程 Hook 不路由文档工作流。

| 入口 | 适用请求 | 主要结果 |
| --- | --- | --- |
| [idea](../plugins/stoneplugins/skills/idea/SKILL.md) | 记录或处理尚未安排的项目想法 | 可理解的待办、已有记录或明确去向 |
| [compare](../plugins/stoneplugins/skills/compare/SKILL.md) | 调查并比较真实可行选项 | 事实依据、取舍、推荐与未知 |
| [decide](../plugins/stoneplugins/skills/decide/SKILL.md) | 澄清取舍并记录已确认选择 | 写回对应所有者的决定，按需保留长期取舍 |
| [story](../plugins/stoneplugins/skills/story/SKILL.md) | 梳理项目用户故事和验收行为 | 故事、规则、场景或讨论草案 |
| [plan](../plugins/stoneplugins/skills/plan/SKILL.md) | 规划或调整产品目标或成果阶段 | Goal/Phase 计划、范围、依赖及验收条件 |
| [design](../plugins/stoneplugins/skills/design/SKILL.md) | 形成需要共同审查的实施方案 | 结构、关键流程、取舍及验证安排 |
| [task](../plugins/stoneplugins/skills/task/SKILL.md) | 拆分、接续或交接已明确的阶段任务 | 实际交付、唯一任务记录和接续点 |
| [verify](../plugins/stoneplugins/skills/verify/SKILL.md) | 验收明确对象、复验或核对已有结果 | 实际结果、必要证据与限制 |
| [review](../plugins/stoneplugins/skills/review/SKILL.md) | 判断 Goal/Phase 成果并按授权收尾 | 条件判断、遗留处置及实际归档结果 |
| [linear](../plugins/stoneplugins/skills/linear/SKILL.md) | 将文档成果展示到 Linear、核对归属和显式更新 | 总览、阶段/任务展示及实际读回，不代替核心工作流 |

Goal → Phase → Task 的共用模型由[共同约定](../plugins/stoneplugins/tools/stonedocs/rules/docs/conventions.md)维护。plan/review 先区分对象；Task 始终归 Phase，目标层不另建任务清单。整体验收由阶段任务承接，报告进入对应 Goal；普通任务可在条目中简记实际结果，独立或多批次验收按 SOP 记录，不默认生成附件包。

技能只负责项目读取、工具适配和输出路由，具体操作与填写结构由对应 SOP 维护。当前执行者可以连续承担多项职责，不把兄弟技能的调用或安装设为前置，也不为更新状态循环回调。没有技能或 CLI 时，人或 AI 仍可用 Markdown + Git 执行 SOP；独立使用不意味着只复制一个技能目录就包含运行资源。

## CLI 与规则分发

共同规则作者源在 StoneDocs 的 docs/conventions.md，九项流程和骨架在 docs/sop/。StoneDocs 构建同源独立 JavaScript 包，完整产物包含 CLI、固定十一份规则、[规范清单](../plugins/stoneplugins/tools/stonedocs/rules/source.json)和[程序产物清单](../plugins/stoneplugins/tools/stonedocs/artifact.json)。StonePlugins 通过显式导入接入完整包，不手改编译 JS 或规则，也不维护另一份 SOP 快照。规则源与程序源分别记录固定身份；工作树构建明确标记 source.state 为 working-tree，只可本地验证，正式来源门禁要求 commit。当前配套工具与规则的实际身份读取各自清单，插件是否已发布另从固定 tag 与对应结果核对。

开发者先按 StoneDocs 构建入口生成明确产物，再运行 `npm run import:stonedocs -- --package /path/to/package`；已有配套包需要显式 `--replace`，正式导入另加 `--release`。导入复用产物自身的完整性校验，读回后才替换完整生成目录，旧目录类型或内容无法验证则停止。清单摘要保证内容对应，不代替来源认证；只导入可信作者渠道的明确版本。完整包资源纳入本仓发布校验，不从远端 latest 或作者电脑补缺。

技能按[配套 CLI 用法](../plugins/stoneplugins/references/cli.md)从实际安装路径定位工具并显式限定项目。只读定位、常规创建和状态等确定性操作由 CLI 承接；语义讨论、技术方案、代码和实际验收仍由当前执行者完成。命令参数与 JSON 结构查实际 help，不在每个技能重复维护。程序运行只需 Node >=22.18.0，插件用户不用另装全局 CLI；终端或 CI 可使用 StoneDocs 同源独立包。

程序、插件和项目采用版本独立；插件更新不升级项目规则。项目 SOP 优先，缺失工具或不支持契约按明确缺口处理，可以在已授权范围手工接续 Markdown + Git，不自动换版、安装或覆写。StoneDocs guide 面向使用者串联路线，项目目标、任务、决定和结果仍由采用项目拥有。

## Linear 适配

linear 是可独立使用的外部看板入口，不是第十项核心 SOP。plan、task、verify、review 在本次授权包含展示维护时可直接按同一指南接续，不要求增加技能调用。默认 Goal 用 Team 总览文档和 Project 标签表达，Phase/Task 保留 Project/Issue；保存视图按实际需要，不依赖 Initiative。

操作指南的唯一作者源在 StoneDocs 的 `docs/linear.md`；[包内副本](../plugins/stoneplugins/references/linear.md)由显式导入生成，文件头记录来源提交、commit/working-tree 及正文 SHA。它独立于 CLI 的十一份核心规则，不改工具产物，也不由导入自动升级采用项目。开发者使用 `npm run import:linear -- --source /path/to/StoneDocs --revision <完整提交>` 导入固定提交；工作树候选另显式加 `--working-tree`，有效旧副本的替换另加 `--replace`。未知或被手改的副本停止覆盖，release 不接纳工作树来源；清单校验内容对应，不替代可信来源判断。

本次指南与适配的实际结果见 [StoneDocs T0059 固定记录](https://github.com/sty20030818/StoneDocs/blob/425aba5f649347e366f4f11f8217090276041e1f/docs/goals/v1/phases/p004-adoption/tasks.md#result-task-t0059-linear-adapter-1)，按其对象与时点解释；固定来源元数据更新不冒称重跑了旧模型回合。

项目本地适配与例外优先。指南只按需读取，不复制官方整站或在技能内存工具参数；当前能力由实际工具/账号及独立读回核对。作者指南、插件候选、实际安装和运行结果分别解释，文件存在不代表个人安装已更新。

## 开发验证与证据边界

沿用 npm run check，覆盖类型、生成 Hook、工程规则、工作流包级检查和测试；静态通过不替代宿主发现、正式安装或模型实际行为。候选结果按实际对象和规则版本记录，未执行部分明确保留，不从历史档案继承通过。

工作任务和状态由 StoneDocs 对应 Phase 持有，本页只说明入口和使用方式。既有 [P007 开发记录](evals/planning-skills-development.md)、[v0.6.1 验证](evals/v0.6.1.md)和[首批工作流开发记录](evals/document-workflow-development.md)保留各自时点的候选及实际结果，不能替代其他版本的实际验证。
