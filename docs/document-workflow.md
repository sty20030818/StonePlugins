# 文档工作流

## 本版本与独立使用

本版 v0.8.0 包含九项文档工作流，与 engineering 共十个技能入口。各入口可依据足够的目标、约束和事实独立使用，通过项目文件接续；不要求前序调用记录。

本版规则、发布、安装和正式宿主结果见 [v0.8.0 验证](evals/v0.8.0.md)；[v0.7.0 验证](evals/v0.7.0.md)保留旧版六项工作流的结果，不直接继承为新模型通过。

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

Goal → Phase → Task 的共用模型由[共同约定](../plugins/stoneplugins/references/docs-system/conventions.md)维护。plan/review 先区分对象；Task 始终归 Phase，目标层不另建任务清单。整体验收由阶段任务承接，报告进入对应 Goal；普通任务可在条目中简记实际结果，独立或多批次验收按 SOP 记录，不默认生成附件包。

技能只负责项目读取、工具适配和输出路由，具体操作与填写结构由对应 SOP 维护。当前执行者可以连续承担多项职责，不把兄弟技能的调用或安装设为前置，也不为更新状态循环回调。没有技能或 CLI 时，人或 AI 仍可用 Markdown + Git 执行 SOP；独立使用不意味着只复制一个技能目录就包含运行资源。

## 规则作者源与分发

共同规则的作者源为 StoneDocs 的 docs/conventions.md，各流程及输出骨架在 docs/sop/。包内[共同约定](../plugins/stoneplugins/references/docs-system/conventions.md)、[SOP 导航](../plugins/stoneplugins/references/docs-system/sop/README.md)与九项流程是固定时点的逐字副本，共十一份 Markdown 资源；新增技能不增加第二套 SOP 或独立模板。

[来源清单](../plugins/stoneplugins/references/docs-system/source.json)唯一记录仓库、完整基线提交、源状态、路径与文件哈希。作者源更新后同步这十一份资源并校验字节，不手改副本。未提交源使用 working-tree，仅可本地验证；发布门禁要求 commit 来源，发布核对还须将资源与相应 Git 原文比对。来源清单和固定规则副本属于包的分发契约，普通任务不因此需要来源包或哈希清单。

运行资源随完整插件提供，不查作者电脑或远端 latest。StoneDocs 的 guide 面向使用者串联路线，不是运行包依赖；项目自身目标、任务、决定和结果仍由采用项目拥有。插件升级不会自动改变项目采用的规范版本。

## 开发验证与证据边界

沿用 npm run check，覆盖类型、生成 Hook、工程规则、工作流包级检查和测试；静态通过不替代宿主发现、正式安装或模型实际行为。候选结果按实际对象和规则版本记录，未执行部分明确保留，不从历史档案继承通过。

工作任务和状态由 StoneDocs 对应 Phase 持有，本页只说明入口和使用方式。既有 [P007 开发记录](evals/planning-skills-development.md)、[v0.6.1 验证](evals/v0.6.1.md)和[首批工作流开发记录](evals/document-workflow-development.md)保留各自时点的候选及实际结果，不能替代其他版本的实际验证。
