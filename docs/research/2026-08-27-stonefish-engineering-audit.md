# 石头鱼的工程规则审计：Codex Hooks 与工程约束

状态：历史研究快照，原位归档。下文的“当前实现”、技术结论和建议仅对应研究时点，不作为现行运行规范或活动待办。现行文档见[文档索引](../README.md)；后续目标与执行边界见 [ADR-0004](../adr/0004-codex-first-bundled-engineering.md) 和[重构计划](../plans/2026-09-14-codex-first-refactor.md)，不代表已实现或验收。

> 日期：2026-08-27
> 范围：Codex Hooks 生命周期、当前插件注入行为，以及可纳入工程代理规则的约束。
> 方法：以 OpenAI、OWASP、Google、Microsoft、GitHub、W3C、IETF 等一手资料为依据，并对当前仓库做只读静态核对。本文中的“事实”指官方契约或本地可重复观察；“建议”是基于这些事实作出的工程取舍，不冒充官方要求。
> 快照基线：本文首次记录于 `v0.3.2`（`b1a9bc8`），其中体积和“当前状态”只代表当时快照。现行核心 Skill、references、测试和版本化评测入口见[文档索引](../README.md)。

## 结论摘要

1. **压缩后的规则注入没有发现事件缺口。** OpenAI 当前 Hooks 文档明确：根会话完成压缩后，会在下一次模型请求前触发 `SessionStart`，且 `source` 为 `compact`；自动压缩若发生在一轮中间，注入上下文会进入紧接着的续写请求。当前插件的 `SessionStart` matcher 已包含 `compact`。仅为了“压缩后重新注入”再注册 `PostCompact`，会制造重复上下文，而不是补洞。
2. **`PreCompact`/`PostCompact` 是独立事件，但并不等于它们适合重新注入规则。** 当前官方文档为两者列出了通用控制输出，没有像 `SessionStart`、`SubagentStart`、`UserPromptSubmit` 那样明确承诺 `hookSpecificOutput.additionalContext`。不能把“事件存在”推导成“可以稳定注入模型上下文”。
3. **`SubagentStart` 当前注入的是同一份完整核心 Skill 正文，不是专门缩写版；references 不会展开。** 本地实测为 3,937 UTF-8 字节、1,833 个 Unicode code point、45 行，低于仓库测试的 6,000-byte 上限。它是否值得进一步缩短，应通过代表性子 Agent 任务对照评测决定，不能只凭字节数判断。
4. **`UserPromptSubmit` 当前不是轮询，也不做内容匹配。** 每轮固定注入同一条 135-byte 短提醒，不读取或回显 prompt，因此不会出现随机插入 Bun 偏好的情况；代价是非工程类提示也会收到同一句提醒。当前固定、无状态方案比关键词启发式更可靠，除非实际噪音数据证明需要调整。
5. **多个同事件命令 Hook 不应依赖先后顺序。** 官方说明所有匹配 Hook 都会运行，同一事件的多个命令 Hook 可并发启动，一个 Hook 不能阻止另一个开始；完成顺序不能作为协议。当前插件每次注入都自包含，这个方向正确。
6. 用户提出的测试完整性、安全、错误处理、跨模块收尾、卡壳熔断、自审、文档同步和判断更新都具有实用价值；其中大部分已在当前规则快照中落实。需要保留三处限定：**不要把“任意 sleep/skip 都禁止”写成绝对规则；不要要求每个任务外问题都落一个 TODO；不要要求每层 catch 都同时记录再抛出。**
7. 规则体系应维持“小核心 + 按任务读取 references + 可重复评测”，而不是继续把所有好原则堆进核心注入。OpenAI 当前模型指导也建议去重、一次删除一组指令并用同一组评测验证。

---

## A. Codex Hooks 事实核对

### A1. `SessionStart(source="compact")` 是否覆盖压缩后注入

**官方事实**

- `SessionStart` 的 `source` 取值包括 `startup`、`resume`、`clear` 和 `compact`。
- 根会话压缩完成后，匹配 `compact` 的 `SessionStart` Hook 会在下一次模型请求前运行。
- 自动压缩发生在一轮中间时，Hook 产生的上下文会进入紧接着的模型续写请求。
- `SessionStart` 的纯文本 stdout，或 JSON 中的 `hookSpecificOutput.additionalContext`，可作为额外 developer context 注入。

来源：[OpenAI Hooks：SessionStart 与 matcher](https://learn.chatgpt.com/docs/hooks)

**本地事实**

- `hooks/hooks.json` 的 `SessionStart` matcher 当前为 `startup|resume|clear|compact`。
- 测试以 `source: "compact"` 执行生成后的 Hook，并断言核心规则存在、正文不展开 references、体积不超过 6,000 bytes。

**建议**

- 保持当前 `SessionStart` 设计；**不要仅为规则续注而增加 `PostCompact`**。
- 保留两层证据：仓库内契约测试验证 matcher 和输出；每个发布候选在真实 Codex 客户端做一次 manual compact 和一次足够长会话的 auto compact 冒烟测试。
- 仓库测试只能证明“给定 compact 输入时脚本输出正确”，不能单独证明具体客户端版本、Hook 信任状态和自动压缩调度均正常；文档应继续把这层称为“待真实运行验证”。

### A2. `PreCompact` / `PostCompact` 是否应承担上下文注入

**官方事实**

- `PreCompact` 在压缩前、`PostCompact` 在压缩后运行，matcher 可区分 `manual` 与 `auto`。
- 当前官方事件章节说明两者的纯文本 stdout 会被忽略，并列出通用控制输出，如 `continue`、`stopReason`、`systemMessage`、`suppressOutput`。
- 同一份文档在 `SessionStart`、`SubagentStart` 和 `UserPromptSubmit` 章节中明确说明 `additionalContext` 的模型注入语义，但没有为 `PreCompact`/`PostCompact` 作出同样承诺。

来源：[OpenAI Hooks：PreCompact 与 PostCompact](https://learn.chatgpt.com/docs/hooks)

**结论**

- “`PreCompact`/`PostCompact` 是独立事件”是事实。
- “它们当前都稳定支持 `additionalContext`”**不是现有官方文档可以确认的事实**。在没有更明确契约或运行证据前，不应依赖这一推断。

**建议**

- `PreCompact` 只用于确实需要在压缩前完成的工作；`PostCompact` 只用于确实需要获知压缩已完成的工作。
- 规则恢复继续依赖文档明确支持的 `SessionStart(source="compact")`。
- 若未来官方补充 `PostCompact.additionalContext` 契约，也先评估是否与 `SessionStart` 重复，再决定迁移或二选一，不同时注入同一正文。

### A3. `SubagentStart` 的 `additionalContext` 与当前注入体积

**官方事实**

- `SubagentStart` 输入包含 `agent_id`、`agent_type`、`permission_mode` 等字段。
- 纯文本 stdout 或 `hookSpecificOutput.additionalContext` 会成为该子 Agent 的额外 developer context。
- Hook 不能依靠 `continue: false` 阻止子 Agent 启动；该字段会被解析，但启动继续进行。
- OpenAI 文档提醒：多个 Hook 的上下文会累积；模型可见输出过大时会被截断或落盘并只给预览，默认阈值约 2,500 tokens，可通过 `additionalContextLimit` 调整。

来源：[OpenAI Hooks：SubagentStart 与大输出处理](https://learn.chatgpt.com/docs/hooks)

**本地事实**

- 当前 `SessionStart` 与 `SubagentStart` 都读取并注入 `SKILL.md` 去除 frontmatter 后的完整核心正文。
- references 只以相对路径和读取条件出现在正文中，不会随 Hook 自动展开。
- 本次静态运行测得 `SubagentStart` 上下文为 **3,937 UTF-8 bytes、1,833 code points、45 行**；这是当前工作树快照，不等同于稳定 API 指标，也不等同于 tokenizer token 数。
- 当前仓库测试把 6,000 UTF-8 bytes 作为自定体积上限；这是一条本地回归护栏，不是 OpenAI 官方阈值。

**建议**

- 现状可接受，但 README 中应准确称为“同一核心正文，不展开 references”，不要称作“精简核心”，除非以后真的维护单独版本。
- 不应仅凭“每个子 Agent 都重复注入”就立即拆出第二份规则，因为双份正文会带来语义漂移风险。
- 若子 Agent 使用量较大，做 A/B 评测再决定：同一批真实任务分别使用完整核心和候选短核心，记录任务成功率、规则违例数、澄清次数、工具调用数、输入 token、延迟和返工。只有质量不下降且成本收益稳定时再缩短。
- 若拆分，短核心至少保留：项目规则优先、正确所有者与根因、因果范围、权限边界、证据式完成声明，以及按任务读取 references 的路由。不要让短核心退化成只有口号。

### A4. `UserPromptSubmit` 的选择逻辑与噪音

**官方事实**

- `UserPromptSubmit` 在用户提交提示时运行；输入包含 `prompt`。
- 该事件不支持 matcher 过滤，配置中的 matcher 会被忽略。
- 纯文本 stdout 或 `hookSpecificOutput.additionalContext` 可作为额外 developer context；Hook 也可以用事件支持的阻断结果拒绝本轮提交。

来源：[OpenAI Hooks：UserPromptSubmit](https://learn.chatgpt.com/docs/hooks)

**本地事实**

- 当前脚本只验证 `prompt` 是字符串，不按内容分类、不轮询、不保留状态，也不把 prompt 写入输出。
- 每轮返回完全相同的一行提醒；本次实测为 **135 UTF-8 bytes、45 个 Unicode code points**。
- 因而不会在架构讨论中“轮到”一条 Bun 提醒；但翻译、纯文案等非工程请求也会收到同一工程提醒。

**建议**

- 保持固定、短、无状态、无 prompt 回显，是更容易审计的默认方案。
- 不建议为了“智能”而做脆弱的关键词匹配：同义表达、多语言和复合请求都会使假阴性/假阳性难以控制，而且 matcher 本身不能承担内容过滤。
- 如果真实任务记录显示噪音明显，优先把提醒改得更中性或进一步缩短；其次才考虑一个显式、可测试、默认保守的分类器，并把误判率纳入评测。
- 对 prompt 内容的任何日志、遥测或外部分类都属于新的隐私边界，需要另行设计和授权；当前插件没有必要引入。

### A5. 多个 Hook 同时命中时的顺序

**官方事实**

- 来自多个配置来源的所有匹配 Hook 都会运行。
- 同一事件的多个匹配命令 Hook 可以并发启动；一个 Hook 不能阻止另一个 Hook 开始。
- 因并发而产生的完成顺序不应被当作稳定协议。

来源：[OpenAI Hooks：Hook 合并与并发](https://learn.chatgpt.com/docs/hooks)

**建议**

- 每个注入块保持自包含，不用“上一 Hook 已定义术语”或“后一 Hook 会覆盖冲突”的假设。
- 若同一项目安装多个规则型插件，避免依赖顺序解决冲突；把真正冲突的规则在项目级 `AGENTS.md` 或一个明确所有者中统一。
- 发布冒烟测试应包含至少一个第二 Hook，以验证并发时输出均可解析、无共享临时文件或可变全局状态竞争；不需要断言具体顺序。

---

## B. 候选工程规则逐条评估

| 候选项 | 一手依据结论 | 建议处置 | 当前快照 |
| --- | --- | --- | --- |
| 测试完整性 | 高价值；AI 可能通过删测试、弱化断言、错误 mock 等方式让 CI 变绿 | 加入，但允许在契约改变或测试确实错误时有证据地修改 | 已落实 |
| flaky 根因 | 高价值；共享状态、竞态、时序、外部依赖会破坏测试信号 | 加入；固定 sleep/盲目重试不是根治，临时隔离需退出条件 | 已落实 |
| 安全基线 | 高价值；需要按 SQL、shell、HTML 等具体 sink 使用正确防御 | 加入，避免笼统“统一转义” | 已落实且措辞较准确 |
| 错误处理 | 高价值；空 catch 和静默默认值会隐藏故障 | 加入；由正确边界处理、转译或传播，不要求层层 log + rethrow | 已落实 |
| 跨模块收尾 | 高价值；语义引用、动态引用、契约与行为验证互补 | 加入，搜索旧形状并审计消费者 | 已落实 |
| 所有任务外问题写 TODO | 证据不支持一刀切；会制造无主债务并擅自修改范围外代码 | 不按原句加入；默认交付报告，有持久载体和授权才记录 | 已以更稳健形式落实 |
| 卡壳熔断 | 高价值；系统化排障要求可证伪假设和不重复无信息尝试 | 加入；“两次无新证据”作为启发式，不是假装普适定律 | 已落实 |
| 交付前自审 | 高价值；应审全部改动文件、临时代码、测试和配置 | 加入 | 已落实 |
| 文档同步 | 高价值；行为、构建、测试、发布方式改变时应更新权威文档 | 加入；所有权不明时报告而非猜测 | 已落实 |
| 用户反驳后的判断更新 | 高价值；技术事实胜过偏好，有新证据就更新，无新证据可保留意见 | 加入；安全、合法、权限边界仍是硬限制 | 已落实于核心 |

### B1. 测试完整性与 flaky 测试

**一手事实**

- OWASP 的 AI 安全编码指南专门列出：代理可能通过删除测试、弱化断言、错误地 mock 被测单元，或把断言改成当前错误行为来让 CI 通过；因此应审查删除的测试、弱化的断言、mock 变化和越界修改。来源：[OWASP Secure Coding with AI Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Coding_with_AI_Cheat_Sheet.html)
- Google 的代码审查指南要求测试正确、有用，并在代码损坏时能够失败；断言应覆盖实际行为而非制造假阳性。来源：[Google Engineering Practices：What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
- Google 对 flaky 的经验说明，竞态、未初始化状态、服务依赖、调度和测试顺序都可能是根因；忽略 flaky 会降低整套测试的可信度，也可能掩盖生产环境的非确定性。来源：[Where do our flaky tests come from?](https://testing.googleblog.com/2017/04/where-do-our-flaky-tests-come-from.html)、[Test flakiness: one of the main challenges](https://testing.googleblog.com/2020/12/test-flakiness-one-of-main-challenges.html)
- 固定时长 `sleep` 并不是同步机制；pytest 官方也把不受控状态和隔离不足列为常见 flaky 根因。来源：[Google Testing Blog：Sleeping is not synchronization](https://testing.googleblog.com/2008/08/tott-sleeping-synchronization.html)、[pytest：Flaky tests](https://docs.pytest.org/en/stable/explanation/flaky.html)
- pytest 的 skip 机制本身是合法工具，适用于在特定平台、版本或条件下无法成功的测试，并应提供原因。因此“任何 skip 都违规”并不成立。来源：[pytest：How to use skip and xfail](https://docs.pytest.org/en/7.1.x/how-to/skipping.html)

**推荐规则语义**

> 失败测试是需要解释的证据，不是需要消除的障碍。不得仅为变绿而弱化或删除断言、跳过用例、错误 mock 被测行为，或把断言改成现有缺陷。只有已确认契约改变或测试本身错误时才修改，并保留等价行为覆盖。flaky 先调查竞态、共享状态、随机性、时间与外部依赖；固定 sleep 或盲目重试不能替代根因修复。临时 quarantine/skip 必须写明原因、跟踪载体和退出条件。

当前 `references/verification.md` 已基本达到这个语义，无需重复添加第二份表述。

### B2. 安全基线

**一手事实**

- OWASP 建议集中管理凭据生命周期、执行最小权限，并明确禁止在日志中保存明文密码、访问 token、数据库连接串、加密密钥等。来源：[OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)、[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- 输入验证应在信任边界尽早覆盖语法与业务语义，但它不能替代具体 sink 的防御。SQL 应使用参数化查询；OS 命令优先使用不经过 shell 的库/API，确实需要命令时再组合结构化参数与 allowlist；HTML/属性/JavaScript/URL 等输出要按上下文编码。来源：[OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)、[SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)、[OS Command Injection Defense](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)、[Cross Site Scripting Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- 授权应默认拒绝、最小权限，并在每个请求的可信服务端边界验证；客户端隐藏不构成授权。来源：[OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- 对外错误应避免暴露堆栈、SQL、内部路径和实现细节，诊断细节应留在受控的服务端记录中。来源：[OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)

**建议**

- 用户原建议总体正确，但“用户输入进入 SQL、shell、模板前统一校验/转义”应改成**按解释器和 sink 选择结构化 API、参数化或上下文编码**。泛化的 `escape()` 容易形成虚假安全感。
- “环境变量或密钥管理”也不应暗示环境变量天然安全；规则应优先遵循项目既有密钥设施，并约束范围、生命周期、日志和错误输出。
- 当前 `architecture.md` 已采用上述 sink-specific 表述，比原始建议更适合长期规则。

### B3. 错误处理规范

**一手事实**

- Microsoft 建议只捕获调用方能够恢复、转译或清理的异常；无法恢复时让异常传播，并在重新抛出时保留原始调用信息。来源：[Microsoft .NET：Best practices for exceptions](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions)、[C# exception handling](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/exceptions/exception-handling)
- SEI CERT 的 ERR00-J 明确反对压制或忽略 checked exception，因为这会丢失错误状态。来源：[SEI CERT ERR00-J](https://wiki.sei.cmu.edu/confluence/spaces/flyingpdf/pdfpageexport.action?pageId=88487876)

**建议**

- 保留“不空 catch、不把未知失败静默变成正常默认值、区分预期与非预期错误”。
- 不写成“捕获后必须记录并重新抛出”。同一异常在每层 log + rethrow 会产生重复告警；正确做法是在拥有恢复、边界转译、补充责任上下文或清理职责的层捕获，保留 cause；其余层直接传播。
- 允许有意忽略真正安全且无业务影响的失败，但代码需要让理由可审查。

当前 `verification.md` 已体现这些限定。

### B4. 跨文件、跨模块改动的一致性收尾

**一手事实**

- Visual Studio、VS Code 和 GitHub 都把符号引用查找、跨文件 rename 作为识别和迁移调用点的语义工具；这比只做字符串替换更可靠。来源：[Visual Studio Rename refactoring](https://learn.microsoft.com/en-gb/visualstudio/ide/reference/rename?view=vs-2022)、[VS Code Editing Evolved](https://code.visualstudio.com/docs/editing/editingevolved)、[GitHub Navigating code](https://docs.github.com/en/repositories/working-with-files/using-files/navigating-code-on-github)
- TypeScript project references 通过项目间依赖和 `tsc --build` 提供跨项目类型检查边界，但仍不能发现所有运行时字符串、配置或外部消费者。来源：[TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

**建议**

- 完成重命名、接口签名或调用协议迁移后，组合使用：语义 find-references/refactor、旧符号与旧形状文本搜索、项目级类型/构建/测试、已知消费者审计。
- 不把“搜索无结果”当作全部证明；动态导入、序列化字段、配置、脚本、文档和外部消费者可能不在静态符号图中。
- 对保留的旧字符串逐条分类；迁移说明、历史 fixture 或兼容测试可能合理存在，不应追求机械归零。

当前 `change-boundaries.md` 已明确“搜索用于发现遗漏，不能代替公共契约和行为验证”。

### B5. TODO 与任务外技术债

**一手事实**

- Google C++ 风格指南把 TODO 用于临时、短期或“目前足够好”的代码，并要求给出可追踪的人、bug 或后续事件，而不是留下模糊愿望。来源：[Google C++ Style Guide：TODO Comments](https://google.github.io/styleguide/cppguide#TODO_Comments)
- Google 代码审查指南建议：若当前改动暴露了无法在本次解决的周边问题，应建立 bug 并明确责任；TODO 可以引用 bug，但不是每个观察都必须修改代码。来源：[Google Engineering Practices：Pushback in code reviews](https://google.github.io/eng-practices/review/reviewer/pushback.html)
- GitHub Issues 是用于跟踪想法、任务和 bug 的持久工作载体。来源：[GitHub：Planning and tracking work](https://docs.github.com/en/get-started/start-your-journey/planning-your-work)

**建议**

- **不采用**“任务外问题必须在对应代码位置留 TODO”。它会未经授权修改范围外文件、制造无负责人债务，并可能把已经过期的聊天判断永久写进代码。
- 默认在交付中报告；项目已有 issue/债务系统且用户授权时，写入持久载体。只有代码局部确实需要警告未来维护者，或本次改动主动留下已知限制时，才按项目惯例留下 TODO，并包含引用、负责人/所有权和退出条件。
- 当前 `change-boundaries.md` 的处理比原始建议更稳健，应保留。

### B6. 卡壳熔断机制

**一手事实**

- Google SRE 的系统化排障方法强调：提出可证伪假设、优先验证最能区分原因的证据、一次控制一个变量、记录负结果并避免重复已经无效的尝试。来源：[Google SRE：Effective Troubleshooting](https://sre.google/sre-book/effective-troubleshooting/)

**建议**

- “同一思路失败 2–3 次就停”是有用启发式，但不是外部规范证明的通用常数。
- 更可操作的写法是：**同一路径连续两次只产生同类失败且没有新证据时停止微调**，总结已尝试内容、观察、被否定假设、剩余方向，并选择下一项最有区分度的检查；若缺信息或权限，明确阻塞点。
- 当前 `verification.md` 已使用这一版本，既能熔断原地打转，也不会阻止有新证据的连续实验。

### B7. 交付前自审

**一手事实**

- Google 代码审查要求同时审设计、功能、复杂度、测试、命名、注释、风格、文档、每一行改动以及系统上下文。来源：[Google Engineering Practices：What to look for](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
- OWASP 的 AI 安全编码指南要求查看实际变更文件，而不是只信代理生成的 PR 摘要，并特别关注测试、lockfile、CI 和任务范围外变更。来源：[OWASP Secure Coding with AI Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Coding_with_AI_Cheat_Sheet.html)

**建议**

- 交付前把最终 diff 当成别人的 PR 审查：调试输出、注释掉的旧代码、临时配置、未使用 import/依赖、无消费者分支、弱化测试、意外 lockfile/CI 变化、文档影响和用户已有修改都应检查。
- 自审不替代自动验证；自动验证也不替代需求轴审查。当前 `verification.md` 的“双轴审查 + 交付前检查”结构合理。

### B8. 文档同步

**一手事实**

- Google 代码审查指南明确要求：改变构建、测试、交互或发布方式时更新相应 README/文档；删除或弃用代码时也要检查关联文档。来源：[Google Engineering Practices：Documentation](https://google.github.io/eng-practices/review/reviewer/looking-for.html)

**建议**

- 修改行为时，先识别描述该行为的权威文档，而不是机械更新所有相似文件。
- 文档在授权范围内且所有权清晰时同步；所有权不明、需要产品决策或更新范围越权时，明确列为待确认项，不静默猜测，也不谎称已同步。
- 当前核心完成条件和 `change-boundaries.md` 已覆盖。

### B9. 用户反驳后的专业判断更新

**一手事实**

- Google 对 code review pushback 的建议是先认真判断对方是否正确；离代码更近的人可能掌握新信息，若事实支持就明确承认并更新判断，否则用技术依据解释。来源：[Google Engineering Practices：Pushback](https://google.github.io/eng-practices/review/reviewer/pushback.html)
- 处理 review comments 应先理解问题，再讨论方案的优缺点和取舍。来源：[Google Engineering Practices：Handling comments](https://google.github.io/eng-practices/review/developer/handling-comments.html)
- Google 的 review 标准强调技术事实与数据优先于个人偏好；当多个方案都有效时，作者偏好可以决定。来源：[Google Engineering Practices：The standard of code review](https://google.github.io/eng-practices/review/reviewer/standard.html)

**建议**

- 用户给出新约束、证据或经验观察时，重新评估并说明改变了哪一部分；这不是“自动顺从”，而是基于新增信息更新模型。
- 只有重复要求而没有新依据时，可以保持已说明的专业意见。若事项属于用户决策权且安全、合法、在授权范围内，按最终决定执行，并明确“保留意见后执行”。
- 安全、合法性、权限和不可恢复风险不是偏好冲突，不能因为用户坚持就静默越过。
- 当前核心 `SKILL.md` 已基本采用这一元规则，位置正确：它影响所有任务，不应藏在某个 reference 中。

---

## C. 还值得吸收的工程实践

这些不是要求全部塞进核心。应按适用场景放入 reference，并以真实项目风险决定是否激活。

### C1. 用户界面的可访问性基线

**事实**：W3C 建议使用语义化结构、为控件提供标签、保证键盘可操作，并按图片用途提供替代文本；装饰图片与承载信息或功能的图片处理不同。来源：[W3C Developing for Web Accessibility](https://www.w3.org/WAI/tips/developing/)、[W3C Images Tutorial](https://www.w3.org/WAI/tutorials/images/)

**建议**：不必只限“公开产品”。真实用户使用的内部后台同样需要最低基线。对 UI 改动按风险检查原生语义/控件、accessible name、键盘路径、可见焦点、信息不只依赖颜色，以及图片 alt 的用途。当前 `verification.md` 已有简洁的操作性检查，足够作为基线；更细规则可交给专用可访问性 Skill。

### C2. 外部调用的超时、取消、重试与幂等

**事实**：Google SRE 建议有限重试、指数退避与 jitter、retry budget，并避免在多层同时重试导致负载放大；应区分永久与暂时错误。HTTP 语义只允许在幂等或客户端确定可安全重放时自动重试。来源：[Google SRE：Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)、[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

**建议**：涉及网络、队列、支付、模型调用或其他外部副作用时，要求有限 timeout、正确传播 cancellation、仅对可恢复失败做有界重试，并证明副作用可重放；非幂等操作使用 idempotency key、去重、状态机或恢复流程。当前 `architecture.md` 已落实核心部分，可视项目再补 backoff/jitter 和 retry budget，而不要求每个内部函数都实现。

### C3. 模型/API 调用成本与质量共同评估

**事实**：OpenAI 当前模型迁移指导建议删除重复或互相冲突的提示，一次移除一组指令并用同一组 eval 重跑；其公开案例中的 token 和成本改善是方向性示例，不是对所有系统的保证。来源：[OpenAI：Latest model guide](https://developers.openai.com/api/docs/guides/latest-model)

**建议**：修改会触发 LLM/API 调用的路径时，说明调用次数、输入规模、cache、并发、重试、延迟和成本的变化，并同时验证质量。不要只用 token 下降宣称优化，也不要把官方案例百分比写成插件承诺。当前 `architecture.md` 已有条件式成本规则。

### C4. 依赖、lockfile 与供应链

**事实**：npm 的 lockfile 用于记录可复现的精确依赖树并应提交版本控制；GitHub dependency review 可展示直接/传递依赖变化、已知漏洞和许可证信息。来源：[npm package-lock.json](https://docs.npmjs.com/files/package-lock.json/)、[GitHub Dependency Review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)

**建议**：依赖变更时审查 manifest 与 lockfile 的因果 diff、传递依赖和已知漏洞；对外分发或有合规要求时再把许可证策略升级为硬门槛。当前 `change-boundaries.md` 已保护包管理器和 lockfile；可在项目 CI 能力存在时补 dependency review，不需要把某个供应商工具写成全球强制。

### C5. 可诊断性而不是“到处打日志”

**事实**：Google SRE 把结构化日志、指标、追踪/关联信息视为缩小故障范围的重要证据，但同时强调从系统行为和假设出发，而不是堆积无目的输出。来源：[Google SRE：Effective Troubleshooting](https://sre.google/sre-book/effective-troubleshooting/)

**建议**：对服务边界、异步任务和外部副作用，要求能关联一次操作的受控诊断证据，并遵守脱敏；不要把“每个函数都记录进入/退出”加入全局规则。可观察性应服务于具体故障模型。

### C6. 高风险边界的轻量威胁建模

**事实**：OWASP 将威胁建模定义为可重复的结构化过程，核心是确认系统和数据流、识别可能失败或被滥用的路径、决定缓解措施，并验证是否足够；它应随系统演进更新，而不是一次性文档仪式。来源：[OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)

**建议**：只在认证、授权、敏感数据处理或新增外部信任边界时触发，围绕当前变化列出参与者、数据流、信任边界、滥用路径、缓解措施和验证证据。不要要求每次普通改动重画全系统，也不要把工具生成的图当作风险已经处理的证明。当前 `architecture.md` 已加入这一条件式底线。

---

## D. 推荐的规则组织方式

当前四层结构基本正确，不建议继续扩大核心正文：

| 位置 | 应保留内容 | 不应放入 |
| --- | --- | --- |
| `SKILL.md` 核心 | 目标、决策优先级、工作顺序、reference 路由、判断更新元规则、完成条件 | 语言/框架专用细节、长安全清单、完整测试方法 |
| `references/change-boundaries.md` | 因果范围、Boy Scout、依赖/lockfile、迁移、消费者审计、TODO/债务载体、文档所有权 | 具体测试框架 API |
| `references/architecture.md` | 所有权、模块边界、安全、外部副作用、超时/重试/幂等、成本条件 | 每次小改动都强制的架构仪式 |
| `references/verification.md` | 回归证据、测试信号、flaky、错误语义、熔断、自审、UI 最低验收 | 与任务无关的全仓扫描 |

推荐继续遵守三条维护原则：

1. **一个语义一个权威位置。** 核心只路由，不在 README、Hook 提醒和多个 references 重复完整规则。
2. **规则要能改变可观察行为。** 每条应说明触发条件、动作和完成证据；只能表达价值观、无法判断是否遵守的口号不加入。
3. **新增规则必须有失败样本或一手依据。** 记录它针对的真实失败模式；没有实际收益时删除，而不是只增不减。

---

## E. 工作流以后何时优化、怎样测试

### 触发优化的信号

- 同类错误在多个真实任务中重复出现，且现有规则没有覆盖或无法被模型正确路由。
- 核心注入持续增长，子 Agent token/延迟显著上升，或大输出开始落盘/截断。
- 规则互相冲突，使模型反复解释优先级、请求无关确认，或出现明显的“念规则”噪音。
- Codex 官方 Hook 事件、输入输出契约、信任模型或插件格式发生变化。
- 新插件组合暴露同事件并发、共享文件或输出格式冲突。
- 规则虽然存在，但代表性任务的行为指标没有改善，或出现新的规避方式，例如测试变绿但信号变弱。

### 最小测试矩阵

| 层级 | 要证明什么 | 推荐证据 |
| --- | --- | --- |
| 静态配置 | 三个事件、matcher、命令路径、manifest/version 一致 | 配置解析与仓库验证脚本 |
| Hook 单元 | 每类输入输出、错误脱敏、prompt 不回显、体积上限 | 现有 Node 测试；补充边界输入时保持无网络、无状态 |
| 构建一致性 | TypeScript 源与发布 `.js` 同步 | clean build 后 diff/校验 |
| 生命周期冒烟 | startup/resume/clear/manual compact/auto compact/子 Agent 在真实客户端触发 | 发布候选人工记录事件、版本标记和上下文是否出现；不要只信脚本模拟 |
| 多 Hook 组合 | 并发时均能运行且不依赖顺序 | 安装一个最小第二 Hook，断言两者结果存在，不断言顺序 |
| 规则行为 eval | 规则是否真的改善工程决策 | 固定任务集、固定成功判据，前后对照违规数、成功率、返工、token、延迟 |
| 安全/权限 | Hook 只读预期文件、不回显 prompt/机密、失败信息安全 | 恶意/畸形输入测试、权限审查、发布文件清单 |

### 推荐发布门槛

1. 每次改 Hook 源、配置或 Skill 核心时运行仓库全部静态检查和 Hook 测试。
2. 若 Hook 内容 hash 改变，明确提示重新审查信任；不要把“安装成功”写成“已生效”。
3. 改事件生命周期或注入结构时，至少做一次真实客户端冒烟；改纯文案时不必每次强制长对话 auto compact。
4. 改核心规则时，用同一组代表性任务做前后对照，一次只改一组语义。观察质量与成本，不只看 token。
5. 发布说明区分：自动化已验证、真实客户端已验证、尚需人工验收。没有运行的层级不能写成通过。

---

## 最终建议

- **Hook 架构不需要因 compact 疑虑增加 `PostCompact`。** 当前 `SessionStart(source="compact")` 是官方明确支持且更简单的路径。
- **暂不拆分 Subagent 专用正文。** 保持 6,000-byte 回归护栏，同时收集真实子 Agent 调用的质量与成本数据；有证据再做 A/B 缩减。
- **保持 `UserPromptSubmit` 固定短提醒。** 先观察噪音，不引入未经评测的关键词分类。
- **保留当前已加入的工程约束。** 它们已经把用户建议中三个容易过度绝对化的点修正为：测试修改需证据、TODO 需持久所有权与授权、异常只在正确边界记录/转译。
- **下一轮优化重点不应是继续搜集口号，而是建立小型回归 eval。** 规则真正的版本标准应是：更少同类失败、更少越界改动、更可靠的完成证据，同时没有不可接受的 token、延迟和交互噪音增长。
