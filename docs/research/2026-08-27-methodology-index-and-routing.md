# 石头鱼的工程规则：方法论索引、分层与按需路由研究

> 日期：2026-08-27
> 范围：核验现有 `stonefish-engineering` 的方法论覆盖，判断新增内容应进入核心规则、按需参考、项目级规则还是仅保留为研究材料。
> 证据边界：结论只以原作者文章、作者/出版社官方资料、规范或项目原仓库为依据；`agent-rules-books` 只作为候选线索与压缩设计样本，不作为工程原则本身的权威来源。
> 快照用途：本文是 `v0.3.3`（`cd769a8`）的方法论设计记录，候选状态不代表现行实现状态。当前采用范围、冲突规则和评测案例以 [方法论索引](../../plugins/stonefish-engineering/skills/stonefish-engineering/references/methodology-index.md) 为准。

## 结论先行

1. **现有规则并不只包含 5～6 套方法论。** 按“能改变一次工程决策的独立方法族”计，当前内容至少已经覆盖 **25 个可辨识的方法族**。多数原则没有挂名，但语义已经存在；继续堆 SOLID、CUPID、Clean Code 等名词，主要会增加重复、token 和教条化风险。
2. **真正值得补的不是一整套新教义，而是少数条件化缺口：**
   - 多实现/可替换实现的行为契约与 contract tests（LSP 的可执行部分）；
   - 大型迁移的策略选择：clean cut、Parallel Change、Branch by Abstraction、Strangler Fig、Mikado Method；
   - 复杂遗留代码的 characterization tests；
   - 结构改动与行为改动的排序及证据边界（Tidy First 的可执行部分）；
   - 项目级 bounded context、core domain 与架构 fitness functions。
3. **不建议整体引入 SOLID、CUPID、Clean Code、DDD 战术模式或组件六原则。** 它们要么已被更具体的规则覆盖，要么只有在明确上下文中才成立。最危险的是把口号改写成绝对命令，例如“新增行为绝不修改旧代码”“稳定组件必须抽象”“没有独立版本就不算复用”“任何破坏性重构都用 Strangler”。
4. **当前应使用静态 Markdown 索引，不使用 SQLite。** 以当前约 25 个方法族和少量参考文件，Markdown 能被审查、版本化、直接按需读取；SQLite 会额外引入 schema、迁移、查询工具、打包、故障和评测面，却不会自动获得语义路由能力。
5. **全局 `AGENTS.md` 不应再复制工程方法论。** 它适合保留个人协作、权限边界、工具偏好和 CodeGraph 规则；工程方法论及路由留在插件。否则 Hook、Skill 与全局规则会形成多份事实源，版本升级后难以判断 AI 实际遵循的是哪一份。

## 一、现有规则到底包含多少方法论

### 计数口径

“方法论数量”没有公认的客观单位。KISS 可以算一条原则，也可以与 YAGNI 合并；Clean Architecture 可以算一套，也可以拆成依赖方向、边界、用例所有权等多条。为了避免为了数字而数字，本报告使用以下口径：

> 如果一组规则有独立的触发条件，并能改变设计、修改边界或验证方式中的一项决策，就计为一个“操作方法族”。同义口号不重复计数。

按严格合并同类项的口径，研究时快照中的核心 Skill 与三份 reference 至少覆盖 **25 个方法族**；若把安全、迁移和组件边界下的子方法分别计数，会超过 30。为避免制造虚假的精确度，下表展示覆盖面而不再逐项编号：

| 类别 | 已覆盖的方法族 |
|---|---|
| 判断与设计 | 第一性原理；KISS/YAGNI；知识级 DRY；按变化原因划分职责（SRP）；高内聚低耦合；模块化/组件化作为边界手段；变更局部性；基于证据的性能优化 |
| 边界与架构 | 信任边界与最小权限；领域语言；深模块与信息隐藏；最小稳定公共面；依赖方向/DIP；单一事实源；Clean/Hexagonal 的条件化采用；循环依赖作为架构信号 |
| 修改策略 | Surgical Changes 与 Boy Scout Rule；能力阶梯；根因导向的最小完整重构；消费者审计；clean cut 与显式兼容期；依赖与 lockfile 纪律 |
| 可靠性与安全 | 威胁建模与数据最小化；超时/取消/有界重试/幂等；外部调用成本意识；条件化 ADR |
| 诊断与验证 | 可证伪假设与证据驱动调试；行为测试/纵向切片/风险比例验证；测试信号保护与 flaky 根因治理；错误语义；标准与任务目标的双轴审查 |

这说明“没有写出方法名”不等于“没有方法论”。对 Agent 来说，**触发条件、动作和反例通常比出处名词更重要**。

## 二、逐项核验与放置建议

### 总表

| 方法 | 当前覆盖 | 真实缺口或需纠正之处 | 推荐放置 |
|---|---|---|---|
| SOLID-S | 完整 | 无；当前“按变化原因划分职责”比泛化的“一件事”更准确 | 保持现状，不再挂名 |
| SOLID-O | 部分 | 只需补“围绕已观察到的变化轴做战略性封闭”；不能写成永不修改旧代码 | Architecture reference，可不新增 |
| SOLID-L | 部分 | 多实现/子类型须保持前置条件、后置条件、不变量、错误与副作用语义，并用共享 contract tests 证明 | Verification/Architecture reference |
| SOLID-I | 完整 | “一个入口”不等于接口隔离；当前按消费者需要保持最小公共面更可执行 | 保持现状 |
| SOLID-D | 完整 | 不应升级成“所有依赖都必须抽象” | 保持现状 |
| CUPID | 基本完整 | 适合作为审查视角，不适合作为通过/失败清单 | 研究索引，不进规则正文 |
| REP/CCP/CRP | CCP 完整；CRP 部分；REP 缺失 | 只在可独立发布/复用组件、多消费者边界中有足够收益；三者存在真实张力 | Component reference 或项目级 |
| ADP/SDP/SAP | ADP 部分；SDP/SAP 部分 | “稳定”是改变成本/被依赖程度，不是“很少提交”；SAP 不能迫使所有稳定代码先造抽象 | Component reference 或项目级 |
| Strangler Fig | 流程许可已有，执行手法缺失 | 不是所有重构的默认方案；要与其他迁移模式按问题类型选择 | Migration reference |
| DDD | 领域语言已有；其余部分 | 真正缺口是 bounded context、core domain 及上下文关系；完整战术模式不能全局强制 | 项目级或 domain-modeling Skill |
| Tidy First | 部分 | 显式区分结构改动与行为改动，并决定先后次序；不能强制永远先整理 | Change-boundaries reference |
| Functional Core / Imperative Shell | 部分 | I/O 与决策缠绕、测试大量依赖 mock 时，可明确采用；不能强迫所有状态型业务纯函数化 | Architecture/Verification reference |
| Characterization Testing | 缺失 | 未知遗留行为在重构前需要捕获现状，而不是先把现状当成正确规范 | Verification/Migration reference |
| Evolutionary Architecture fitness functions | 缺失 | 把项目特有的架构质量写成可自动运行的守护指标 | 项目级 |
| Mikado Method | 缺失 | 大型源代码重构依赖关系不清时，用实验—发现前置条件—回退—绘图 | Migration reference |

## 三、SOLID：补行为契约，不补五个口号

### S：现有表述已经足够

Robert C. Martin 后来的说明把 SRP 表述为“因为同一类人/同一原因而变化的内容放在一起”。当前规则用“变化原因”和“所有权”划分职责，已经比常见的“一个类只做一件事”更准确，不需要重复加 `SRP` 标签。[Robert C. Martin, *SOLID Relevance*](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html)

### O：不能解释成“新增行为绝不修改旧代码”

Martin 自己明确修正过 OCP 的绝对化理解：系统不可能对所有变化完全关闭，设计是在值得保护的变化轴上进行**战略性封闭**。因此，更稳妥的规则是：

> 当同一变化轴已经反复出现，且有稳定的扩展点证据时，让新增行为尽量局部化；不要为了假想扩展先建插件系统、继承层或兼容层。

这与当前“抽象须有重复证据”“最小稳定公共面”“变更局部性”基本重合。用户提供的“新增行为应该通过新增代码实现，而不是改已经工作的旧代码”过于绝对，会诱发条件分发器、过度继承和永久兼容层，应明确反驳。[Robert C. Martin, *An Open and Closed Case*](https://blog.cleancoder.com/uncle-bob/2013/03/08/AnOpenAndClosedCase.html)

### L：这是最清楚的真实缺口

Liskov 与 Wing 的原始定义是**行为子类型**：使用抽象类型时已经成立的可证明属性，在替换为子类型后仍应成立。它不等同于“能通过类型检查”，也不限于 class inheritance。[Liskov & Wing, *A Behavioral Notion of Subtyping*](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf)

建议把可执行部分放入按需 reference：

- 当同一 port/interface 有多个实现、adapter、provider 或 test double 时，保持相同的前置条件、后置条件、不变量、失败语义与关键副作用语义；
- 不允许某个实现偷偷要求更强输入条件，或把明确失败静默变成默认值；
- 对多个实现运行同一组 contract tests，而不是只测试每个实现自己的 happy path。

它不适合放进每轮核心提醒，因为只有出现“可替换实现”时才触发。

### I：一个入口不等于接口隔离

ISP 关心的是调用方是否被迫依赖不需要的能力。一个“大而全”的单一入口仍然可能违反 ISP；多个围绕消费者需要的小接口反而更合适。当前规则强调“公共面只暴露用例所需的最小稳定能力”，已经比“模块只允许一个入口”精确。[Robert C. Martin, *SOLID Relevance*](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html)

### D：已经完整覆盖，而且当前限制更健康

当前业务策略不依赖数据库、网络和框架具体实现，以及 ports/adapters 的条件化使用，就是 DIP 的实质。早期原文也承认“所有具体依赖一律禁止”是严苛甚至不现实的解释；对极稳定平台能力无意义地包一层接口，不会自动提高设计质量。[Robert C. Martin, *Principles and Patterns*](https://objectmentor.com/resources/articles/Principles_and_Patterns.pdf)

**结论：** SOLID 只补 LSP 的行为契约与 contract-test 触发器；其余保留现有具体表述，不引入五字母检查表。

## 四、CUPID：适合做方向感，不适合做强制门禁

Dan North 把 CUPID 定义为五类“令人愉快工作的代码属性”：Composable、Unix philosophy、Predictable、Idiomatic、Domain-based。他特意强调这些是有权衡的属性/启发式，不存在全部达成或一票失败的及格线。[Dan North, *CUPID—for joyful coding*](https://dannorth.net/blog/cupid-for-joyful-coding/)

现有覆盖关系如下：

- Composable：最小依赖、最小公共面、深模块；
- Unix：单一目的、KISS、可组合边界；
- Predictable：可观察行为、错误语义、测试与确定性验证；
- Idiomatic：遵循项目既有工具链和代码风格；
- Domain-based：领域语言、业务所有权和按领域组织边界。

用户观察到的张力是成立的：如果希望规则“可执行、可验证”，就不应把 CUPID 整套变成硬检查表。建议只在 methodology index 中标注它是一个**审查视角**，不把缩写和五条重复塞进核心。

## 五、组件内聚/耦合六原则：有价值，但必须先满足组件语境

Robert C. Martin 的 package/component 原则原文包含 REP、CCP、CRP、ADP、SDP、SAP，并明确指出内聚三原则之间有张力：CCP 倾向让组件变大，CRP 倾向让组件变小；项目阶段和复用方式会改变取舍。[Robert C. Martin, *Principles and Patterns*](https://objectmentor.com/resources/articles/Principles_and_Patterns.pdf)

### 需要纠正的绝对化表述

- **“没有独立版本号就谈不上复用”不准确。** REP 讨论的是可发布、可跟踪的复用粒度，尤其适用于对外或跨团队消费的 package；同一仓库内部的 source reuse 并不会因为没有独立 semver 就“不存在”。
- **CCP 不是新缺口。** 当前“因同一原因共同变化的内容放在同一所有权边界”“让修改局部化”就是组件级 SRP。
- **CRP 不能退化为越拆越好。** 它要求消费者不要被迫依赖不复用的内容；当前最小公共面已经部分覆盖。
- **“稳定”不是提交频率低。** SDP 的稳定性更接近改变成本和被多少上游依赖；一个经常优化但公共契约稳定的组件，仍可能是依赖图中的稳定点。
- **SAP 不能全局强制。** “稳定组件应当抽象”只在组件依赖图和复用边界中讨论；把它翻译成“所有稳定模块都先造 interface”会直接违反 KISS/YAGNI。

### 建议触发条件

只有满足以下任一条件时，才读取组件原则 reference：

- package 需要独立发布、版本管理或被外部仓库消费；
- 多团队/多产品共享一个组件，消费者集合明显不同；
- 组件依赖图已经出现环、发布连锁或“一处升级全仓跟着动”；
- 正在决定 monorepo 的 package 边界，而不是普通目录如何分文件。

因此，它们适合一张“组件边界诊断表”，不适合加入全局核心。

## 六、破坏性重构需要策略选择，不是统一使用 Strangler

现有规则已经回答了“是否允许”：为了长期正确所有权，可以做破坏性修改；先审计消费者、迁移、回滚和删除边界；所有消费者可同步时优先 clean cut；外部消费者不可同步时才允许有明确终点的兼容期。缺口在于**不同问题选哪一种迁移执行法**。

| 问题类型 | 更合适的模式 | 关键限制 |
|---|---|---|
| 所有消费者可同批修改 | Clean cut | 同一变更完成调用点、文档、测试与旧路径删除 |
| API/schema 不能一次破坏全部消费者 | Parallel Change（expand → migrate → contract） | 兼容面必须有 owner、退出条件和删除验证 |
| 替换库、框架、provider，主干仍需持续交付 | Branch by Abstraction | 抽象是临时迁移 seam；完成后评估是否仍有长期价值 |
| 大系统按业务能力逐片替换 | Strangler Fig | 找到可拦截/重定向的边界；警惕双写、共享状态和永久双轨 |
| 大型源码重构，前置依赖关系尚不清楚 | Mikado Method | 用小实验暴露前置条件并记录依赖图；采用可恢复手段，不照搬破坏性 reset 命令 |

Fowler 对 Strangler 的描述是随时间用新系统逐步包围和替换旧系统；切入点可以是网络入口、事件、业务能力或资产捕获，不必固定为一个“入口函数”。因此用户给出的四步是一个可用实例，不是模式的普遍定义。[Martin Fowler, *Strangler Fig Application*](https://martinfowler.com/bliki/StranglerFigApplication.html)；[Martin Fowler, *Original Strangler Fig Application*](https://martinfowler.com/bliki/OriginalStranglerFigApplication.html)

相关一手模式资料：

- [Martin Fowler, *Parallel Change*](https://martinfowler.com/bliki/ParallelChange.html)
- [Martin Fowler, *Branch by Abstraction*](https://martinfowler.com/bliki/BranchByAbstraction.html)
- [Martin Fowler, *Transitional Architecture*](https://martinfowler.com/articles/patterns-legacy-displacement/transitional-architecture.html)
- [Martin Fowler, *Patterns of Legacy Displacement*](https://martinfowler.com/articles/patterns-legacy-displacement/)
- [The Mikado Method 官方站](https://mikadomethod.info/)

**建议：** 新增按需 migration reference 或把这张选择表并入 `change-boundaries.md`；不要在核心写“允许破坏性重构 = 默认 Strangler”。

## 七、DDD：保留语言，按项目引入边界，不全局搬战术模式

Eric Evans 的官方 DDD Reference 把重点放在：聚焦核心领域；领域专家与软件人员共同塑造模型；在明确的 bounded context 中使用 ubiquitous language。[Domain Language, *Domain-Driven Design Reference*](https://www.domainlanguage.com/ddd/reference/)，[PDF](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)

当前规则已经有 ubiquitous language、业务所有者、业务决策与 I/O 边界，真实缺口是：

- 当同一个词在不同团队/子域中含义不同，明确 bounded context，而不是强求全公司一个统一模型；
- 优先把设计能力投入 core domain，通用支撑能力优先采用成熟方案；
- 跨 context 明确上下游关系、翻译层与契约所有者。

需要避免三种误用：

1. bounded context 不等于一个微服务、文件夹或 package；它首先是模型和语言成立的边界；
2. DDD 不等于把所有数据对象改成 Entity/Value Object/Aggregate/Repository；
3. 简单 CRUD、内部脚本或稳定通用域不应为了“DDD 完整性”增加战术层级。

因此，DDD 的核心词汇不应继续进入 always-on 核心；它适合项目级 `CONTEXT.md`、domain-modeling Skill 或在复杂业务建模时按需读取的 reference。

## 八、Tidy First 与 Functional Core / Imperative Shell

### Tidy First：关键是排序选择，不是永远先整理

Kent Beck 区分结构改动与行为改动，并强调两者的可逆性和排序价值；书名是一个问题，不是一条“所有任务先清理代码”的命令。他也明确讨论有时先 tidy、有时后 tidy。[Kent Beck, *Structure and Behavior*](https://newsletter.kentbeck.com/p/structure-and-behavior)；[O’Reilly, *Tidy First?* 官方书页](https://www.oreilly.com/library/view/tidy-first/9781098151232/)

建议补成一条条件化规则：

> 先区分行为改动和结构改动。只有当一个小、可验证、可回退的结构整理会明显降低本次行为修改风险时才先做；否则先完成行为目标，随后在同一所有权边界内整理或明确不整理。验证结果必须能区分“行为保持不变”与“行为已经改变”。

这与 Surgical Changes 和 Boy Scout Rule 不冲突，反而补足了二者的先后决策。不要强制“每次先重构”或“必须拆成独立 commit”，后者还会越过用户的提交授权。

### Functional Core / Imperative Shell：当前已有雏形，缺触发器

Gary Bernhardt 的原始讲解主张把产生决策/值的逻辑放到易测试的纯核心，把数据库、网络、文件和进程等副作用留在命令式外壳。[Gary Bernhardt, *Functional Core, Imperative Shell*](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)；[Gary Bernhardt, *Boundaries*](https://www.destroyallsoftware.com/talks/boundaries)

建议只在以下信号出现时启用：

- 业务判断与 I/O 交错，测试必须 mock 多个外部系统；
- 同一决策需要在 CLI、HTTP、任务队列等多个入口复用；
- 确定性计算被全局状态、时钟或随机数污染。

不应把所有状态型工作流、UI 交互或 domain object 强行改成纯函数；明确状态机、事务边界或 actor 可能是更自然的模型。

## 九、`agent-rules-books`：可借鉴压缩结构，不能当权威语料库

### 来源质量

原仓库主动声明这些规则是受书籍启发的提炼，并非作者官方版本，也不能替代原书。[仓库 README](https://github.com/ciembor/agent-rules-books)

其积极价值是工程化组织方式：

- 同一主题提供 full/mini/nano 等不同 token 预算；
- 压缩时尽量保留会改变决定的内容；
- 用使用说明区分加载方式；
- 有把 mini/nano 条目映射回内部 full 文件行号的 traceability 过程。

相关原仓库资料：[Usage](https://github.com/ciembor/agent-rules-books/blob/main/docs/USAGE.md)、[Adding a Book](https://github.com/ciembor/agent-rules-books/blob/main/docs/ADDING_THE_BOOK.md)、[Compression Process](https://github.com/ciembor/agent-rules-books/blob/main/_rule-workbench/PROCESS.md)。

但证据强度有限：

- 增加书籍的流程允许先让聊天模型生成结构和隐含规则，再由人审阅；它没有要求每条规则都附原书页码/原作者一手链接；
- mini/nano 的追溯主要指向仓库自己生成的 full 文本，不等于追溯到原书原句；
- README 展示的是作者自己描述的早期定性实验，而不是独立、可重复、覆盖多任务的基准；
- 不同书之间存在真实冲突。例如 Ousterhout 明确主张深模块和信息隐藏，并在官方课程/书籍材料中讨论其与部分 Clean Code 主张的不同，说明不能把多本书简单叠加成“全部同时正确”。[John Ousterhout, *A Philosophy of Software Design* 官方页](https://web.stanford.edu/~ouster/cgi-bin/book.php)；[Stanford CS190 Modular Design](https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php%3Ftopic%3DmodularDesign)

因此，`agent-rules-books` 的定位应是：**候选清单、压缩设计样本、测试灵感，证据等级为二手。** 每条真正进入石头鱼规则的内容仍须回到原作者/规范核验，并改写成自己的触发—动作—反例格式。

### 许可与复制边界

仓库根许可证是 MIT。[LICENSE](https://github.com/ciembor/agent-rules-books/blob/main/LICENSE)

可据此复用仓库作者拥有权利的代码与文本，但若复制实质性内容，应保留 MIT 的版权和许可通知。更重要的是：仓库许可证不能替底层各本受版权保护的书自动授予再分发权；README 的“不是原书替代品”声明也不是法律保证。因此：

- 可以借鉴目录、层级、路由和压缩方法；
- 不建议把 full/mini/nano 全量 vendor 进插件再公开发布；
- 采用具体原则时回到一手来源并自行写成短规则；
- 优先使用许可清晰的一手资料。例如 Eric Evans 的 DDD Reference 页面明确以 CC BY 4.0 发布，改编时按要求署名；
- 对许可敏感的公开发布，最终仍应做独立法律/合规核验；本报告不是法律意见。

## 十、Markdown 索引还是 SQLite

### 当前推荐：Markdown 索引 + Skill 按触发条件读取

Codex 官方 Skill 指南把 `SKILL.md` 的描述用于决定何时考虑该 Skill，并支持把细节放在 `references/`，由 Skill 明确何时读取；官方也建议只在确有必要时增加脚本，并用直接触发、间接触发、不完整输入、不应触发和边界情况做测试。[OpenAI, *Build skills*](https://developers.openai.com/plugins/build/skills)

建议新增一个静态索引（或先在现有 reference 顶部加入同等表格）：

```text
id | trigger | use_when | do_not_use_when | reference | tradeoff | primary_source | eval_cases
```

每次任务优先只读取真正匹配的 reference；简单任务通常只需 1～2 份，复杂任务按真实风险组合，不设固定数量上限：

- 核心 Skill：长期所有权、最小完整方案、修改边界、验证闭环；
- Architecture：边界/依赖/抽象/多实现契约；
- Change boundaries / Migration：大重构、消费者迁移、兼容期；
- Verification：诊断、测试、失败语义、characterization tests；
- 项目级文件：DDD context map、具体安全模型、性能 SLO、架构 fitness functions。

这比“每轮加载全部方法论”更省 token，也比 Hook 根据关键词轮询提醒更准确。Hook 应继续注入精简核心，不应承担方法论数据库查询；语义路由由 Skill 在看见完整任务上下文后完成。

### 为什么现在不需要 SQLite

当前只有约 25 个方法族、3 份 reference 和少量拟补条目。SQLite 会新增：schema、迁移、查询脚本、运行时打包、权限、错误处理、数据库版本和测试；而普通 SQLite 查询本身只提供结构化过滤，不会自动理解“这轮是在迁移系统还是改一个函数”。如果需要语义匹配，仍要额外建设 FTS、embedding 或模型 router 及其评测。

**建议只有在出现可测量的规模与查询问题，并且大部分条件同时成立时才升级：**

- 独立维护的方法达到约 **100～200+**，或来源片段达到数千条；
- 内容需要频繁从多个来源动态更新，并保存版本、出处和废弃状态；
- 存在大量多对多标签、冲突关系、适用语言/框架矩阵；
- 需要使用统计、反馈闭环或可复现的全文查询；
- 已实测 Markdown/`rg` 的查找延迟、漏召回或维护冲突成为持续问题；
- 已有明确 owner 愿意维护查询工具、schema migration 和 eval suite。

这里的 100～200 是本项目的工程启用阈值，不是行业定律。即便达到阈值，也应先评估静态生成的 JSON/Markdown 索引或 SQLite FTS；不要因为“数据库更高级”而引入运行时数据库。

## 十一、另外值得借鉴的少数方法

### 1. Characterization Testing：遗留代码重构的保护网

Michael Feathers 把 characterization tests 用来捕获系统当前实际行为，尤其适合缺少可信测试的遗留代码。它不宣称当前行为都正确，而是先让变化可见，再由需求决定哪些行为保留、哪些修复。[Michael Feathers, *Characterization Testing*](https://michaelfeathers.silvrback.com/characterization-testing)；[Pearson, *Working Effectively with Legacy Code* 官方书页](https://www.pearson.com/en-us/subject-catalog/p/working-effectively-with-legacy-code/P200000008984/9780131177055)

这是当前 verification reference 最明确的真实缺口之一，适合在“未知遗留行为 + 大重构”时触发。

### 2. Mikado Method：先发现重构依赖图

当大型重构无法一步完成时，Mikado Method 用一个尝试暴露阻碍，把阻碍记录成前置节点，恢复工作区后递归解决依赖。它适合源码依赖不清的问题，比把所有大型重构都称为 Strangler 更精确。[The Mikado Method 官方站](https://mikadomethod.info/)；[Manning 官方书页](https://www.manning.com/books/the-mikado-method)

只采用方法思想，不照搬任何破坏性恢复命令；实际操作继续遵守当前“保护用户修改、可恢复操作、未经授权不 reset”的规则。

### 3. Evolutionary Architecture Fitness Functions：项目级守护架构属性

Neal Ford、Rebecca Parsons、Patrick Kua 把 fitness function 定义为对架构特征提供客观完整性评估的机制。对 20～30 模块 monorepo，可把“无环依赖”“领域层不依赖具体数据库”“公共 API 兼容性”“bundle/延迟上限”等项目特有约束变成自动检查，而不是只写口号。[Evolutionary Architecture 官方摘要](https://evolutionaryarchitecture.com/precis.html)；[Thoughtworks 官方书页](https://www.thoughtworks.com/en-gb/insights/books/building-evolutionaryarchitectures-second-edition)

它只能是项目级：不同项目要保护的质量属性不同，不能在全局插件中预设指标。

### 4. Refactoring：保留行为的小步结构调整

Martin Fowler 对 refactoring 的定义强调在不改变可观察行为的前提下改善内部结构，并通过许多小步骤降低风险。当前“最小完整重构 + 风险比例验证”已经覆盖其核心，不需要再新增同义规则，只可作为 Tidy First 与 migration reference 的来源背景。[Refactoring 官方站](https://refactoring.com/)；[Martin Fowler, *Refactoring* 官方书页](https://www.martinfowler.com/books/refactoring.html)

## 十二、建议的落地优先级

### P0：现在就做，且不扩张核心

1. 保持核心 Skill 精简；全局 `AGENTS.md` 不复制方法论。
2. 新增/维护一个 methodology index，记录 trigger、non-trigger、tradeoff、primary source 和 eval cases。
3. 将 agent-rules-books 标为“二手候选源”，禁止直接把整套规则当权威导入。

### P1：补三个真正可执行的 reference 缺口

1. 多实现行为契约 + 共享 contract tests；
2. migration 策略选择表 + 每条临时路径的 owner/退出条件/删除证据；
3. legacy characterization tests + 结构/行为修改的排序规则。

### P2：只在项目事实触发时加入

1. DDD bounded context/context map；
2. 可独立发布组件的 REP/CCP/CRP/ADP/SDP/SAP 诊断表；
3. 项目架构 fitness functions；
4. Functional Core / Imperative Shell 的 I/O 分离建议。

### 不建议加入

- SOLID/CUPID/Clean Code/DDD 的整套口号清单；
- “任何新增行为都不得修改旧代码”；
- “每个稳定模块都必须依赖抽象”；
- “没有独立版本号就不算复用”；
- “所有破坏性重构都用 Strangler”；
- 每轮 Hook 读取全量方法论或查询 SQLite；
- 未经一手核验直接 vendor `agent-rules-books` 的大段内容。

## 十三、如何持续优化和测试这套工作流

方法论条目使用四级生命周期：

```text
research candidate → reference → core
                           ↘ project rule
```

- **Candidate：** 有一手来源，但尚未证明能改善本插件的真实失败模式；
- **Reference：** 有清晰 trigger/non-trigger，且只在特定任务中读取；
- **Core：** 适用于绝大多数工程任务、短小、反复阻止过真实失败，并且没有明显上下文伤害；
- **Project rule：** 依赖具体领域、团队、发布、SLO 或合规事实。

每个候选至少建立以下 eval：

1. 两个应该触发的任务；
2. 一个不应触发的近似任务；
3. 一个与 KISS、兼容性或范围边界冲突的案例；
4. 一个已知失败模式；
5. 期望它改变的具体决定，而不是检查回答里有没有复述术语。

持续观察四类指标：

- 路由 precision/recall：该读时是否读、不该读时是否制造噪音；
- 结果 adherence：是否真的改变所有权、迁移或验证决定；
- 负面成本：是否增加无用抽象、永久兼容层、越界重构；
- 系统成本：注入字节数、token、延迟、Hook/Skill 失败率。

只有反复出现同类失败，或 eval 明确显示现有规则漏拦，才把 reference 晋升为 core。建议在插件/Codex 行为发生变化、连续出现同类失败，或每季度做一次小型复审；不要因为又读到一本好书就立即扩充 always-on 规则。

## 最终建议

最优方案不是建立一座“工程思想百科全书”，而是维护一个**可追溯的方法论索引 + 精简核心 + 条件化 reference + 项目事实规则**：

- 核心回答“每次都要守住什么”；
- reference 回答“出现某类信号时采用什么手法”；
- 项目规则回答“这个仓库具体保护什么”；
- 索引保存来源、冲突、触发和测试，而不参与每轮全量注入。

这既能保留石头鱼的工程规则对长期质量的强约束，也能避免“原则越多，Agent 越可靠”的错觉。
