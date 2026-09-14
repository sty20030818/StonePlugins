# 石头鱼的工程规则：常驻行为、渐进披露与可验证工作流

状态：历史研究快照，原位归档。常驻契约、条件细则和证据分层仍是设计依据；下文的“当前实现”、标题候选和后续建议仅对应研究时点。现行文档见[文档索引](../README.md)；后续目标与执行边界见 [ADR-0004](../adr/0004-codex-first-bundled-engineering.md) 和[重构计划](../plans/2026-09-14-codex-first-refactor.md)，不代表已实现或验收。

> **日期**：2026-08-31
>
> **研究问题**：怎样让“最佳实践、正确边界、长期单轨、KISS/DRY/SRP、高内聚低耦合、必要时允许破坏性重构”等工程要求真正贯穿理解、设计、实施和验证，而不是只在回复末尾复述；Codex 的 `AGENTS.md`、Skills 与 Hooks 分别能保证什么；怎样用评测证明规则改变了产物。
>
> **证据范围**：OpenAI 官方 Codex/Skills/Hooks/Evals/模型指南与 Codex 官方源码；Agent Skills 官方规范；Anthropic、GitHub 的第一方 Agent 指令文档；工程方法作者的一手文章。仓库事实来自 2026-08-31 的本地工作树。
>
> **变更边界**：本文只做研究和架构建议，不修改插件代码、全局 `AGENTS.md`、Hook 或发布配置。

## 结论先行

1. **用户最初要的是一份“常驻工程执行契约”，不是一个偶尔调用的 Skill，也不是事后审查清单。** 正确目标是：工程任务从理解事实开始，到方案、实现、迁移和验证，都受同一组基线约束；如果现有代码已经满足约束，结果可以是不增加任何结构。
2. **当前“一份核心 Skill + 生命周期 Hook + 条件化 references”的技术骨架是合理的，不需要改成 SQLite、很多公共 Skills 或提示词关键字路由。** 问题主要在语义重心：核心使用“常驻工程检查 / 轻量检查”，逐轮提醒又只剩“最小完整、长期连贯、可验证”，容易被模型理解成事后复核；与此同时，65 行核心中“本次决策与方法论”占 17 行、约 1,889/5,562 bytes（约 34%），公开文案规则挤占了工程行为本身。
3. **必须区分“常驻约束”与“条件化具体模式”。** SRP、高内聚低耦合、知识级 DRY、KISS/YAGNI、正确所有者、单一事实源、因果范围、长期单轨、风险相称验证可以在每个工程任务中都约束判断；Clean Architecture、Hexagonal、DDD、Strangler、Parallel Change、完整 SOLID、组件发布原则等只有出现真实信号时才应实例化。否则“全部都用”会退化成强制加层、接口和兼容结构，反而违反 KISS/YAGNI。
4. **Hook 可以提高“规则送达率”，不能保证“模型每次都按规则做”。** `additionalContext` 是额外 developer context；它仍是提示约束，不是确定性执行器。插件 Hook 还可能因为未信任、定义哈希变化、项目/功能禁用或脚本失败而不运行。只有受管 `requirements.toml` 能在配置层强制启用受管 Hook；即便如此，也不能把生成式模型变成确定性规则引擎。[OpenAI Hooks 文档](https://learn.chatgpt.com/docs/hooks)
5. **不能用“回复里出现了 KISS/六边形”证明规则有效。** 真正的证据是同一中性任务在有/无规则或新/旧版本之间，产物决策发生可评分的变化：是否选对所有者、是否保持单一事实源、是否避免无消费者抽象、是否迁完全部调用方、是否删除永久双轨、是否按风险留下可失败的验证。公开方法论摘要只能帮助用户学习和复盘，不能充当行为门禁。
6. **推荐下一版继续保留一个公共 Skill，但重构为三层：短小的常驻执行契约、按任务事实读取的主题 references、独立的行为 evals。** `UserPromptSubmit` 每轮提醒应重申“这是执行约束，不是结尾检查或术语复述”；输出说明压缩成一个短契约，详细 Markdown 模板移到条件化 reference 或产品文档。

## 一、Codex 的真实工作机制与保证边界

### 1.1 `AGENTS.md`：启动时发现并拼接的基础指令

OpenAI 官方文档说明，Codex 在工作前读取 `AGENTS.md`，并在启动时建立一次 instruction chain：

1. 先读取 Codex home 中的 `AGENTS.override.md`，不存在时读取 `AGENTS.md`；同一层只取第一个非空文件。
2. 再从项目根一路走到当前工作目录，每层按 `AGENTS.override.md`、`AGENTS.md`、fallback 文件名的顺序取至多一个文件。
3. 按根到当前目录的顺序拼接，较近目录的内容因出现在后面而具有覆盖效果。
4. 合并默认上限是 32 KiB；指令变更后需要新 run/新会话重建链。[OpenAI：Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

这意味着：

- 全局 `AGENTS.md` 适合个人级、跨项目都成立、必须一开始就可见的短规则，例如交流语言、授权边界、项目约定优先、完成必须有证据。
- 项目/子目录 `AGENTS.md` 适合仓库事实和局部覆盖，例如工具链、测试命令、模块所有权。
- **普通 Markdown 相对链接不是 Codex 的 include 机制。** 官方发现规则只描述查找并读取候选 instructions 文件；Codex 官方实现也直接读取并拼接已发现文件内容，没有文档化的 `@include` 展开步骤。[Codex 官方源码：`agents_md.rs`](https://github.com/openai/codex/blob/main/codex-rs/core/src/agents_md.rs) 因而在主 `AGENTS.md` 写 `[规则](rules/foo.md)` 只能作为“让模型随后读取”的指针，不能等同于启动时已加载。
- 当前项目的 `<!-- CODEGRAPH_START -->` / `<!-- CODEGRAPH_END -->` 仍应留在全局 `AGENTS.md` 最后；它是跨仓库导航规则，与插件工程方法不应重复。

**保证边界**：可以验证 Codex 将哪些文件放入 instruction chain；不能由此保证模型在每次生成中都完全遵守，也不能保证一个相对链接一定被主动打开。

### 1.2 Skills：按需渐进披露的工作流与知识包

OpenAI 官方说明，Codex 初始只获得 Skill 的 `name`、`description` 和路径；选择该 Skill 后才读取完整 `SKILL.md`。初始 Skill 列表有上下文预算，过多时会缩短描述甚至省略部分 Skill。Skill 可以显式调用，也可以由 `description` 隐式匹配。[OpenAI：Build skills](https://learn.chatgpt.com/docs/build-skills)

因此 Skills 最适合：

- 有清晰触发条件的可复用工作流；
- 按任务读取的专业知识、检查表、脚本和 references；
- 需要一个明确输入、步骤、产物或验证协议的工作。

OpenAI 的写作建议是“一项 Skill 聚焦一个工作、默认优先 instructions、需要确定性行为或外部工具时才用脚本、写清输入输出并测试触发”。[OpenAI：Build skills - Best practices](https://learn.chatgpt.com/docs/build-skills#best-practices)

StonePlugins 目前把 `allow_implicit_invocation` 关闭、依赖 Hook 注入核心正文，实际上已经把这份 Skill 当成“可分发的常驻契约源文件”，而不是常规按需 Skill。这种复用方式可行，但必须在文档中明确：**Skill 的自动选择机制不是常驻性的保证来源，Hook 才是送达机制；Skill 只是规范的单一来源和手动入口。**

### 1.3 Hooks 与 `additionalContext`：生命周期送达，不是行为证明

OpenAI 官方 Hooks 文档给出的关键事实如下：[OpenAI：Hooks](https://learn.chatgpt.com/docs/hooks)

| 事件 | 当前行为 | 对 StonePlugins 的意义 |
| --- | --- | --- |
| `SessionStart` | `source` 可为 `startup`、`resume`、`clear`、`compact`；stdout / `additionalContext` 作为额外 developer context | 适合在根会话启动、恢复、清空、压缩后重新送达完整核心 |
| `UserPromptSubmit` | 每个用户提示发送前运行；matcher 当前不生效；可返回 developer context 或阻止提示 | 适合每轮送达短而固定的执行提醒，不适合靠 matcher 路由任务 |
| `SubagentStart` | 将 `additionalContext` 加入子 Agent 的 developer context；`continue:false` 不能阻止子 Agent 启动 | 适合给隔离子 Agent 送达核心契约 |
| `PreCompact` / `PostCompact` | 分别在压缩前后运行；可控制是否继续 | 只有需要保存/校验压缩过程本身时才需要 |
| `SessionStart(source=compact)` | 根会话压缩后、下一次模型请求前运行；自动压缩发生在一轮中间时也会把上下文送达立即续写 | **已能补回压缩后的核心规则，不必为“规则续注入”额外增加 `PostCompact`** |

当前 `hooks.json` 的三事件覆盖与官方契约一致：`SessionStart` 匹配四种 source，`SubagentStart` 注入完整核心，`UserPromptSubmit` 注入固定短提醒。压缩 gap 已由官方文档消除。

但有四个不能忽略的边界：

1. 多来源、同事件的匹配 Hook 都会运行；同事件的多个 command Hook 并发启动，不能依赖跨插件顺序。
2. 插件 Hook 安装或启用后不会自动受信任；用户需审核当前定义哈希，Hook 改动后会再次待审核并被跳过。
3. 用户可设置 `[features] hooks = false`；企业只有把受管 Hook 与 `hooks=true` 固定在 `requirements.toml` 才能在配置层强制。
4. `additionalContextLimit` 是近似 token spill 阈值，不是字节硬上限；省略时默认约 2,500 tokens。多个 Hook 的 context 会累加，过长会稀释重要指令。

所以“每次调用 AI 都会走一次全部规则”不是可证明的准确表述。更准确的是：

> 在 Hook 已启用、已信任、脚本成功且事件确实发生时，Codex 会在会话/子 Agent 生命周期送达完整核心，并在每个用户提示前送达短提醒；这提高规则在模型上下文中的可见性，但不保证每个内部模型请求都会重新注入，也不保证模型绝对遵守。

### 1.4 指令优先级

`AGENTS.md` 与 Hook 的 `additionalContext` 最终都进入模型的 developer-level context；系统/平台规则仍高于 developer，用户请求低于 developer，但更具体、更新且不冲突的同层项目指令会影响执行。Codex 的项目 `AGENTS.md` 又按根到 cwd 叠加，近层内容后置。[OpenAI：AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)；[OpenAI API：message roles](https://developers.openai.com/api/reference/resources/responses)

这套优先级不会自动解决语义冲突。例如“所有任务都必须六边形架构”与“KISS/YAGNI”本身会给模型两个相反方向；必须在规则正文写清哪一条是常驻决策透镜、哪一种只是有信号时采用的具体形态。

## 二、持久工程规则应该如何分层

### 2.1 常驻：每个工程任务都应参与判断的约束

“常驻”应定义为**在理解、设计、实施、验证四个阶段都约束选择**，而不是每次都产生一项代码变化，也不是每次都在回复里签到。推荐常驻：

| 常驻约束 | 可执行含义 | 已满足时的正确结果 |
| --- | --- | --- |
| 项目事实与第一性原则 | 先确认不变量、消费者、状态、失败语义、授权与现有约定，再选模式 | 不猜未来，不套书名 |
| 正确所有者与单一事实源 | 在真实路径的共同所有者修根因；同一业务知识只维护一份 | 不在每个调用点补丁，不建双写状态 |
| SRP、高内聚低耦合、局部性 | 按变化原因和业务决定聚合，边界交换最小必要信息 | 当前边界清楚时保持不变 |
| 知识级 DRY | 合并必须同步变化的同一知识，不合并只长得相似的代码 | 允许独立变化的小重复 |
| KISS / YAGNI / 最小公共面 | 选择当前最少概念、依赖、扩展点和维护路径的完整方案 | 不造无消费者接口、工厂或插件层 |
| 长期单轨 | 最终状态只有一个权威路径；兼容层必须有真实约束、负责人和退出条件 | 所有消费者可同步时 clean cut |
| 外科手术式范围 + Boy Scout | 因果边界内修完整并清掉本次产生的冗余，边界外不扩散 | 不把局部任务扩大成全仓整理 |
| 风险相称验证 | 先定义可观察完成判据；证据覆盖本次正确性、数据、安全和副作用风险 | 简单改动不制造测试仪式，高风险改动不靠口头保证 |

这里的“全部用上”是：每一项都可能约束选择，且冲突时按正确性/安全/契约/项目事实优先；不是要求最终答案逐个点名。

### 2.2 条件化：只有真实信号出现时才加载和实例化

| 方法/模式 | 触发信号 | 不应采用的信号 | 一手来源 |
| --- | --- | --- | --- |
| Clean Architecture / Hexagonal / DIP | 复杂领域规则需脱离 I/O；易变外部边界；多个真实实现；确定性测试需要 seam | 单一实现、简单 CRUD、普通模块已能隔离 | [Robert C. Martin：The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)；[Alistair Cockburn：Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) |
| DDD bounded context / context map | 同一术语在子域含义冲突；跨域翻译与所有权不清 | 通用支撑工具、简单数据录入、只想套目录 | [Eric Evans：DDD Reference](https://www.domainlanguage.com/ddd/reference/) |
| 完整 SOLID / 行为子类型 / contract tests | 真实替换关系、多实现共享行为契约 | 只有一个实现，只为补齐缩写造接口 | [Liskov & Wing：A Behavioral Notion of Subtyping](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf)；[Robert C. Martin：SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) |
| Strangler / Parallel Change / Branch by Abstraction | 外部消费者、数据迁移、持续交付等阻止一次切换 | monorepo 内全部消费者能同批修改 | [Martin Fowler：Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html)；[Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)；[Branch by Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html) |
| Characterization Testing | 遗留行为缺少规范与可信测试，改前需先让差异可见 | 已有稳定公共契约和充分行为测试 | [Michael Feathers：Characterization Testing](https://michaelfeathers.silvrback.com/characterization-testing) |
| Tidy First | 一个小而可逆的结构调整会显著降低当前行为改动风险 | 整理与目标无因果关系，或本身是高成本迁移 | [Kent Beck：Structure and Behavior](https://newsletter.kentbeck.com/p/structure-and-behavior) |
| 组件内聚/耦合原则 | 独立发布、复用、团队边界、依赖成环、发布连锁真实存在 | 仅仅是普通目录分文件 | [Robert C. Martin：Principles and Patterns](https://objectmentor.com/resources/articles/Principles_and_Patterns.pdf) |

模式作者 Martin Fowler 也明确把 pattern 定位为在特定情境解决反复问题的说明，而不是无条件最佳实践；模式必须有“何时用/何时不用”。[Martin Fowler：Writing Software Patterns](https://www.martinfowler.com/articles/writingPatterns.html)

### 2.3 避免 token 噪音和规则漂移

OpenAI 当前模型指南给出非常直接的证据：在内部 coding-agent 样本中，更精简的 system prompts 使评测提高约 10–15%，总 tokens 降低 41–66%、成本降低 33–67%；官方强调这些数字只具方向性，必须在自己的代表性任务上验证，并要求每条指令只写一次、逐组删除后重跑同一评测、关注长会话中重复内容的放大。[OpenAI：Model guidance - Favor leaner prompts](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices)

因此推荐：

- 核心只保留会在多数任务改变决策的行为句，不保留书单、长解释和完整输出模板。
- 每条规则有唯一权威位置；核心不复制 reference，reference 不复制输出模板，全局 `AGENTS.md` 不复制插件全文。
- reference 指针必须同时写“目标文件 + 触发条件 + 不读取条件”，而不是只写路径。Agent Skills 官方最佳实践也强调减少无用选项、让 references 有明确触发、用步骤替代宣言。[Agent Skills：Skill creation best practices](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx)
- 不根据用户 prompt 的几个关键词自动拼接完整 reference。架构信号通常需要先看代码、消费者和契约；prompt-only 路由会误触发，也会让 Hook 处理更多用户内容。模型在完成事实调查后按正文路由更可靠。
- 每次规则变更只解决一个有记录的失败族，并用同一评测前后比较；长期无决策影响、持续误触发或只诱发术语复述的规则应删除/合并。

Anthropic 与 GitHub 的第一方文档也给出相同方向：持久 instructions 应短小、广泛适用、具体且可测试，专门知识按需加载；但这些只能作为跨产品写作经验，不能替代 Codex 的运行时契约。[Anthropic：Claude Code best practices](https://code.claude.com/docs/en/best-practices)；[Anthropic：Memory](https://code.claude.com/docs/en/memory)；[GitHub Copilot：Response customization](https://docs.github.com/en/copilot/concepts/prompting/response-customization)

## 三、当前实现为什么会“看起来偏离初衷”

### 3.1 已经做对的部分

- 核心规则只有一个单一来源，Hook runtime 从同一 `SKILL.md` 读取，而不是维护两份正文。
- 完整核心只在 Session/Subagent 生命周期注入；每轮只注入短提醒；references 按任务读取，整体方向符合渐进披露。
- `SessionStart` 已覆盖 `compact`，并设置 `additionalContextLimit: 6000`；无需额外 PostCompact 来补规则。
- references 已经把工程原则变成触发、反触发、动作、迁移退出与验证边界，而不是只有方法名。
- 现有确定性测试能证明 JSON 输出、脚本输入校验、核心体积、版本标记和损坏缓存处理。

### 3.2 语义与证明上的缺口

1. `## 常驻工程检查`、`每个工程任务都轻量检查` 是“审查语气”；用户要的是“执行契约”。即使正文后续顺序覆盖理解与实施，标题会抢先形成弱框架。
2. 每轮提醒只有“项目约束优先；最小完整、长期连贯且可验证”，没有重申正确所有者、单一事实源、SRP/高内聚低耦合、知识级 DRY/KISS，也没有明确“不得只在结尾检查或复述”。
3. 核心的公开文案部分约占三分之一。用户优先级是“判断 > 透明 > 学习 > 复盘”，当前 token 分配却让透明格式和工程行为接近同等重量。
4. `UserPromptSubmit` 当前故意忽略 prompt 内容并固定返回提醒，这对隐私和稳定性是优点，但它也不会自动加载匹配 reference；“每轮都注入 Skill”不等于“每轮所有方法全文都读过”。
5. 现有 `docs/evals/v0.3.7.md` 已诚实说明六个行为案例没有保存完整 prompt、模型、全部注入指令和原始 response，因而只是探索性观察，不能重放；确定性 Hook 测试只能证明 context 生成，不能证明产物遵守。

## 四、适合 StonePlugins 的架构选项

### 方案 A：常驻契约 + 渐进 references + 行为 evals（推荐）

```text
全局 AGENTS.md
  └─ 个人交互、授权、工具偏好、CodeGraph（短，不复制工程正文）

stonefish-engineering 插件
  ├─ SKILL.md                 常驻工程执行契约 + 路由 + 最小公开说明契约
  ├─ references/
  │  ├─ architecture.md      架构、安全、外部副作用
  │  ├─ change-boundaries.md 范围、依赖、迁移、破坏性重构
  │  ├─ verification.md      诊断、测试、交付证据
  │  ├─ methodology-index.md 维护索引、冲突、晋升门槛
  │  └─ decision-disclosure.md（可选）详细 Markdown 示例
  ├─ hooks/
  │  └─ inject-context.js    只负责确定性送达，不做架构判断
  └─ evals/
     ├─ delivery            Hook/信任/事件/体积
     └─ behavior            中性任务 A/B、产物 rubric、回归 corpus
```

**优点**：单一事实源、上下文小、职责清楚；规则能分发；模式按事实加载；最容易做 A/B 行为评测。

**代价**：不能获得“绝对遵守”；reference 是否读取仍由模型判断；需要投资一套真实行为 eval harness。

### 方案 B：把全部方法论都塞进每轮 Hook

**优点**：每轮上下文可见性最高，排障直观。

**风险**：token 与注意力噪音大；方法冲突增多；长会话反复放大；模型更容易做术语签到或过度架构。它违背 OpenAI 精简 prompt 与 Skills 渐进披露建议，不推荐。

### 方案 C：拆成很多独立公共 Skills，由 prompt 关键字或 Hook 自动选择

**优点**：每个 Skill 单一职责，用户可显式调用某一方法。

**风险**：用户原意是无需每次选择；很多 Skill 的 name/description 仍占初始列表预算；prompt 关键字不能可靠判断代码结构；方法之间的优先级和组合又需要一个总协调器，形成路由复杂度。可为真正独立的专业工作流保留单独 Skill，不适合作为这份常驻工程规则的主架构。

### 方案 D：SQLite/向量索引动态检索方法论

**优点**：未来若积累数百个大型领域案例，可按标签或语义检索。

**风险**：当前只有四个小 reference，数据库会引入 schema、迁移、索引质量、运行时依赖和不可见检索错误；并不能解决“规则是否改变决策”的核心问题。现阶段应维持 Markdown 索引，等实际 corpus 和检索评测证明静态路由成为瓶颈再升级。

## 五、推荐的下一版语义与输出契约

### 5.1 把“检查”改为“贯穿执行”

核心首段应明确：

> 对每个工程任务，以下原则必须贯穿理解、方案、实现与验证；它们是选择方案的约束，不是结尾审查清单，也不是要求在回复中逐项复述。原则已由现有结构满足时，正确行为是保持不变。

逐轮短提醒建议保留在约 150–250 个汉字内，并覆盖真正的决策循环，例如：

> 本轮工程任务把石头鱼的工程规则作为执行约束：先确认不变量、真实消费者和正确所有者；以 SRP、高内聚低耦合、知识级 DRY 校准边界；以 KISS/YAGNI 选择最小完整、长期单轨的方案；必要且经授权时允许破坏性重构；按风险验证。不得只在结尾检查或复述术语。

这不是最终文案结论，仍应通过 token 统计和 A/B eval 比较当前短提醒、这一版和更短版本。

### 5.2 输出说明服务“判断”，不成为表演

用户需要输出的真实目的已经很清楚：看见**哪项方法改变了哪个决定、带来什么影响和代价**，从而能判断、学习和复盘。因此：

- 结果/推荐始终先出现。
- 方法论说明紧跟它所解释的关键决定；不要统一堆在全文最末，也不要抢在结果前。
- 只展示真正改变所有者、边界、契约、迁移或验证的 1 个或多个方法；常驻但没有改变本次决策的方法不签到。
- 最小字段是：`具体决定 → 触发事实 → 方法如何改变决定 → 影响/代价`；已经实施时才补实际验证。
- 简单任务可单行；普通任务用 2–4 个 bullet；只有多个独立决定共享字段时才用表格。

可供用户选择的标题：

1. `## 🧭 为什么这样做（石头鱼的工程规则）`：最通俗，学习成本最低；分类精度放到条目内部。
2. `## 🧭 本次工程取舍（石头鱼的工程规则）`：更准确地表达收益与代价，适合方案/架构讨论。
3. `## 🧭 本次决策与方法论（石头鱼的工程规则）`：当前标题最正式，但“方法论”容易把注意力引向名称而不是决定。

研究推荐 1 或 2；最终应由后续访谈确认用户更偏“通俗学习”还是“正式决策记录”。

## 六、怎样证明规则真的改变设计与实现

OpenAI 明确指出生成式 AI 有变量性，传统单次测试不足；应采用 eval-driven development、真实任务分布、完整日志、自动评分与人类校准，并持续运行。LLM judge 更适合 pairwise、分类或具体 rubric 评分，而不是开放式“感觉哪个好”；数据集要包含 typical、edge、adversarial 以及长上下文、多工具、多 Agent 情况。[OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

### 6.1 两套测试必须分开

**A. 送达/运行时确定性测试**证明“规则有没有进入上下文”：

- 三个事件的 wire input/output、版本、完整核心与短提醒；
- startup/resume/clear/compact、SubagentStart、每轮 UserPromptSubmit；
- `additionalContextLimit`、超时、损坏缓存、路径含空格、无机密输出；
- 信任前被跳过、信任后运行、Hook 哈希变化后重新待审；
- 与另一个 SessionStart Hook 同时存在时不假设顺序；
- 发布缓存、新任务、真实自动 compact 的手工矩阵。

**B. 行为评测**证明“规则是否改变决定和产物”：

- 使用完全相同的中性任务，固定模型、reasoning effort、cwd、工具权限和项目快照；
- 比较无插件 vs 当前版，或旧版 vs 候选版；每组多次运行，避免把一次随机输出当结论；
- 保存完整用户 prompt、system/developer/AGENTS/Hook 上下文摘要、模型版本、工具轨迹、diff、测试结果与最终回复；
- grader 先看代码/方案，不看有没有写出 `KISS`、`SRP` 等名称；
- 优先可执行 grader，主观架构项再做盲化 pairwise + 人类校准。

### 6.2 建议的产物 rubric

| 维度 | 可评分行为 | 反例/灾难性失败 |
| --- | --- | --- |
| 正确所有者 | 共同路径修一次，覆盖全部真实消费者 | 在三个调用点复制补丁 |
| 单一事实源 | 业务规则或状态只有一个权威写入点 | 建立永久双写/双向同步 |
| 边界质量 | 变化集中、接口隐藏复杂度、无循环依赖 | 新层只透传、调用方理解内部顺序 |
| KISS/YAGNI | 没有无消费者工厂、port、配置和依赖 | 为单实现生成完整架构模板 |
| 长期单轨 | clean cut 或有明确迁移退出证据 | 永久 legacy flag / compatibility shim |
| 因果范围 | 完成必要连带改动，不混入无关整理 | 为局部 bug 重写整个目录 |
| 验证 | 有修复前失败/修复后通过或风险对应证据 | 弱化断言、跳过失败、只说“应该可以” |
| 安全/数据 | 信任边界验证、最小权限、失败语义明确 | 吞错、泄密、非幂等副作用盲重试 |

公开“方法论说明”另设较低权重：只检查它是否把真实事实、具体决定、方法作用和影响连起来；没有区块不代表行为失败，出现一串方法名也不得加分。

### 6.3 最小回归 corpus

至少保留以下固定任务族，每族有正例与“不要过度使用”反例：

1. 同一 bug 有三个入口，共同所有者在上游。
2. 两段相似代码但变化原因独立，防止机械 DRY。
3. 单实现简单 CRUD，防止滥用六边形/DIP。
4. 复杂领域 + 易变支付 provider，验证端口与 contract tests。
5. monorepo 全消费者可同批修改，验证 clean cut。
6. 外部客户端不可同步升级，验证受控 Parallel Change 与退出条件。
7. 失败测试诱导模型删断言，验证测试信号保护。
8. 认证/权限/付费副作用，验证信任边界、幂等与失败安全。
9. 长对话自动 compact 后继续实现，验证核心送达和行为保持。
10. 隔离子 Agent 只收到 Hook 核心，验证不依赖父对话偶然上下文。

### 6.4 CI 门禁建议

- PR 必跑 Hook unit/integration、manifest/Skill validator、体积预算。
- 行为 suite 先做 nightly 或发布候选，多次采样；成熟后把“灾难性失败数必须为 0、关键 rubric 不低于基线、token/延迟不超过预算”作为发布门禁。
- 每次只改一个规则组并与同一 baseline 比较；若同时改核心与 grader，保留旧 grader 复算，防止移动球门。
- 把真实用户发现的偏离加入 corpus。方法论晋升核心前必须先有一个失败案例和一个防过度应用反例。

## 七、对全局 `AGENTS.md` 的建议

现有全局文件无需再次放入最佳实践全文。建议只保留：

- 交流和表达偏好；
- 事实/不确定性/官方资料边界；
- 授权、破坏性动作和用户改动保护；
- 项目惯例、工具链和验证交付；
- 一条极短的插件送达诊断规则（可选）：工程任务若没有看到 `STONEFISH ENGINEERING ACTIVE`，不要声称插件已生效，而是报告 Hook/信任状态待核对；
- 最后的原样 CodeGraph 区块。

不建议：

- 在 `AGENTS.md` 再复制常驻工程原则——会产生两个权威源和版本漂移；
- 只用相对链接假定 Codex 自动 include——官方没有该机制；
- 写“必须调用 `$stonefish-engineering`”——用户已经选择依靠 Hook 常驻，强制 Skill 调用会重复读核心；
- 用 Stop Hook 强迫每次输出方法论段落——它只能提高文案合规，不能证明代码质量，还可能造成重复续写。

## 八、未证实边界与下一步验证

### 已由官方资料或本地静态检查确认

- `SessionStart` 的 `compact` 会在根会话压缩后、下一模型请求前补入 context；不需要额外 PostCompact 才能续注入。
- `UserPromptSubmit` matcher 当前无效；当前固定提醒不会按 prompt 自动路由。
- 插件 Hook 必须信任当前定义哈希，且可以被功能开关禁用。
- Skills 是渐进披露；初始列表不是完整正文。
- 当前核心 65 行/5,562 bytes，公开决策文案 17 行/1,889 bytes。
- 当前 v0.3.7 行为观察不可完整重放，确定性测试不证明模型遵守。

### 仍需真实客户端或可重放 harness 验证

- 当前这台机器升级后的插件缓存、启用状态与三个 Hook 的真实信任状态。
- 自动 compact、resume、clear 在桌面客户端的端到端事件日志，而不只是官方契约与脚本单测。
- 完整核心和逐轮提醒在不同模型、reasoning effort、长上下文和多 Agent 下的实际 token、延迟与行为收益。
- “执行契约”新措辞相对当前“轻量检查”是否显著提高产物 rubric，而不是只增加复述。
- 输出区块的新位置/标题是否真正提升用户判断和学习，而不干扰结果阅读。

## 一手来源索引

### OpenAI / Codex

- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Codex `agents_md.rs`](https://github.com/openai/codex/blob/main/codex-rs/core/src/agents_md.rs)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Hooks](https://learn.chatgpt.com/docs/hooks)
- [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [Model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [OpenAI Model Spec](https://model-spec.openai.com/)
- [Agent Skills specification best practices](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx)

### 其他 Agent 指令的一方资料（只作写作与评测参照）

- [Anthropic Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- [Anthropic Claude Code memory](https://code.claude.com/docs/en/memory)
- [GitHub Copilot response customization](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
- [Matt Pocock：writing-for-agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md)

### 工程方法作者

- [Alistair Cockburn：Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Robert C. Martin：The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Robert C. Martin：SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html)
- [Robert C. Martin：Principles and Patterns](https://objectmentor.com/resources/articles/Principles_and_Patterns.pdf)
- [Liskov & Wing：A Behavioral Notion of Subtyping](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf)
- [Eric Evans：Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [Martin Fowler：Writing Software Patterns](https://www.martinfowler.com/articles/writingPatterns.html)
- [Martin Fowler：Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html)
- [Martin Fowler：Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)
- [Martin Fowler：Branch by Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html)
- [Michael Feathers：Characterization Testing](https://michaelfeathers.silvrback.com/characterization-testing)
- [Kent Beck：Structure and Behavior](https://newsletter.kentbeck.com/p/structure-and-behavior)
