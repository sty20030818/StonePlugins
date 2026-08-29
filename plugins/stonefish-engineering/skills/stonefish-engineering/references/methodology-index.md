# 方法论索引与晋升门槛

本文件是规则维护与方案选择索引，不是每个任务都加载的清单。仅在多方法采用或比较、分类不确定、规则维护或固定评测时读取；普通任务按 `SKILL.md` 读取匹配的主题 reference。

方法名只用于定位思想来源，不能代替项目证据。选择方法时先确认它回答的具体问题、触发信号、反例和退出条件；没有当前触发证据时，不因方法知名或“以后可能有用”而采用。

## 权威层级

1. **核心约束**：适用于绝大多数工程任务，短小且反复阻止过真实失败；由 `SKILL.md` 承载。
2. **条件化做法**：只在明确风险或结构信号出现时读取；由主题 reference 承载。
3. **项目规则**：依赖具体领域、团队、发布方式、SLO 或合规事实；留在项目文档或专门 Skill。
4. **评审视角**：用于提出问题，不作为通过/失败门禁；方法缩写与书籍思想默认属于这一层。

正确性、数据完整性、安全、权限、已确认需求和项目事实始终高于任何通用方法论。

## 对外分类

“方法论”是面向用户的总称；披露时按本次实际作用标注准确分类：

- **工程原则**：约束所有权、简洁度、耦合、事实源或决策优先级，如 SRP、DRY、KISS、YAGNI。
- **架构方法**：塑造模块、依赖或领域边界，如深模块、六边形架构、DDD。
- **改造策略**：控制重构或迁移顺序、兼容期与退出，如 Boy Scout Rule、Parallel Change、Strangler Fig。
- **验证方法**：决定诊断、测试或证据形式，如可证伪假设、Contract Testing、Characterization Testing。

同一方法跨越多个类别时，标注它在当前决定中实际承担的角色。“工程判断”和“用户明确约束”是决策依据，不冒充方法论。

## 当前索引

| 方法族 | 触发信号 | 不采用或停止扩张的信号 | 规则位置 |
| --- | --- | --- | --- |
| 最小完整方案、根因与正确所有者 | 局部补丁会保留错误所有权、第二事实源或同类失败路径 | 额外改动无法追溯到当前目标 | `SKILL.md`、[change-boundaries.md](change-boundaries.md) |
| 外科手术式修改、Boy Scout Rule | 根因修复需要边界内连带整理 | 只是刚好看到的历史坏味道 | [change-boundaries.md](change-boundaries.md) |
| Tidy First | 小型、可验证、可回退的结构调整能明显降低本次行为改动风险 | 整理与目标无因果关系，或结构改动本身难以逆转 | [change-boundaries.md](change-boundaries.md) |
| KISS、YAGNI、能力阶梯 | 存在多个可行实现，需控制概念、依赖与维护面 | 安全、正确性或真实消费者要求更完整的方案 | `SKILL.md`、[change-boundaries.md](change-boundaries.md) |
| 知识级 DRY | 多处表达同一业务知识且必须同步修改 | 仅语法相似、变化原因不同 | [architecture.md](architecture.md) |
| SRP、高内聚低耦合、变化局部性 | 同一业务决定散落多处，或一次变化造成 shotgun surgery | 只为缩短文件或函数而拆分 | [architecture.md](architecture.md) |
| 深模块、信息隐藏、最小公共面 | 调用方被迫理解内部顺序、策略或无关能力 | 新层只透传参数或只有一个无行为消费者 | [architecture.md](architecture.md) |
| Clean Architecture、Hexagonal、DIP | 复杂领域规则、易变外部边界、多个真实实现或确定性测试需要隔离 | 单一实现、简单 CRUD，普通模块边界已经足够 | [architecture.md](architecture.md) |
| 行为子类型与共享 contract tests | 同一接口、port 或协议有多个实现、provider、adapter 或 test double | 没有可替换消费者，只为补齐 SOLID 缩写而造接口 | [architecture.md](architecture.md)、[verification.md](verification.md) |
| Functional Core / Imperative Shell | 业务判断与 I/O 交错、测试依赖大量 mock，或同一决策需跨入口复用 | 明确状态机、事务或 actor 模型更自然 | 项目级或专门设计任务 |
| 领域语言 | 业务术语稳定，代码命名或结构与真实用例存在认知距离 | 简单技术工具没有复杂业务语义 | [architecture.md](architecture.md) |
| DDD bounded context / context map | 同一术语在不同子域含义冲突，或跨域模型翻译责任不清 | 简单 CRUD、通用支撑域，或只想套战术模式目录 | 项目级 `CONTEXT.md` 或 domain-modeling Skill |
| 组件内聚/耦合六原则 | package 独立发布、跨团队复用、依赖成环或发布连锁 | 普通目录分文件，或没有独立消费者和发布边界 | 项目级组件诊断 |
| Clean cut 与渐进迁移模式 | 公共契约、schema、provider 或大型遗留系统需要迁移消费者 | 普通局部重构可以一次完成 | [change-boundaries.md](change-boundaries.md) |
| Characterization Testing | 遗留行为缺少可信测试或完整规范，改动前需要让现状可观察 | 已有稳定公共契约和充分行为测试 | [verification.md](verification.md) |
| 可证伪假设与风险比例验证 | Bug、非平凡逻辑、高风险副作用或完成声明需要证据 | 纯文案或编译器已完整覆盖的一行事实 | [verification.md](verification.md) |
| 威胁建模、最小权限、失败安全 | 安全、权限、敏感数据、外部副作用或受配额调用 | 与当前变化无关的全系统安全仪式 | [architecture.md](architecture.md)、[verification.md](verification.md) |
| ADR | 难以逆转且存在真实替代的高成本决策 | 普通实现细节或只有一个可行方向 | [architecture.md](architecture.md) |
| 架构 fitness functions | 项目已有明确且可自动测量的架构质量属性 | 还没有项目特有指标，只想把抽象原则自动化 | 项目级检查 |
| CUPID、完整 SOLID、Clean Code 等 | 需要评审视角或候选线索 | 试图作为全局合规清单或一次性全部导入 | 研究材料，不进入核心 |

## 真实冲突怎么处理

- **OCP 与 YAGNI**：只围绕已观察到且值得保护的变化轴建立扩展边界；不为假想变化先造插件系统、继承层或兼容壳。
- **DRY 与低耦合**：共享的是业务知识，不是相似语法；错误抽象会把原本独立的变化绑在一起。
- **Boy Scout / Tidy First 与外科手术式修改**：可以整理因果边界内阻碍正确实现或验证的结构，不扩散到无关清理。
- **Clean cut 与渐进迁移**：所有消费者能同步时优先干净切换；只有外部消费者、分阶段发布、数据或持续交付约束真实存在时才增加过渡架构。
- **DDD、组件原则与 KISS**：领域冲突、复用和发布边界必须先真实存在；方法名不能成为增加层级的理由。
- **稳定抽象与当前消费者**：稳定不等于很少提交；没有需要被隔离的变化和消费者时，不因 SAP 或 DIP 先造接口。

## 规则生命周期

```text
研究候选 → 条件化 reference → 核心规则
                         ↘ 项目规则
```

- **研究候选**：至少有一手来源和一个可能改善的真实失败模式；尚未证明收益时只留在索引或研究文档。
- **条件化 reference**：写清触发、反触发、动作、冲突和退出条件，并有对应评测案例。
- **核心规则**：只有在多类工程任务中反复适用、确实阻止过真实失败、上下文成本可接受且没有明显负作用时才晋升。
- **项目规则**：凡是依赖具体领域模型、组件发布方式、SLO、团队所有权或合规事实的内容，不晋升为公开插件核心。

用户反馈和真实失败优先于新增书单。每个评测批次优先只调整一个相关方法组，并用同一组案例比较前后决定；确需同版合并多个相关缺口时，分别保留各方法组及其组合冲突的评测证据。没有改变决定、持续误触发或只会让 Agent 复述术语的规则，应合并或删除。

“本次决策与方法论”的触发与展示格式只由 `SKILL.md` 持有；本索引只保留方法选择、分类、冲突和评测案例，不复制模板。

## 最小评测集

评测首先关注 Agent 做出的决定和读取路由。只有披露方法时，才检查它是否绑定可核查事实与具体决策影响；单独复述方法名不得分。

| ID | 场景 | 期望决定 |
| --- | --- | --- |
| CONTRACT-1 | 同一支付 port 有三个 provider，其中一个把拒绝静默转成成功 | 识别替换语义被破坏，并让所有实现运行共享 contract tests |
| CONTRACT-2 | test double 忽略生产实现必需的幂等和错误语义 | 修复测试替身契约，不让测试制造虚假信心 |
| CONTRACT-3 | 一个内部模块只有一个简单实现和一个调用方 | 不为 LSP/DIP 补接口族 |
| CONTRACT-4 | 两个 provider 的能力确实不同且调用方需要区分 | 拆分或显式表达能力契约，不强求虚假可替换 |
| MIGRATION-1 | monorepo 内所有消费者可在同一个变更中修改 | 选择 clean cut，并删除旧路径 |
| MIGRATION-2 | 外部 API 客户端无法同步升级 | 选择 Parallel Change，定义兼容期与删除证据 |
| MIGRATION-3 | 需要逐步替换框架但主干必须持续交付 | 评估 Branch by Abstraction，不把临时 seam 永久化 |
| MIGRATION-4 | 大型遗留系统可按业务能力逐片迁移 | 评估 Strangler Fig，明确拦截边界、状态和退出条件 |
| MIGRATION-5 | 大型源码重构不断暴露未知前置条件 | 使用可恢复实验建立 Mikado 依赖图，不破坏用户工作树 |
| LEGACY-1 | 缺少规范和测试的遗留导出逻辑需要重构 | 先从稳定边界捕获当前可观察行为 |
| LEGACY-2 | 当前行为包含已确认 Bug | 把现状与目标行为分开标记，不把 Bug 冻结为永久契约 |
| LEGACY-3 | 公共契约已有充分、可信的行为测试 | 复用现有证据，不增加重复 characterization tests |
| LEGACY-4 | 只能通过私有调用顺序做巨大快照 | 寻找更稳定接缝，避免把偶然实现形状固化 |
| TIDY-1 | 一个小型 rename/extract 能让目标行为只改一个所有者 | 先做可验证、可回退的局部结构调整，再改行为 |
| TIDY-2 | 修改按钮文案时发现同目录历史命名不统一 | 不扩大范围做目录整理 |
| TIDY-3 | 结构和行为变化混在一起且无法证明原行为 | 先建立行为证据，再决定排序 |
| TIDY-4 | “整理”实际意味着拆服务或迁移数据 | 当作高成本架构决策，不以 Tidy First 绕过确认门槛 |
| ROUTING-1 | 纯翻译、文案润色或非技术问题 | 不读取工程 references 或方法论索引 |
| ROUTING-2 | 简单 Bug 同时涉及一个外部副作用 | 读取修改边界与验证；只在出现迁移或多实现证据时再读取相关方法 |
| DISCLOSURE-1 | 同一任务中，正确所有者决定修改位置，安全风险又独立决定验证方式 | 在同一个“本次决策与方法论”区块分别说明独立决策，不按方法名拆项 |
| DISCLOSURE-2 | Skill 已注入或 reference 已读取，但方法没有改变最终决定 | 不显示决策区块，不把加载或检查冒充采用 |
| DISCLOSURE-3 | KISS、YAGNI 和最小公共面都只导向“不增加无消费者抽象” | 合并为一个通俗的设计依据，不做方法名签到 |
| DISCLOSURE-4 | 一个小型决定由一个准确方法直接决定 | 单行说明决定、方法的具体作用和方案影响，不强制展开小标题 |
| DISCLOSURE-5 | 多个方法共同改变同一个普通工程决定 | 每项标注准确分类并分别说明贡献，不把方法拆成多个虚假决策 |
| DISCLOSURE-6 | 一个复杂方案由三个以上方法共同决定，且尚未实施 | 使用方法映射表、预期影响和验证计划，不声称已经完成 |
| DISCLOSURE-7 | 项目事实决定选择，但没有准确具名方法 | 标为“工程判断”；用户直接限定选择时标为“用户明确约束” |
| DISCLOSURE-8 | 任务包含四个分别影响架构、安全、迁移与验证的独立决策 | 全部展示，不受旧的 1～3 项限制；合并同一因果链，不枚举仅检查的方法 |
| DISCLOSURE-9 | 普通交付已经实施并运行检查，但仍有人工验收未完成 | 使用方案影响与验证证据，保留未验证边界且不复制完整命令日志 |
| DISCLOSURE-10 | 简单、普通和复杂任务使用同一公开契约 | 简单用单行，普通用标题与列表，复杂才使用摘要引用、共享字段表格和有序验证步骤 |
| DISCLOSURE-11 | 大型迁移包含十余项会改变用户判断的独立决策 | 用紧凑索引覆盖全部决定，只展开需确认、高风险或有真实竞争的项，其余随对应阶段交付 |
| DISCLOSURE-12 | 当前任务存在更高优先级的严格输出长度或格式约束 | 服从该约束并压缩，不混淆不同因果；无法完整披露时说明省略边界 |

## 一手来源

- Liskov 与 Wing：[A Behavioral Notion of Subtyping](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf)
- Robert C. Martin：[SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html)、[An Open and Closed Case](https://blog.cleancoder.com/uncle-bob/2013/03/08/AnOpenAndClosedCase.html)、[Principles and Patterns](https://objectmentor.com/resources/articles/Principles_and_Patterns.pdf)
- Dan North：[CUPID—for joyful coding](https://dannorth.net/blog/cupid-for-joyful-coding/)
- Martin Fowler：[Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html)、[Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)、[Branch by Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html)
- Michael Feathers：[Characterization Testing](https://michaelfeathers.silvrback.com/characterization-testing)
- Kent Beck：[Structure and Behavior](https://newsletter.kentbeck.com/p/structure-and-behavior)
- Eric Evans：[Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- Gary Bernhardt：[Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)、[Boundaries](https://www.destroyallsoftware.com/talks/boundaries)
- The Mikado Method：[官方站](https://mikadomethod.info/)
- Evolutionary Architecture：[Fitness Functions 概要](https://evolutionaryarchitecture.com/precis.html)
