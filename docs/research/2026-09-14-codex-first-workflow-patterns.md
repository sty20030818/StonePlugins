# Codex 优先的工作流模式调研

日期：2026-09-14。状态：后续研究输入快照，原位归档。本文保留比较证据和当时的候选建议；目标方向已进入 [ADR-0004](../adr/0004-codex-first-bundled-engineering.md) 与[重构计划](../plans/2026-09-14-codex-first-refactor.md)，尚未实现或验收。活动推荐、实施任务和跨宿主待办由上述文档持有，不由本文继续维护；文档分类见[文档索引](../README.md)。

## 本轮明确约束

- Codex 是主要 Agent，优先保证其安装、调用、生命周期恢复和日常体验。
- Claude、Grok 等其他 CLI 目前只需独立 Skills；原生插件与 Hook 适配延后，不能反过来限制 Codex 方案。
- 可以考虑 Ponytail 式直接注入；是否显示一次原生 Skill 调用不再是硬约束。
- StonePlugins 是用户确认的工作流品牌；具体仓库、marketplace、plugin、skill 名称仍应区分。
- 比较一手源码与实际宿主路径，不把 GitHub stars 当作质量或最佳实践证明。

## 方法与证据边界

本轮使用项目自己的 GitHub API、固定提交源码、README 和测试。没有安装或执行这些项目的安装器、Hook 或工作流。以下“支持”主要表示项目当前提供对应 manifest 和实现，不等于已在本机做安装与行为验收。

先前 Waza、Ponytail 的本机源码审计见 [完整插件分发调研](2026-09-14-plugin-bundled-skills.md)。本轮增加 Superpowers、Compound Engineering、ECC、GSD Core，检查它们的 Codex 路径，不能把同仓库的 Claude Hook 当作 Codex 实现。

GitHub 的 `updated_at` 会受仓库活动影响，`pushed_at` 也不等于默认分支最后提交日期；下表分别保留默认分支固定提交和推送时间。Stars 是 2026-09-14 查询时的关注度快照，会继续变化。

## Superpowers：Codex 明确无 Hook，Claude 注入引导 Skill

### 当前身份与版本

- 仓库：[`obra/superpowers`](https://github.com/obra/superpowers)，默认分支 `main`，未归档。
- GitHub API 快照：286,366 stars；`pushed_at=2026-09-12T00:16:38Z`。
- 本轮固定默认分支提交：[`b36e0829c6d0140e93cfef2ca599b1b07d4a7797`](https://github.com/obra/superpowers/commit/b36e0829c6d0140e93cfef2ca599b1b07d4a7797)，提交时间 `2026-08-12T16:53:21Z`；manifest 版本 `6.3.0`。
- 仓库 `skills/*/SKILL.md` 共 14 个。

元数据来源：[项目 GitHub API](https://api.github.com/repos/obra/superpowers)、[固定提交 API](https://api.github.com/repos/obra/superpowers/commits/b36e0829c6d0140e93cfef2ca599b1b07d4a7797)。

### Codex 与 Claude 是两条不同路径

Codex 原生 `.codex-plugin/plugin.json` 声明 `skills: "./skills/"`，同时显式声明 `hooks: {}`。它不是缺少 Hook 的疏漏：配套测试说明，必须用空对象阻止 Codex 自动发现同仓库的 Claude `hooks/hooks.json`，避免再次注册 SessionStart 和安装信任提示。

来源：[Codex manifest](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/.codex-plugin/plugin.json)、[Codex manifest 回归测试](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/tests/codex/test-marketplace-manifest.sh#L55-L73)。

Claude 的 `SessionStart` 匹配 `startup|clear|compact`，运行 `hooks/session-start`。脚本读取并注入完整 `skills/using-superpowers/SKILL.md`，强调这是“如何使用 Skills”的引导；其他 Skills 仍按需读取。它没有一次性注入所有工作流。脚本还区分 Claude、Cursor、Copilot 的输出字段，明确避免某些宿主重复消费两份内容。

来源：[Claude hooks](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/hooks/hooks.json)、[注入脚本](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/hooks/session-start)。

`using-superpowers` 的正文有明确子 Agent 例外：被派发具体任务的子 Agent 忽略这份入口技能；具体开发、审查流程通过各自技能和派发提示提供。Codex 的子 Agent 指导放在入口技能下的 `references/codex-tools.md`，并要求以实际工具目录为准。Codex manifest 本身不提供启动、压缩恢复或子 Agent 的 Hook 注入。

来源：[入口 Skill](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/using-superpowers/SKILL.md)、[Codex reference](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/using-superpowers/references/codex-tools.md)。

### 值得借鉴与不适用点

- 借鉴：同一个原生插件包含完整 Skills；用真实宿主能力决定 Hook；引导内容与任务工作流分层；对意外 Hook 自动发现留下回归证据。
- 借鉴：其 Codex 优化研究把仪式成本、重复审查和等待开销当成可测问题，先有失败基线，再改变提示；不是靠压短文字或 stars 宣称更优。[项目自己的优化设计与评估标准](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/docs/superpowers/specs/2026-07-30-codex-efficiency-fixes-design.md)。这些是作者报告，并非本轮复现实验。
- 不照搬：它主要提供可组合开发工作流；我们的核心是工程任务的常驻契约。其“Codex 无 Hook”和“子 Agent 忽略入口”不自动满足我们的规则恢复要求。
- 不照搬：样例中的模型、工具字段和强制流程应服从当前宿主与用户授权，不能因为项目热门就覆盖本机约定。

## Compound Engineering：完整原生 Skills 包，无生产 Hook

### 当前身份与版本

- 仓库仍为 [`EveryInc/compound-engineering-plugin`](https://github.com/EveryInc/compound-engineering-plugin)，默认分支 `main`，未归档。
- GitHub API 快照：25,070 stars；`pushed_at=2026-09-14T02:42:52Z`。
- 固定提交：[`fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187`](https://github.com/EveryInc/compound-engineering-plugin/commit/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187)，提交时间 `2026-09-14T02:41:45Z`；manifest 版本 `3.25.0`。
- `skills/*/SKILL.md` 共 35 个，位于仓库根目录 `skills/`。

元数据来源：[项目 GitHub API](https://api.github.com/repos/EveryInc/compound-engineering-plugin)、[固定提交 API](https://api.github.com/repos/EveryInc/compound-engineering-plugin/commits/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187)。

### Codex 分发与加载

`.agents/plugins/marketplace.json` 指向仓库根目录，`.codex-plugin/plugin.json` 声明同目录的 `skills/`。README 分别提供 Codex App 的自定义 marketplace 安装和 Codex CLI 原生 plugin 安装，明确安装是自包含的；专家审查和研究提示作为 Skills 内本地资源提供，不要求额外安装全局自定义 Agent。

来源：[Codex marketplace](https://github.com/EveryInc/compound-engineering-plugin/blob/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187/.agents/plugins/marketplace.json)、[Codex manifest](https://github.com/EveryInc/compound-engineering-plugin/blob/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187/.codex-plugin/plugin.json)、[安装说明](https://github.com/EveryInc/compound-engineering-plugin/blob/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187/README.md#codex-app)。

固定提交树里没有生产用 Hook 目录；含 Hook 的路径来自转换器测试 fixtures。Codex manifest 也未注册 Hook。因此不能把它的跨宿主转换器、测试 fixture 或历史安装文档当成当前 Codex 的生命周期注入机制。

来源：[固定提交完整树](https://api.github.com/repos/EveryInc/compound-engineering-plugin/git/trees/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187?recursive=1)、[Codex manifest](https://github.com/EveryInc/compound-engineering-plugin/blob/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187/.codex-plugin/plugin.json)。

`ce-work` 由入口解析当前任务，再按执行阶段读取 Skill 自带 references；规则缺失时停止对应行为，不从记忆重建。它把实现 worker 的有限任务与主 Agent 的集成、验证、提交权限分开。`ce-handoff` 是显式会话交接工作流，不是自动 compact Hook；普通“继续”不会自动创建交接材料。

来源：[ce-work](https://github.com/EveryInc/compound-engineering-plugin/blob/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187/skills/ce-work/SKILL.md)、[ce-handoff](https://github.com/EveryInc/compound-engineering-plugin/blob/fd8abda7f64ead2f410da2cfd86c0c8e7cbf8187/skills/ce-handoff/SKILL.md)。

### 值得借鉴与不适用点

- 借鉴：一次安装自包含；每个 Skill 有明确工作产物和消费者；reference 按阶段读取，路径绑定已加载入口；分工不转移主 Agent 的最终验证和提交责任。
- 借鉴：会话交接指向权威计划、提交、文档，而不是复制一份新的事实源。
- 不照搬：35 个工作流、配置体系、跨模型执行、知识沉淀与自动 shipping 不是我们当前的已确认需求。仅为一份工程契约引入整套生命周期管理会扩大维护面。
- 不照搬：作者 README 的完整自主流程可包含提交、推送与 PR；这类行为不能自动替代我们的逐项授权边界。

## ECC：Codex 专用 SessionStart，有限上下文而非全部 Skills

### 当前身份与版本

- 旧仓库 `affaan-m/everything-claude-code` 已重定向至 [`affaan-m/ECC`](https://github.com/affaan-m/ECC)。
- API 快照：257,944 stars，默认分支 `main`，未归档，最近推送日期 2026-09-14。
- 固定提交：[`8321021c54d670126ce3b2969d5deb880b4b0c2a`](https://github.com/affaan-m/ECC/commit/8321021c54d670126ce3b2969d5deb880b4b0c2a)，默认分支提交日期 2026-09-12。

来源：[项目 API](https://api.github.com/repos/affaan-m/ECC)、[固定提交 API](https://api.github.com/repos/affaan-m/ECC/commits/8321021c54d670126ce3b2969d5deb880b4b0c2a)。

### 原生 Codex 路径

当前 Codex manifest 同时声明 `skills: "./skills/"` 和 `hooks: "./hooks/codex-hooks.json"`。README 将 native marketplace 作为 Codex 主安装方式，旧同步安装弃用，并提醒同一个宿主不要叠加两种安装。

来源：[Codex manifest](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/.codex-plugin/plugin.json)、[Codex 安装](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/README.md#L322-L335)、[避免双重安装](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/README.md#L237-L249)。

Codex 专用配置只注册 SessionStart，缺少 `PLUGIN_ROOT` 时失败，不退回猜测路径。实际启动脚本有默认 8,000 字符上限、最多六个 learned Skill 摘要，注入 instincts、旧会话摘要、学习技能摘要和项目类型，不是全量 292 个 Skills。非 startup 事件跳过旧会话摘要；恢复材料注明仅作历史参考，避免重新执行旧命令。

来源：[Codex Hook 配置](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/hooks/codex-hooks.json)、[上下文预算](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/scripts/hooks/session-start.js#L35-L39)、[实际注入内容与历史边界](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/scripts/hooks/session-start.js#L643-L758)。

仓库提供固定 payload 和缺少 `PLUGIN_ROOT` 时失败的测试；本轮只读了测试，没有运行。Codex 包未注册独立 SubagentStart；不能从它的 Claude Hook 能力推导 Codex 子 Agent 恢复能力。

来源：[Codex Hook 测试](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/tests/codex-native-hooks.test.js#L78-L89)、[实际 Codex 注册面](https://github.com/affaan-m/ECC/blob/8321021c54d670126ce3b2969d5deb880b4b0c2a/hooks/codex-hooks.json)。

### 值得借鉴与不适用点

- 借鉴：Skills 和 Codex 专属 Hook 同包；对输入内容设预算；缺少可信根路径则报错；恢复历史不等于执行历史指令。
- 不照搬：庞大技能目录、instinct 与记忆体系并非维护常驻工程核心所需。不能把“有 Hook”误写成“Hook 调用全部 Skills”。

## GSD Core：定制安装与显式恢复，不是核心正文 Hook

### 当前身份与版本

- 原 [`gsd-build/get-shit-done`](https://github.com/gsd-build/get-shit-done) 有 64,535 stars，但已经归档；README 指向新家 [`open-gsd/gsd-core`](https://github.com/open-gsd/gsd-core)。不能把旧仓库的关注度直接算作新仓库 stars。
- 新仓库 API 快照：9,431 stars，默认分支 `next`，未归档，2026-09-14 仍活跃。
- 固定提交：[`40628d8050ecd718e1dc744deed0f0ca9ecea50b`](https://github.com/open-gsd/gsd-core/commit/40628d8050ecd718e1dc744deed0f0ca9ecea50b)。

来源：[旧仓库 API](https://api.github.com/repos/gsd-build/get-shit-done)、[旧仓库迁移说明](https://github.com/gsd-build/get-shit-done)、[新仓库 API](https://api.github.com/repos/open-gsd/gsd-core)、[固定提交 API](https://api.github.com/repos/open-gsd/gsd-core/commits/40628d8050ecd718e1dc744deed0f0ca9ecea50b)。

### Codex 路径与文档漂移

GSD Core 的 Codex 主路径是带 `--codex` 的定制 npm 安装器，转换与安装 Codex Skills、Agent 文件等内容，不是本轮其余样本那种直接注册 marketplace 原生完整包。安装器逐技能生成宿主适配说明，改写路径、技能调用、问答和子 Agent 工具映射。

来源：[Codex 安装说明](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/docs/how-to/install-on-your-runtime.md#L162-L182)、[转换与适配实现](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/bin/install.js#L3833-L3982)。

需要注意该提交内部存在文档漂移：安装文档仍提 `~/.codex/skills`，但当前 capability 把全局 Skills home 设置为 `.agents`，安装器代码也明确迁移到 `~/.agents/skills`。因此不能只读 README 就断言它的真实安装路径。

来源：[当前 Codex capability](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/capabilities/codex/capability.json#L23-L35)、[安装路径实现](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/bin/install.js#L10274-L10278)、[全局迁移实现](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/bin/install.js#L11219-L11225)。

Codex 只注册 SessionStart 更新检查；项目文档明确没有 Claude statusline 的数据生产者，原 context monitor 已删除，不假装上下文告警有效。恢复通过 `gsd-resume-work` 显式读取 workflow，再加载 STATE、PROJECT 和 HANDOFF 并核对 Git 状态，不是 Hook 注入工程规则全文。

来源：[宿主能力边界](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/docs/how-to/install-on-your-runtime.md#L162-L182)、[恢复技能](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/skills/gsd-resume-work/SKILL.md#L14-L31)、[恢复状态加载](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/gsd-core/workflows/resume-project.md#L39-L65)、[恢复后核实](https://github.com/open-gsd/gsd-core/blob/40628d8050ecd718e1dc744deed0f0ca9ecea50b/gsd-core/workflows/resume-project.md#L107-L116)。

### 值得借鉴与不适用点

- 借鉴：恢复依据权威状态并核实当前仓库；为宿主能力画真实边界；删除没有数据源的无效监控；实现证据优先于漂移文档。
- 不照搬：为许多宿主建立大型转换器、phase 框架和调度系统。我们已明确 Codex 优先，这些结构当前没有消费者。

## 六个样本的可比结论

| 工作流 | 本次查看范围 | Codex 安装单元 | Codex Hook 实际承载 |
| --- | --- | --- | --- |
| Waza | 本机 3.36.1，前轮固定源码审计 | 原生插件含 Skills | 无 Hook |
| Ponytail | 本机 4.9.0，前轮及本轮源码审计 | 原生插件含 Skills 与 Hook | SessionStart、SubagentStart 注入当前主 ruleset；逐轮 Hook 跟踪开关/模式，普通轮次不重注入全文 |
| Superpowers | 本轮固定 v6.3.0 | 原生插件含 14 个 Skills | 显式 `hooks: {}`；Claude 才注入入口 Skill |
| Compound Engineering | 本轮固定 3.25.0 | 原生插件含 35 个 Skills | 无生产 Hook；恢复与分工由工作流承担 |
| ECC | 本轮固定 main 提交 | 原生插件含 Skills 与专属 Hook | 有预算的 SessionStart 恢复/项目摘要，不是全部 Skills |
| GSD Core | 本轮固定 next 提交 | 定制安装器生成 Skills 和 Agent 资源 | SessionStart 仅更新检查，不注入核心规则 |

Waza、Ponytail 的本机文件和固定来源见[前轮调研](2026-09-14-plugin-bundled-skills.md)。Ponytail 的主 ruleset 注入不等于注入所有六个 Skills；其其他宿主逐轮全文分支也不能套用到 Codex。

## 初步结论：借鉴模式，不借用“最佳实践”标签

已核查项目的共同点是可分发的完整 Skill 包、稳定入口与按需资源；Hook 策略并不统一。尤其 Superpowers 在 Claude 注入引导正文，却在 Codex 显式禁用 Hook，已经排除“热门项目都使用同一种注入方式”的前提。

对 StonePlugins，应分别决定：

1. **安装边界**：Codex 一次安装是否拿到 Skill、references 和必要 Hook。这个问题不依赖选择哪种加载策略。
2. **加载边界**：按需工作流可依赖原生 Skills；常驻工程契约可比较直接注入核心和短提醒加载。二者必须以规则完整、真实遵循与成本证据比较。
3. **维护边界**：当前只精做好 Codex，其他宿主先消费同一份标准 Skill；不用提前引入原生多宿主 Hook 兼容层。

## 主 Agent 建议、命名与待办

以下是结合本轮范围后的首选验证方案，不替换 ADR-0003，也不代表新方案已经验收。

### 推荐：完整原生插件，生命周期送达精简核心

建议 Codex 一次安装同一个包，获得核心 Skill、全部 references 和所需 Hooks。Skill 文件保持唯一源码；Hook 读取这份源码，不维护第二套硬编码工程规则。其他 CLI 仍可从同源目录单独安装 Skill，不为它们现在新增插件 manifest、转换器或生命周期兼容层。

加载候选如下：

| 入口 | 候选职责 |
| --- | --- |
| SessionStart：startup / resume / clear / compact | 直接注入完整、精简的核心契约，并给出当前安装来源和 Skill 根路径 |
| SubagentStart | 为子 Agent 直接送达同一核心，不把父 Agent 的加载声明当作独立上下文证据 |
| UserPromptSubmit | 仅保留必要的短执行提醒，不逐轮复制核心或全部 references，不分析 prompt 关键词进行路由 |
| 显式或隐式使用工程 Skill | 保留正常原生入口；同一有效上下文已完整收到相同核心时，不为显示徽标而额外读取一次 |
| 出现架构、验证等事实信号 | 按 Skill 里的条件读取相应 reference；解析基准是当前安装的 Skill 目录，而不是用户项目 cwd |

OpenAI 文档支持 SessionStart 与 SubagentStart 的 stdout / additionalContext 进入相应 Agent 的 developer context，并明确 `SessionStart source=compact` 在压缩后的下一次模型请求前送达，无须为同一目的重复注册 PostCompact。[Codex Hooks](https://learn.chatgpt.com/docs/hooks)

这是更接近 Ponytail 的送达方式，但不是照搬其模式开关、持久状态和硬编码 fallback。也不是一次性加载所有主题细则。对我们的常驻契约而言，少一个“模型先决定读取核心”的环节具有实际价值；对 Waza、Compound 这类多种可选工作流，默认全文注入反而不合适。

### 直接注入仍有真实代价

- 正文进入上下文，不等于模型必然落实；仍需验证最终方案和代码。直接注入也不等于一次原生 Skill 调用，不能据此承诺 UI 徽标或使用次数。
- SessionStart 时未必知道本轮是否为工程任务，纯聊天也可能承担一次核心上下文成本。规则的适用范围仍限定工程判断，非工程任务不强制执行工程流程或输出决策说明。
- resume 或携带完整父历史的子 Agent 可能重复获得核心。先记录实际成本，不为避免一次重复就新增跨事件状态数据库或脆弱 transcript 猜测。
- 注入必须带当前安装的资源定位信息，不能保留旧版本绝对路径，也不能因为正文已注入就丢失 references 的解析基准。
- 文件缺失、不可读、路径不可信或正文超预算要显式报告，不静默注入硬编码旧规则。Hook 送达失败与 Agent 是否暂停是不同层的行为，尤其不能把 SubagentStart 的 `continue:false` 当作机械阻断保证。

本轮用 Node 读取当前源码测得：完整 `SKILL.md` 为 5,480 UTF-8 bytes / 2,492 Unicode 字符；去 frontmatter 后为 5,098 bytes / 2,110 字符。仓库 [v0.5.0 候选验证](../evals/v0.5.0.md) 归档了 `o200k_base` 核心 1,377 tokens 的旧测量；本轮未重新运行 tokenizer，也未测量候选包装、宿主实际输入或账单。

官方默认每个 Hook 输出约 2,500 tokens 后会落盘并向模型发送头尾预览，`additionalContextLimit` 是近似阈值，不是正文完整性的证明。保持有限输出预算；不要因为怕截断就无条件设为 0。选用有限阈值及严格输出检查，并通过真实宿主轨迹证明完整性。[官方大输出处理](https://learn.chatgpt.com/docs/hooks#large-hook-output)

因此，“相同正文直接注入一定更省”也不能预先成立：它能减少一次读取往返，但不同任务、恢复次数、子 Agent 继承和缓存可能改变整体成本。

### 名称：StonePlugins 品牌与工程入口对齐

当前实际是三个身份：仓库 `StonePlugins`、marketplace ID `stonefish`、plugin ID `stonefish-engineering`；独立 Skill 也叫 `stonefish-engineering`。仓库名不会自动决定技能调用前缀。

拟议命名：

| 层次 | 建议 |
| --- | --- |
| 仓库与展示品牌 | 保留 `StonePlugins` |
| 插件技术 ID | `stoneplugins` |
| 插件内 Skill 名称 | `engineering` |
| 拟议限定入口 | `stoneplugins:engineering` |

这对应用户熟悉的 `waza:learn`，也不会把整体品牌改成 Stonefish。OpenAI 要求稳定的小写插件标识，由它提供组件命名空间；具体客户端选择器与调用语法仍在安装后核对。[插件命名](https://developers.openai.com/plugins/build/plugins#create-a-plugin-manually)

此命名尚未实施或最终确认。更名需迁移旧插件安装 ID、Skill 默认提示和已有独立入口；marketplace ID 是另一个层次，不必仅为缩短 Skill 调用前缀而同步更名。一次安装不绕过 Hook 信任审核。[插件安装与 Hook 信任](https://developers.openai.com/plugins/build/plugins#bundled-mcp-servers-and-lifecycle-hooks)

### 最小验证与正式采纳条件

不用新建评测平台，复用 [现有行为案例](../evals/behavior-cases.md) 和现有 Hook 测试入口。实现阶段只对比两种真实候选：完整插件内的短提醒加载，与完整插件内的核心直接注入；规则正文、references、模型、任务和安装源保持一致。

- 在没有外置工程 Skill 的干净安装中，插件所属 Skill、核心与所有相对资源均可用。
- 逐个覆盖 startup / resume / clear / compact / SubagentStart；区分脚本输出完整、宿主实际收到、模型落实三个证据，不用 UI 调用计数代替。
- 改变加载策略时同步更新现有评测中“必须看到新的核心文件读取”的旧前提；新证据必须是完整核心送达，而不是删掉完整性门槛。
- 复用现有共同所有者、错误抽象、权限与修改边界等固定案例；按既有要求每侧至少三次，确认无关键行为回归。
- 补纯聊天、已加载后手动调用、继承父历史的子 Agent 场景，比较无用核心重复、references 实际读取、工具往返、输入 token 和缓存口径；字节数不当成账单。
- Codex 只启用一个工程来源，旧共享安装的使用者不受误删影响；不引入自动下载安装或旧缓存回退。

如果直接注入不能完整送达、明显增加重复或非工程成本，而没有加载可靠性收益，就改选同包短提醒方案。无论哪种胜出，一次安装自包含与唯一规则源码都保留。

### 延后适配的历史结论

本轮研究明确：Claude、Grok 原生插件与 Hook 适配延后，现阶段只需消费同源独立 Skill。活动待办、启动条件与完成状态统一由[重构计划](../plans/2026-09-14-codex-first-refactor.md)持有，本文不保留第二套可勾选清单。

这项研究结论不代表定时自动执行、已创建独立任务或已获授权安装其他宿主工作流。
