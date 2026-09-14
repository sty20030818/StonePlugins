# 石头鱼的工程规则：方法解释与治理

本文件供维护者理解方法来源、讨论取舍和评审规则，不由 Hook 注入，也不作为任务必读目录或动态指令源。运行时规则由包内 [SKILL.md](../plugins/stoneplugins/skills/engineering/SKILL.md) 与三份细则共同持有；核心正文只维护这一份，直接指向架构、修改边界、验证细则，不要求模型先读本文或另一个选择器。当前完整方法保留与读取路径调整尚未发布，决定与进度由 [ADR-0004](adr/0004-codex-first-bundled-engineering.md) 和[重构计划](plans/2026-09-14-codex-first-refactor.md)持有，安装说明见 [README](../README.md)。

全部常驻原则共同参与理解、设计、实施与验证，不预设采用数量或唯一主方法。具体结构和流程按情境落实；原则已经满足时可以保持现状，不能因没有新增代码或没有公开展开就判定它无用。方法名用于定位来源，采用证据应来自所有权、边界、契约、迁移、风险和验证的实际决定。

## 核心原则的来源

以下原则持续参与形成方案，不要求回复逐一列名或为了名称增加结构：

- 第一性原则、真实路径、根因和正确所有者；
- 单一事实源与知识级 DRY；
- SRP、高内聚低耦合、信息隐藏、局部性、模块化和组件化；
- 整洁架构与六边形架构的领域独立、依赖方向和边界原则；
- KISS、YAGNI、深模块和最小公共面，以真实消费者、当前隔离价值和已确认方向控制抽象；
- 长期单轨、允许推荐破坏性重构、减少冗余和永久兼容；
- 外科手术式修改与 Boy Scout Rule；
- 正确性、安全、权限、数据、可访问性和风险相称验证。

SOLID 不作为整套候选挂起：SRP、依赖方向持续参与判断；扩展、消费或替换关系存在时，OCP、ISP、LSP 的对应要求同样生效。是否新增接口、层级或实现由当前价值决定，不统一等到出现维护事故或第二个实现。

## 语义保留与改写映射

下表对照 `v0.5.1` 的原有要求与本轮已确认的默认强度，检查每项独有语义是否仍存在于运行时文件。它是维护评审证据，不是模型任务清单、关键词门禁或已完成的行为测试报告。运行时条件、反例与退出要求由对应正文持有。

| 原有要求与本轮澄清 | 运行时落点 | 可观察判据 |
| --- | --- | --- |
| 全部常驻原则共同形成决定，允许多方法组合 | 核心 | 同时满足所有权、简洁、权限和证据要求；不先选方案再补方法名 |
| 第一性原则、真实路径、正确所有者、知识级 DRY | 核心 | 找到不变量与共同业务所有者；变化原因独立的相似代码不被强行合并 |
| SRP、高内聚低耦合、局部性、模块化、组件化 | 核心、`architecture.md` | 按变化原因集中职责；不以函数长度、文件数量或层数代替边界判断 |
| 深模块、信息隐藏、最小公共面 | 核心、`architecture.md` | 调用方无需了解内部步骤；新增边界隐藏真实复杂度，不只是透传 |
| 整洁／六边形架构、DIP | 核心、`architecture.md` | 领域规则不依赖易变细节；有当前隔离价值时，单实现也可建立接缝 |
| KISS、YAGNI、长期单轨、允许破坏性推荐 | 核心、`change-boundaries.md` | 控制总体概念和维护成本；必要时提出根因重构，不用兼容壳保护错误结构 |
| OCP：已确认演进即可主动评估接缝 | `architecture.md` | 为真实扩展保护有价值的稳定契约，不等反复出错，也不为假想能力搭插件系统 |
| LSP、共享基础契约与显式差异能力 | `architecture.md`、`verification.md` | 共享承诺保持输入、结果、错误和副作用语义；差异能力不伪装成可替换 |
| ISP：按真实消费需求限制能力依赖 | `architecture.md` | 不同调用方只依赖所需能力；可共用实现，不机械拆文件或服务 |
| Functional Core / Imperative Shell | `architecture.md` | 确定性判断通过可独立调用的纯函数／已有纯模块接收数据并返回决定，不以注入服务或函数内分段冒充隔离；外壳收集输入和执行副作用，保留自然的事务或流式模型 |
| DDD、领域语言、Bounded Context、Context Map | `architecture.md` | 相似字段但不变量或生命周期不同的概念分别建模；明确翻译所有者、最小契约和失败边界 |
| REP、CCP、CRP、ADP、SDP、SAP | `architecture.md` | 对象存在即按共同变化、复用与稳定方向判断；发布原则用于真实发布关系，不为采用原则先拆包 |
| 外科手术式修改、Boy Scout Rule | 核心、`change-boundaries.md` | 修复完整因果范围；只整理其中阻碍当前工作或由本次产生的问题 |
| Tidy First | `change-boundaries.md` | 小整理能明确降低本次风险时先做，前后证明行为保持；不强制独立提交 |
| Clean cut、Parallel Change | `change-boundaries.md` | 可同步消费者同批迁移并删除旧路；否则展开、迁移、收缩，并明确退出证据和已确认时点 |
| Branch by Abstraction | `change-boundaries.md` | 在持续交付约束下受控替换内部实现；迁移接缝完成后重新证明价值或删除 |
| Strangler Fig | `change-boundaries.md` | 按真实业务接缝替换遗留能力，管理新旧路由、双写和状态收敛，不留永久双轨 |
| Mikado | `change-boundaries.md` | 阅读配合隔离的小型可逆实验发现前置依赖，按依赖顺序推进；不动用户暂存区或破坏性还原 |
| TDD、垂直切片 | `verification.md` | 目标清晰且反馈快稳时默认先确认测试因目标缺失而变红，再实现和整理，逐个真实行为推进 |
| Characterization Testing | `verification.md` | 规范不足时先捕获受影响公共行为；区分保留、改变、未知，不冻结已知 Bug 或复制可信测试 |
| Contract Testing | `verification.md` | 可替换实现通过同一基础契约检查；特有能力和集成风险分别补证据 |
| 可证伪假设、停滞后的诊断反馈 | `verification.md` | 用能区分解释的证据收敛；重复失败无新信息时换检查，不叠加盲目补丁 |
| 威胁建模、最小权限、失败安全、幂等与恢复 | 核心、`architecture.md`、`verification.md` | 可信端授权，不泄漏机密；超时按结果未知处理，外部副作用有安全重放或恢复证据 |
| Design It Twice 与 ADR 分开判断 | `architecture.md` | 高成本决定比较真实不同方案；重要且非显然的长期取舍优先记入现有权威文档，不强制新建 ADR |
| Fitness Functions | `architecture.md`、`verification.md` | 已有工具能低成本检查重要可测不变量时主动加入；不把方法名或文案格式当架构指标 |
| 需求轴与工程轴独立审查 | `verification.md` | 目标满足和工程标准分别有证据，不用测试通过掩盖需求错误，也不只凭气味判错 |
| 公开说明、Git 分界、工具与文档同步 | 核心、`change-boundaries.md`、`verification.md` | 说明真实影响，保持用户已确认状态，使用项目工具链并同步本次行为变化的权威文档 |

## 研究候选与评审视角

以下思想可以提供问题或属性，但目前不作为整体运行时门禁：

- **CUPID**：Composable、Unix、Predictable、Idiomatic、Domain-based 是有用方向感，但缺少统一通过线；只将能落成具体决定的部分晋升。
- **Clean Code**：可读命名、小函数等建议必须服从领域、局部性和项目风格，不用函数长度或形式指标替代职责判断。
- **书籍或文章原则**：先提取它能阻止的真实失败模式，再决定进入条件 reference、项目规则或只保留为来源。

## 解释决定时的用词

以下分类帮助准确解释作用，不是运行时输出必填字段：

- **工程原则**：约束事实、所有权、简洁度、耦合、事实源或优先级；
- **架构方法**：塑造 Module、Interface、依赖或领域边界；
- **改造策略**：控制重构、迁移、兼容期和退出；
- **验证方法**：决定诊断、测试和证据形式。

没有准确方法名时直接解释工程判断；用户明确限定的选择应如实说明来源，不冒充方法论。实际回复样式只由核心持有。

## 真实冲突

- **OCP 与 YAGNI**：围绕真实或已确认演进中的变化轴建立有价值的接缝；假想扩展不足以成立，错误契约也不应被冻结。
- **DRY 与低耦合**：共享业务知识，不共享仅仅相似的语法。
- **模块化与 KISS**：模块用于隐藏复杂度和集中变化，不以数量衡量质量。
- **Boy Scout / Tidy First 与外科手术式修改**：允许整理当前因果边界，不扩大任务范围。
- **Clean cut 与渐进迁移**：消费者可同步时干净切换；真实迁移约束存在时才增加临时双轨。
- **长期最优与权限边界**：可以推荐破坏性目标方案；执行仍需满足消费者、迁移、恢复和授权。
- **稳定抽象与当前消费者**：没有需要隔离的变化或消费者时，不因 DIP、SAP 等名称预建接口；有当前隔离价值时，不以缺少第二个实现否决。
- **TDD 与特征测试**：先区分明确目标与未知现状，复用已有可信基线，不为方法齐全重复测试同一行为。
- **真实方案比较与决策记录**：比较帮助当前选择，记录保留未来无法从代码还原的理由；一次比较不自动要求新建 ADR。

## 规则生命周期

```text
一手来源或真实失败
        ↓
研究候选
        ↓ 有触发、反触发、动作与评测
条件方法 reference ──────▶ 项目专属规则
        ↓ 多类任务反复有效且上下文成本合理
常驻工程执行契约
```

- 用户反馈和真实失败优先于新增书单。
- 每次晋升必须说明解决的失败模式、适用信号、反例和可能负作用。
- 新研究候选先明确行为案例和失败边界，再据证据与用户确认决定晋升；这不把已确认方法重新降为待证明的候选。
- 持续制造术语复述、造成过度设计或重复表达的内容应合并或改写；删除前核对独有语义与消费者，不能只因名称少见或本次无需新增结构就删掉适用要求。
- 评测尽量只改变被测规则；组合修改时说明无法分离的影响，不为形式把一次精简拆成大量模型运行。正反触发和关键失败优先，具体规模见[活动评测规范](evals/behavior-cases.md)。

## 一手来源

- Liskov 与 Wing：[A Behavioral Notion of Subtyping](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf)
- Robert C. Martin：[SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html)、[An Open and Closed Case](https://blog.cleancoder.com/uncle-bob/2013/03/08/AnOpenAndClosedCase.html)、[Principles and Patterns](https://objectmentor.com/resources/articles/Principles_and_Patterns.pdf)
- Dan North：[CUPID for joyful coding](https://dannorth.net/blog/cupid-for-joyful-coding/)
- Martin Fowler：[Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html)、[Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)、[Branch by Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html)
- Michael Feathers：[Characterization Testing](https://michaelfeathers.silvrback.com/characterization-testing)
- Kent Beck：[Structure and Behavior](https://newsletter.kentbeck.com/p/structure-and-behavior)
- Eric Evans：[Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- Gary Bernhardt：[Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)、[Boundaries](https://www.destroyallsoftware.com/talks/boundaries)
- John Ousterhout：[A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/aposd.php)
- The Mikado Method：[官方站](https://mikadomethod.info/)
- Evolutionary Architecture：[Fitness Functions 概要](https://evolutionaryarchitecture.com/precis.html)
