# 石头鱼的工程规则：方法论目录与治理

本文件服务规则维护、研究和版本评审，不由 Hook 注入，也不是普通任务的运行时清单。工作树候选的唯一资源为包内核心 [SKILL.md](../plugins/stoneplugins/skills/engineering/SKILL.md) 和短选择器 [method-selection.md](../plugins/stoneplugins/skills/engineering/references/method-selection.md)；生命周期 Hook 送达核心正文，细则按需读取。候选已实现但未发布，宿主验收见[开发验证](evals/codex-first-bundled-development.md)；已发布 `v0.5.0` 的短加载要求属于历史实现。决定与后续工作由 [ADR-0004](adr/0004-codex-first-bundled-engineering.md) 和 [重构计划](plans/2026-09-14-codex-first-refactor.md) 持有。下述方法分类与晋升规则继续有效，不以正文必须由模型读文件作为方法论不变量。当前安装说明见 [README](../README.md)。

方法名用于定位思想来源，不能替代项目证据。规则只有在能改变所有者、边界、抽象、兼容、风险或验证时才有运行价值。

## 三个层级

### 常驻工程执行契约

每个工程任务从理解开始共同应用：

- 第一性原则、真实路径、根因和正确所有者；
- 单一事实源与知识级 DRY；
- SRP、高内聚低耦合、信息隐藏、局部性、模块化和组件化；
- 整洁架构与六边形架构的领域独立、依赖方向和边界原则；
- KISS、YAGNI、最小公共面和当前消费者门槛；
- 长期单轨、允许推荐破坏性重构、减少冗余和永久兼容；
- 外科手术式修改与 Boy Scout Rule；
- 正确性、安全、权限、数据、可访问性和风险相称验证。

常驻表示共同形成决定，不表示每次增加对应结构，也不要求回复逐一列名。

### 条件方法

只在真实信号出现时实例化具体结构或步骤：

| 方法族 | 回答的问题 | 运行时所有者 |
| --- | --- | --- |
| 深模块、信息隐藏、最小 Interface | 怎样用小 Interface 隐藏复杂度并集中变化 | `architecture.md` |
| Clean Architecture、Hexagonal、DIP | 怎样隔离稳定领域规则与易变外部细节 | `architecture.md` |
| Functional Core / Imperative Shell | 怎样分开确定性决策与副作用 | `architecture.md` |
| OCP、LSP、ISP、行为契约 | 真实扩展轴、消费者能力和多实现怎样保持正确 | `architecture.md`、`verification.md` |
| DDD、领域语言、Bounded Context、Context Map | 怎样处理复杂领域语言与跨域翻译 | `architecture.md` |
| REP、CCP、CRP、ADP、SDP、SAP | 怎样划分有独立发布和依赖图的组件 | `architecture.md` |
| Tidy First | 当前结构整理是否应先于行为改动 | `change-boundaries.md` |
| Clean cut、Parallel Change | 消费者同步能力怎样决定兼容策略 | `change-boundaries.md` |
| Branch by Abstraction、Strangler Fig、Mikado | 怎样渐进替换内部框架、大型遗留能力或未知依赖 | `change-boundaries.md` |
| TDD、垂直切片 | 怎样用可失败示例驱动最小行为切片 | `verification.md` |
| Characterization Testing | 规范不足时怎样让遗留行为先变得可观察 | `verification.md` |
| Contract Testing | 多个实现怎样共享调用方依赖的行为契约 | `verification.md` |
| 可证伪假设 | Bug 和性能问题怎样用证据区分解释 | `verification.md` |
| Threat Modeling、最小权限、失败安全 | 怎样处理信任边界、滥用路径和高风险副作用 | `architecture.md`、`verification.md` |
| Design It Twice、ADR | 怎样比较和记录难以逆转的真实架构取舍 | `architecture.md` |
| Fitness Functions | 怎样持续自动验证项目特有架构属性 | `architecture.md`、`verification.md` |

### 研究候选与评审视角

以下思想可以提供问题或属性，但目前不作为整体运行时门禁：

- **CUPID**：Composable、Unix、Predictable、Idiomatic、Domain-based 是有用方向感，但缺少统一通过线；只将能落成具体决定的部分晋升。
- **Clean Code**：可读命名、小函数等建议必须服从领域、局部性和项目风格，不用函数长度或形式指标替代职责判断。
- **完整 SOLID**：不做五个字母签到；SRP 与依赖方向常驻，其余在真实扩展轴、接口消费者或替换关系出现时采用。
- **书籍或文章原则**：先提取它能阻止的真实失败模式，再决定进入条件 reference、项目规则或只保留为来源。

## 对外分类

“方法论”是面向用户的总称；公开说明根据本次作用使用准确分类：

- **工程原则**：约束事实、所有权、简洁度、耦合、事实源或优先级；
- **架构方法**：塑造 Module、Interface、依赖或领域边界；
- **改造策略**：控制重构、迁移、兼容期和退出；
- **验证方法**：决定诊断、测试和证据形式。

没有准确方法名时使用“工程判断”；用户直接限定选择时使用“用户明确约束”，不冒充方法论。

## 真实冲突

- **OCP 与 YAGNI**：只围绕已观察到且值得保护的变化轴建立扩展接缝。
- **DRY 与低耦合**：共享业务知识，不共享仅仅相似的语法。
- **模块化与 KISS**：模块用于隐藏复杂度和集中变化，不以数量衡量质量。
- **Boy Scout / Tidy First 与外科手术式修改**：允许整理当前因果边界，不扩大任务范围。
- **Clean cut 与渐进迁移**：消费者可同步时干净切换；真实迁移约束存在时才增加临时双轨。
- **长期最优与权限边界**：可以推荐破坏性目标方案；执行仍需满足消费者、迁移、恢复和授权。
- **稳定抽象与当前消费者**：没有需要隔离的变化或消费者时，不因 DIP、SAP 等名称预建接口。

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
- 新规则先进入固定行为案例；仅当它稳定改善决定且没有明显误触发时才进入运行时。
- 没有改变决定、持续制造术语复述、造成过度设计或与已有规则重复的内容应合并或删除。
- 一次评测优先只改变一个相关方法组；确需组合修改时，分别保留单组与组合冲突证据。

## 一手来源

- Liskov 与 Wing：[A Behavioral Notion of Subtyping](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf)
- Robert C. Martin：[SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html)、[An Open and Closed Case](https://blog.cleancoder.com/uncle-bob/2013/03/08/AnOpenAndClosedCase.html)、[Principles and Patterns](https://objectmentor.com/resources/articles/Principles_and_Patterns.pdf)
- Dan North：[CUPID—for joyful coding](https://dannorth.net/blog/cupid-for-joyful-coding/)
- Martin Fowler：[Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html)、[Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)、[Branch by Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html)
- Michael Feathers：[Characterization Testing](https://michaelfeathers.silvrback.com/characterization-testing)
- Kent Beck：[Structure and Behavior](https://newsletter.kentbeck.com/p/structure-and-behavior)
- Eric Evans：[Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- Gary Bernhardt：[Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)、[Boundaries](https://www.destroyallsoftware.com/talks/boundaries)
- John Ousterhout：[A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/aposd.php)
- The Mikado Method：[官方站](https://mikadomethod.info/)
- Evolutionary Architecture：[Fitness Functions 概要](https://evolutionaryarchitecture.com/precis.html)
