# 石头鱼的工程规则：工程决策文案结构与触发边界

> **日期**：2026-08-29
>
> **研究问题**：怎样向用户说明“本次工程决策运用了什么方法论、方法如何影响决策、产生什么影响、有哪些优缺点”，同时保持准确、通俗、低噪音，并且不把公开说明伪装成隐藏思维链。
>
> **证据范围**：Michael Nygard 的 ADR 原始文章、MADR 官方模板、Google 官方 Engineering Practices、Microsoft Azure 与 AWS 官方 ADR 指南、OpenAI Model Spec。
>
> 与既有研究的关系：本文补充并校正 [2026-08-28 的方法论披露研究](2026-08-28-methodology-disclosure-and-decision-transparency.md)，重点解决字段语义、优缺点展示条件和用户可学习性；不重复 Hook 技术结论。

> **研究快照**：本文形成于用户确认前。后续最终采用 `## 🧭 本次决策与方法论（石头鱼的工程规则）`，按独立决策展示实际改变用户判断的方法，方案与交付使用不同影响/验证字段；大量决定使用紧凑索引并服从更高优先级的输出约束。运行时契约以核心 [SKILL.md](../../plugins/stonefish-engineering/skills/stonefish-engineering/SKILL.md) 为准。

## 结论先行

1. **用户需要的不是泛化的“工程依据”，而是一条可审查的决策说明。** 最小完整语义是：`决定 → 采用的方法 → 方法如何改变决定 → 影响/代价`；实现已经完成时，再补 `验证`。
2. **“结果”不宜同时承担收益、代价和验证。** ADR 的 `Consequences` 是选择造成的新局面，可能正面、负面或中性；MADR 又把 `Confirmation` 单独列出。因此建议把当前的“结果”拆成“影响”与可选的“验证”，避免把预期收益写成已经验证的事实。[Michael Nygard：Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)；[MADR 官方模板](https://adr.github.io/madr/decisions/adr-template.html)
3. **优缺点不是每项强制字段。** 有真实备选、代价会影响用户判断，或决定难以逆转时，显示主要收益、主要代价和未选方案；没有真实竞争方案时强行补“缺点”只会制造套话。MADR 把选项及其 pros/cons 作为完整模板内容；Nygard 的最小 ADR 只强制 Context、Decision、Consequences。[ADR GitHub organization：ADR Templates](https://adr.github.io/adr-templates/)；[Michael Nygard 原始 ADR 结构](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
4. **方法名应服务学习，但不能替代因果解释。** Google 的官方评审指南建议在适当时解释意图、所依据的最佳实践或如何改善 code health；其 CL 描述指南则要求先说明具体改了什么，再补问题、为什么这是合适方案和方案不足。[Google：How to write code review comments](https://google.github.io/eng-practices/review/reviewer/comments.html)；[Google：Writing good CL descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html)
5. **默认输出应自适应，而不是每次固定填满一张 ADR。** OpenAI Model Spec 要求先直接回答，再在合适时补 rationale 和相关替代方案；细节很多时先给摘要、按需提供更详细的 audit trail。隐藏 chain-of-thought 不直接对用户或开发者公开，最多可能以摘要形式出现。因此这里应定位为“公开决策摘要”，不是“完整内部推理”。[OpenAI Model Spec：Hidden chain-of-thought](https://model-spec.openai.com/2025-12-18.html#definitions)；[Be clear and direct](https://model-spec.openai.com/2025-12-18.html#be-clear-and-direct)；[Be honest and transparent](https://model-spec.openai.com/2025-12-18.html#be-honest-and-transparent)

## 一、一手资料直接支持什么

### 1.1 ADR：事实、决定与后果必须分开

Michael Nygard 的原始 ADR 文章把一条重要决定分成：

- `Context`：以价值中立的语言描述事实和相互拉扯的 forces；
- `Decision`：用主动语态说明团队会做什么；
- `Consequences`：记录应用决定后的新局面，包含正面、负面和中性后果，而不只写好处；
- `Status`：标明 proposed、accepted、deprecated 或 superseded。

原文还限定 ADR 用于影响结构、非功能属性、依赖、接口或构建技术的“架构上重要”决定，并强调一条 ADR 只记录一个重要决定。[Michael Nygard：Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

这直接支持：

- 文案按“一个独立决定一项”组织，而不是按方法论清单组织；
- “采用了什么”必须和“做了什么决定”绑定；
- 不能只列收益，重要代价也属于决策的真实后果。

### 1.2 MADR：有真实选项时补 drivers、pros/cons 和 confirmation

MADR 官方完整模板在基础 ADR 之上加入：

- `Decision Drivers`；
- `Considered Options`；
- `Decision Outcome` 及选择理由；
- `Consequences`，明确区分 Good 与 Bad；
- `Confirmation`，说明怎样确认实现符合决定；
- 各备选的 `Pros and Cons`。

[MADR 官方模板](https://adr.github.io/madr/decisions/adr-template.html)；[ADR Templates 官方说明](https://adr.github.io/adr-templates/)

这直接支持：

- 方法论更接近 `Decision Driver`，但它必须和项目事实一起解释为什么选了当前方案；
- “影响/权衡”和“怎么验证”应是两个不同字段；
- 只有确实比较过不同做法时，才需要展开备选及优缺点。

### 1.3 Google：先说具体改变，再说为什么和不足

Google 的 CL 描述指南要求第一行能独立说明具体做了什么；正文可补正在解决的问题、为什么这是最佳做法，以及该做法的不足。Google 还明确认为“Fix bug”这类短但无信息的描述是不够的。[Google：Writing good CL descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html)

Google 的 code review comment 指南建议解释理由；在适当时可以说明意图、依据的最佳实践，或者建议如何改善 code health。该指南也要求区分必改、可选和 FYI，避免让读者误判说明的约束强度。[Google：How to write code review comments](https://google.github.io/eng-practices/review/reviewer/comments.html)

Google 的 review standard 进一步要求技术事实和数据高于个人偏好；若多个方案都成立，应依据数据或扎实工程原则讨论，而不是把风格偏好包装成必然结论。[Google：The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)

这直接支持：

- 标题或首句应该是通俗的具体决定，而不是先报方法名；
- 方法名之后必须有项目事实和实际影响；
- “未选方案”不能被写成错误方案；它可能只是另一种有效取舍。

### 1.4 官方 ADR 指南：详细程度应由重要性和可逆性决定

Microsoft Azure Well-Architected Framework 建议只记录影响系统结构、关键质量属性或难以逆转的选择；每条应包含 context、options、outcome、重要 tradeoffs、状态，必要时置信度，并保持简洁、明确、聚焦和事实化。它还明确要求不要隐藏决定的后果。[Microsoft Azure：Maintain an architecture decision record](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)

AWS Prescriptive Guidance 的最小内容同样是 context、decision、consequences，并强调 ADR 关注“为什么决定”，而非实现细节；其适用范围包括结构、非功能需求、依赖、接口和构建技术。[AWS：Architectural decision record process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)

这直接支持把完整优缺点展开限定在高影响、难逆转或真实竞争的决定上，而不是每个普通代码动作都输出完整模板。

### 1.5 OpenAI：公开简明依据可以给，隐藏思维链不能伪装成可审计记录

OpenAI Model Spec 将 hidden chain-of-thought 定义为模型用于生成答案但不直接向用户或开发者公开的消息，最多可能以摘要形式出现。它同时要求回答清晰直接：先给答案，在适当时再给 rationale 与相关替代方案；对于复杂且重要的副作用，应先给可读摘要，再按需提供更详细的 audit trail。[OpenAI Model Spec：Definitions](https://model-spec.openai.com/2025-12-18.html#definitions)；[Be clear and direct](https://model-spec.openai.com/2025-12-18.html#be-clear-and-direct)；[Be honest and transparent](https://model-spec.openai.com/2025-12-18.html#be-honest-and-transparent)

这直接支持：

- 可以公开说明项目事实、采用的方法、最终决定、后果与验证；
- 不应把这段文案称为“完整思考过程”或“真实思维链”；
- 文案不能抢在交付结果之前，也不能因为追求透明度而淹没结果。

## 二、从一手资料推导出的产品设计

以下不是任何单一来源规定的 Codex 文案格式，而是把 ADR、Google 变更说明和 OpenAI 表达边界迁移到当前工作流后的**设计推断**。

### 2.1 推荐字段

```md
**🧭 本次方法与取舍（石头鱼的工程规则）**

- 🧩 **{这次做出的具体决定}**
  - **采用方法**：{一个或多个准确方法名}。
  - **为什么适用**：{项目事实/约束}，所以它使方案从 {可能的另一做法，可省略} 变成 {当前做法}。
  - **影响与代价**：{主要收益}；代价是 {真实代价，没有则不硬编}。
  - **怎么确认**：{已运行验证或待验收边界，仅实现/验证型任务出现}。
```

字段职责：

| 字段 | 回答的问题 | 是否默认出现 |
| --- | --- | --- |
| 具体决定 | 最终选了什么？ | 必须 |
| 采用方法 | 用户可以学习和检索哪个方法？ | 有准确名称且确实改变决定时 |
| 为什么适用 | 方法怎样连接项目事实与决定？ | 必须 |
| 影响与代价 | 得到了什么，又付出了什么？ | 重要影响存在时；不虚构代价 |
| 怎么确认 | 这是预期影响还是已证明结果？ | 已实施、修复或验证时 |
| 未选方案 | 为什么没有选另一种有效做法？ | 有真实竞争方案时 |

### 2.2 为什么不继续使用单一“结果”字段

“结果”至少可能指三件不同的事：

1. 设计期的**预期收益**；
2. 选择带来的**正负后果**；
3. 已运行检查得到的**验证事实**。

如果统一写成“结果”，模型容易把“将降低耦合”写成已经证明“耦合降低”，也容易只写好处而省略成本。根据 ADR 的 Consequences 与 MADR 的 Confirmation 分离方式，推荐：

- 方案尚未实施：写 `影响与代价`；
- 已实施但没有实测：写 `预期影响`，明确未验证；
- 已实施且有证据：另写 `怎么确认` 或在交付正文中给验证结果。

### 2.3 三档展开，而不是一套固定表格

#### 小决定：一行

```md
- ✂️ **不新增第二套配置入口**（采用方法：**单一事实源、YAGNI**）：现有配置已经覆盖唯一消费者，因此复用现有入口，避免两处同步。
```

#### 普通决定：四行

```md
- 🧩 **把规则路由保留在一个公共 Skill 内**
  - **采用方法**：**深模块、信息隐藏、单一职责**。
  - **为什么适用**：Hook 和用户只需要一个稳定入口，内部规则会按不同原因变化，因此隐藏内部拆分，只暴露统一契约。
  - **影响与代价**：减少调用方的路由负担；代价是公共 Skill 必须维持清晰的内部路由。
```

#### 重要取舍：补未选方案和验证

```md
- 🔄 **保留一个公共 Skill，并拆分运行规则与评测资料**
  - **采用方法**：**高内聚低耦合、按变化原因拆分、KISS**。
  - **为什么适用**：运行规则影响每次注入，而评测资料只在维护时使用；它们有不同消费者和变化频率。
  - **主要收益**：减少日常注入和运行规则的维护耦合。
  - **主要代价**：增加一个维护资料位置，需要验证链接和打包边界。
  - **未选方案**：没有拆成多个公共 Skills，因为它会把内部分类暴露为调用方必须理解的接口。
  - **怎么确认**：分别验证 Hook 注入、显式 Skill 调用、按需 reference 路由及发布包内容。
```

### 2.4 建议触发边界

建议只在以下三项同时成立时展示：

1. 有可指向的项目事实、约束、消费者、风险或验证需求；
2. 某项方法实际改变了所有者、范围、抽象/契约、兼容策略、风险处理或验证方式；
3. 能说明采用后的影响，必要时也能说明真实代价或未选方案。

建议使用一个反事实检查：

> 去掉这项方法或原则后，方案是否可能落到另一个所有者、范围、契约、兼容方式或验证方式？

答案为“不会，只是最终方案也符合这个词”时，不展示该方法。这个触发边界是基于 ADR 的“重要决定”边界、Google 的事实优先原则和 OpenAI 的直接表达要求作出的推断，不是官方固定规则。

## 三、研究阶段的三个候选方向

### 方案 A：方法学习优先——研究阶段推荐起点

标题：`**🧭 本次方法与取舍（石头鱼的工程规则）**`

固定核心：`具体决定 + 采用方法 + 为什么适用`；按需追加 `影响与代价 / 未选方案 / 怎么确认`。

优点：

- 直接满足“我想知道用了什么方法、怎么用”的学习目标；
- 仍然以决定为主，不会成为方法名清单；
- 能自然容纳一个决定同时使用多个方法。

缺点：

- “方法与取舍”略偏专业；
- 如果每次都展开全部字段，会明显增加回复长度。

### 方案 B：决策理解优先

标题：`**🧭 为什么这样决定（石头鱼的工程规则）**`

优点：最口语、因果关系清楚；适合日常阅读。

缺点：方法论学习意图不够显眼，用户可能仍要寻找“采用方法”字段。

### 方案 C：品牌与审计优先

标题：`**🧭 石头鱼的工程规则 · 本次应用**`

优点：品牌识别强，适合插件固定输出；“应用”能覆盖方法、原则、模式和工程判断。

缺点：标题本身没有告诉用户会看到决定、结果还是方法；需要稳定字段弥补。

研究阶段建议先用 **方案 A**，但不立即固化正文格式；后续访谈已选择本文开头记录的最终取舍。

## 四、研究阶段的访谈问题

1. 你看到这段文案时，最先想回答的是“用了什么方法”，还是“为什么做这个决定”？
2. 你希望它是学习卡片，还是交付结果的审查摘要？两者冲突时优先哪一个？
3. 你说的“结果”更接近预期收益、实际代码变化，还是已经跑出的验证证据？
4. 你是否希望每个被采用的方法都出现，还是只展示真正改变结果的关键方法？
5. 多个方法支持同一个决定时，偏好合并在一项，还是每个方法分别解释其贡献？
6. 没有真实缺点时，是否允许省略“缺点”；还是你希望明确写“当前未发现新增代价”？
7. 只有一个合理方案时，是否还要显示“未选方案”？
8. 这段文案应该只在最终回复出现，还是方案阶段也应该实时显示？
9. 普通改动你能接受几行；架构、迁移和安全任务能接受多长？
10. 你是否希望点击方法名后能查定义/适用场景，还是当前只需自然语言说明？

## 五、可直接采用与仍需实测的边界

### 可以直接采用

- 一项对应一个独立决定，而不是一个方法名；
- 决定先于方法名；
- 项目事实必须连接方法与决定；
- 影响/代价与验证证据分离；
- 优缺点只在真实取舍时展开；
- 公开文案定位为决策摘要，不称为隐藏思维链。

### 研究阶段待确认、现已由最终取舍关闭

- 标题到底用“本次方法与取舍”“为什么这样决定”还是品牌式标题；
- 同一决定中方法名显示多少个才既有学习价值又不形成标签堆砌；
- 普通任务的理想行数；
- 方案阶段是否展示，还是只在交付时展示；
- “没有真实代价”时省略字段会不会让用户误以为遗漏分析；
- 是否需要在方法名后提供索引链接。

这些是产品偏好和真实使用效果问题，不能仅靠官方文档替用户决定；最终选择仍需持续通过版本化行为评测验证。

## 来源

- [Michael Nygard, *Documenting Architecture Decisions*](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [MADR, *ADR Template*](https://adr.github.io/madr/decisions/adr-template.html)
- [Architectural Decision Records GitHub organization, *ADR Templates*](https://adr.github.io/adr-templates/)
- [Google Engineering Practices, *Writing good CL descriptions*](https://google.github.io/eng-practices/review/developer/cl-descriptions.html)
- [Google Engineering Practices, *How to write code review comments*](https://google.github.io/eng-practices/review/reviewer/comments.html)
- [Google Engineering Practices, *The Standard of Code Review*](https://google.github.io/eng-practices/review/reviewer/standard.html)
- [Microsoft Azure Well-Architected Framework, *Maintain an architecture decision record*](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)
- [AWS Prescriptive Guidance, *Architectural decision record process*](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)
- [OpenAI Model Spec, 2025-12-18](https://model-spec.openai.com/2025-12-18.html)
