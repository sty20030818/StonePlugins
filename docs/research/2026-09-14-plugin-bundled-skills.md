# 完整插件、独立 Skill 与生命周期 Hook 的分发方案

调研日期：2026-09-14。状态：首轮研究输入快照，原位归档。本文保留当时的证据和建议，不继续持有活动推荐或待办；其中“Hook 仅提示加载”的首选建议已由后续方向调整。现行文档见[文档索引](../README.md)，目标决定见 [ADR-0004](../adr/0004-codex-first-bundled-engineering.md)，实施与跨宿主待办仅由[重构计划](../plans/2026-09-14-codex-first-refactor.md)持有。目标尚未实现或验收，拟议目录和命令不代表当前 `0.5.0` 已具备该结构。

后续用户明确以 Codex 为主要宿主，其他 CLI 暂时仅使用独立 Skills，并允许重新比较生命周期直接注入。更多工作流样本及建议演进的研究记录见 [Codex 优先的工作流模式调研](2026-09-14-codex-first-workflow-patterns.md)。下文保留首轮研究判断，不代表后续已排除直接注入核心。

## 结论

对“安装一次就得到完整工作流、能看到插件所属 Skill、自动提醒加载工程规则”这个目标，推荐将 **Skill 与精简加载 Hook 一起放进 Codex 完整插件**。Grok 当前先保留同源独立 Skill，并在迁移时隔离到其私有目录；Grok 原生插件是可选后续方案，需要单独适配，不能直接共用 Codex 的 Hook 注入协议。分发载体和加载策略可以分别决定，不必因为选择 Skill 渐进加载，就把 Skill 从插件中移走。

这符合当前 OpenAI 的分发建议：Skill 定义工作流，插件将一个或多个 Skill 及可选能力打包安装；本地独立 Skill 仍适合个人开发和项目内使用。[OpenAI：Build skills](https://learn.chatgpt.com/docs/build-skills)、[OpenAI：Plugin architecture](https://developers.openai.com/plugins/concepts/plugins)

“完整插件”不等于“每轮注入完整 Skill”。Hook 继续只提供简短加载要求，模型从宿主登记的 Skill 入口读取正文，references 按触发条件读取；当前公开 Hook 协议没有一个返回 `invokeSkill` 就能保证执行和记账的接口。[OpenAI：Hooks](https://learn.chatgpt.com/docs/hooks)

## 1. 为什么现在只有 Hook

仓库 [ADR-0003](../adr/0003-independent-skill-and-loader-hooks.md) 明确决定：核心与 references 只在根 `skills/stonefish-engineering/` 维护，`plugins/stonefish-engineering/` 只分发 Hook。当前插件 manifest 的说明也要求先通过 Skills CLI 安装独立 Skill。因此，当前插件没有 Skill 是 `0.5.0` 的既定设计，不是 GitHub Release 漏打包。[研究时的 manifest 快照](https://github.com/sty20030818/StonePlugins/blob/8c518b64f4d03a11d6aaa4233a64b89baf63d302/plugins/stonefish-engineering/.codex-plugin/plugin.json)

原决定解决了两个真实问题：规则跨宿主使用，以及停止 Hook 全文注入。但它把这两个问题与“插件不再携带 Skill”绑定在一起，增加了独立安装、独立更新和缺失依赖三个成本。现在有一个不同组合：**插件携带原生 Skill，同时 Hook 仅要求加载它**。这既能保留可见 Skill 入口，也能继续渐进加载；不是回到全文注入旧实现。

## 2. 一手资料与版本范围

| 来源 | 本次核查范围 | 证据边界 |
| --- | --- | --- |
| OpenAI 官方文档 | 2026-09-14 实时读取 `build-skills`、`hooks`、`plugins/concepts/plugins`、`plugins/build/plugins` | 文档随产品变化；能力是否落到本机版本仍需真实宿主验收 |
| Vercel Skills CLI | [`d667282815248da03a08a18272b5d2eef9caf77c`](https://github.com/vercel-labs/skills/commit/d667282815248da03a08a18272b5d2eef9caf77c)，`package.json` 为 `1.5.26`，提交时间 2026-09-11 | 固定版本源码可复查；本次没有运行安装或升级命令 |
| StonePlugins | 当前 `0.5.0` manifest 与 ADR-0003 | 解释现状；本文提出的新布局未落地 |
| Grok Build | 本机 `1.0.25 (f7e67d6988e2)`；官方源码固定到 [`37949780c144e37df692e3d669051a21fec24f20`](https://github.com/xai-org/grok-build/tree/37949780c144e37df692e3d669051a21fec24f20) | 本机只验证 CLI、manifest 探测和 Skill 发现；上游 `SOURCE_REV=c4ea71…` 与本机二进制不同，不冒充本机模型端到端验证 |

Skills CLI 的兼容表不是 Codex 能力的权威来源。例如它的 README 表格仍将某类 Skill hooks 支持标成 No，不能据此推导 Codex 没有生命周期 hooks；Codex 的 hook 行为应以 OpenAI 官方协议为准。[Skills CLI README](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/README.md)、[OpenAI：Hooks](https://learn.chatgpt.com/docs/hooks)

### Waza 和 Ponytail 实际上采用了不同加载方式

本轮读取了本机安装的 Waza `3.36.1` 与 Ponytail `4.9.0`，不是根据界面名称猜测实现：

| 项目 | 包装与加载 | 对我们的启示 |
| --- | --- | --- |
| Waza | manifest 声明 `skills: ./skills/`，包含八个工作流 Skill；安装包没有 hooks 目录或 Hook 声明。宿主提供 `waza:learn` 等入口 | 一次安装和命名空间来自插件打包与 Skill 注册，不要求有 Hook |
| Ponytail | manifest 同时声明 `skills/` 和 `hooks/claude-codex-hooks.json`；激活 Hook 会读取主 Skill、去除 frontmatter 后注入规则正文。部分模式使用较短指引 | 完整插件可以包含两种组件，但其全文注入策略不是我们必须一起采用的做法 |

本机证据：[Waza manifest](/Users/stonefish/.codex/plugins/cache/waza/waza/3.36.1/.codex-plugin/plugin.json)、[Ponytail manifest](/Users/stonefish/.codex/plugins/cache/ponytail/ponytail/4.9.0/.codex-plugin/plugin.json)、[Ponytail 规则读取实现](/Users/stonefish/.codex/plugins/cache/ponytail/ponytail/4.9.0/hooks/ponytail-instructions.js)。这些缓存路径是本次安装快照，不保证升级后继续存在。

Waza 也同时提供独立 Skill 与完整插件，并非两种分发只能选一种。其仓库以根 `skills/` 为源码，再生成 `plugins/waza/skills/` 副本，通过 `--check` 检查字节一致；本轮本机三处目录（根源码、插件镜像、已安装包）比较一致。固定源码为 [`ba60df6efd4ff9a8332e939c6027f156440d2eb8`](https://github.com/tw93/Waza/tree/ba60df6efd4ff9a8332e939c6027f156440d2eb8)。[安装说明](https://github.com/tw93/Waza/blob/ba60df6efd4ff9a8332e939c6027f156440d2eb8/README.md)、[生成与一致性校验实现](https://github.com/tw93/Waza/blob/ba60df6efd4ff9a8332e939c6027f156440d2eb8/scripts/build_metadata.py)

我们目前只有一个核心 Skill，无须照搬生成镜像流程：把唯一源码放在插件内部，独立安装直接选择这个子目录即可。若以后必须兼容固定根目录布局或多种不同分发产物，再考虑可验证的生成副本；不能维护两份手改正文。

## 3. 插件原生 Skill 的身份与加载

插件可以只含一个 Skill，不需要 MCP、服务器或多个功能来证明“值得做插件”。插件名承担稳定身份和组件命名空间；Skill 的正文仍是 `SKILL.md` 加同目录下的 references、scripts 或 assets。[OpenAI：Package your plugin](https://developers.openai.com/plugins/build/plugins)、[OpenAI：Build skills](https://developers.openai.com/plugins/build/skills)

因此，类似 `waza:learn` 的展示符合插件所属 Skill 的表达方式。不过具体可见名称、显式调用语法、统计口径由宿主负责，不能仅凭 Hook 发出“使用某 Skill”就保证出现 UI 调用徽标或增加插件次数。需要分别验收：目录里有文件、宿主登记了 Skill、模型实际读取了正文、UI 如何记录。[OpenAI：Build skills](https://learn.chatgpt.com/docs/build-skills)、[现有 ADR-0003 的展示边界](../adr/0003-independent-skill-and-loader-hooks.md)

若沿用插件名与 Skill 名，限定名会较长：`stonefish-engineering:stonefish-engineering`。若追求 `stonefish:engineering` 这样的短入口，需要显式调整插件身份与 Skill 名称，同时处理旧安装 ID；它是可选的命名迁移，不是打包修复的必要前提。无论叫什么，调用 Skill 后读取 `SKILL.md` 和相关 Markdown references 都是正常实现，不是绕过 Skill。

### 两种受支持的 OpenAI 包装格式

当前官方包装页优先介绍 portable Agent Plugins 格式：根 `plugin.json` 声明 `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`，Skill 固定从插件根 `skills/` 发现；OpenAI 特有 hooks 和展示字段放在 `extensions.com.openai`。现有 `.codex-plugin/plugin.json` 兼容格式仍受支持，官方内置 creator 目前也仍生成这一格式。[OpenAI：Package your plugin](https://developers.openai.com/plugins/build/plugins)

两者不能随意混搭：portable 根 manifest 存在时，skills 使用固定 `skills/`；兼容 overlay 中的 `skills` 字段不能覆盖它。`extensions.com.openai` 对象出现时，它替代整个兼容 overlay 的 OpenAI 设置，并非逐字段合并。采用哪一种属于宿主兼容选择，不能把新格式自动当成本次必须一起做的迁移。[同一官方包装文档：Manifest fields](https://developers.openai.com/plugins/build/plugins#manifest-fields)

文件应保持在插件根之内：portable Skill 就放 `skills/`；Hook 配置路径以 `./` 开头，相对插件根解析且不能逃逸。不要让安装后的插件依赖仓库外层目录、机器绝对路径或跨插件根 symlink 来取得核心规则；这种安装产物不自包含。[OpenAI：Path rules](https://developers.openai.com/plugins/build/plugins#path-rules)、[OpenAI：Bundled hooks](https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks)

## 4. Hook 的实际职责与 token

`SessionStart`、`SubagentStart`、`UserPromptSubmit` 的 `additionalContext` 会成为额外 developer context。`SessionStart` 的 `compact` 会在根会话压缩后、下一次模型请求前触发。它们能要求模型重新加载 Skill，但“要求已送达”和“正文已读取”是不同证据；当前协议不能替我们保证后者。[OpenAI：Hooks](https://learn.chatgpt.com/docs/hooks)

将 Skill 搬回插件不应改变原来的加载预算：

- 初始上下文先包含 Skill 的名称、描述和 Codex 的路径；完整 `SKILL.md` 在使用时读取。
- references 是否加载取决于 Skill 内声明的任务条件，不会因为在插件里就全部展开。
- 当前官方初始列表预算上限为模型上下文的 2%，上下文大小未知时为 8,000 字符；大量重复入口会竞争这份预算。

这些都是渐进披露规则，不是“插件免费”的承诺。实际 token 仍受描述长度、路径长度、Hook 次数、正文及 references 读取次数影响。同一正文、同样触发条件下，仅改变包装位置没有理由产生数量级的 token 增长；这是结构推断，本轮未做 token A/B 实测。[OpenAI：Build skills](https://learn.chatgpt.com/docs/build-skills)

## 5. 一份源码可同时用于插件与 Skills CLI

以下是拟议结构，不是 `0.5.0` 的现状：

```text
StonePlugins/
├── .agents/plugins/marketplace.json
└── plugins/stonefish-engineering/
    ├── .codex-plugin/plugin.json  或已验收的 portable plugin.json
    ├── hooks/
    ├── assets/
    └── skills/stonefish-engineering/
        ├── SKILL.md
        ├── agents/
        └── references/
```

源码只有插件内这一份；插件安装器打包整个插件，Skills CLI 只提取其中的 Skill。安装副本不是第二份手工维护的源码。无需根目录 mirror、生成模板或跨目录 symlink。

Skills CLI `1.5.26` 可以处理显式 GitHub 子目录地址，也能直接发现所选目录下的 `skills/`。普通容器最多向下查三层；一个较浅层的 `SKILL.md` 会遮蔽更深层；只有没有在常规位置发现 Skill 时，或指定 `--full-depth`，才进行额外递归。因此，当仓库以后有多个插件/skills 时，**显式选择完整插件子目录**比依赖全仓递归回退更稳定。[Skills CLI：README](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/README.md)、[发现实现 `src/skills.ts`](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/src/skills.ts)

当前 Skills CLI 的 manifest 辅助发现只显式解析 `.claude-plugin/marketplace.json` 和 `.claude-plugin/plugin.json`，没有同样解析 `.codex-plugin` 或新 portable 根 `plugin.json`。这不妨碍直接发现插件子目录内的标准 `skills/`，也不是为了 CLI 增加第二份 Claude manifest 的必要理由。CLI 的 `seenNames` 去重属于下载候选发现，不能代替安装后宿主对多个来源的处理。[`src/plugin-manifest.ts`](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/src/plugin-manifest.ts)、[`src/skills.ts`](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/src/skills.ts)

供未来验证的列举命令（需先完成结构改造并发布对应 ref；本轮未执行）：

```sh
npx skills add https://github.com/sty20030818/StonePlugins/tree/main/plugins/stonefish-engineering --list
```

如果未来采用 Grok 独立 Skill fallback，同一 URL 可配合 `--skill stonefish-engineering -g -a grok --copy`，但旧版共享安装需另行处理，不能把这个命令视为自动完成迁移。[CLI 选项](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/README.md)

## 6. 两个必须分清的重复来源

### 下载候选去重不等于宿主去重

Skills CLI 常规发现通过 `seenNames` 去重名称，并通过 `parsedSkillPaths` 避免重复解析路径。它只决定安装候选；Codex 官方明确说两个同名本地 Skill 不合并，可能同时出现在选择器中。安装后的插件 Skill 和独立 Skill 更不应依赖“内容相同，所以宿主肯定自动合并”的假设。[CLI 发现源码](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/src/skills.ts)、[OpenAI：Where Codex loads local skills](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)

### 只选择 Grok，也可能让 Codex 看到独立 Skill

Skills CLI 的默认 symlink 模式先把源码复制到全局 canonical 目录 `~/.agents/skills/<name>`，然后为非 universal agent 建立链接；Grok 的 agent 目录是 `~/.grok/skills`。Codex 本身会扫描 `~/.agents/skills`。所以 `-a grok` 控制安装目标，不构成宿主可见性隔离。[`src/installer.ts`](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/src/installer.ts)、[`src/agents.ts`](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/src/agents.ts)、[Codex 本地加载规则](https://learn.chatgpt.com/docs/build-skills)

源码还说明，Codex 因 project `skillsDir` 为 `.agents/skills` 被当作 universal agent；installer 优先使用 canonical 目录，不能只读 README 表格里的 Codex global 路径就推断实际落点。`--copy` 分支则直接复制到所选 agentDir，跳过 canonical 路径；对仅需 Grok fallback 的新安装，这可避免再次向 Codex 的共享扫描目录写入。[`getAgentBaseDir` 与 `installSkillForAgent`](https://github.com/vercel-labs/skills/blob/d667282815248da03a08a18272b5d2eef9caf77c/src/installer.ts)

已有共享 Skill 的处理有两种真实选择：Codex 通过 `[[skills.config]]` 的精确 `SKILL.md` path 和 `enabled = false` 禁用该本地入口，保留其他宿主使用；或者在核对所有使用者后，将其他宿主迁往自己的副本再停用旧入口。前者由官方配置支持，后者是需要明确迁移检查的方案；本文没有删除或禁用任何已有目录。[OpenAI：Enable or disable local Codex skills](https://learn.chatgpt.com/docs/build-skills#enable-or-disable-local-codex-skills)

## 7. 可行方案比较

| 方案 | 安装体验 | 好处 | 代价及适用条件 |
| --- | --- | --- | --- |
| A. 维持独立 Skill + hooks-only 插件 | Codex 需要分别安装、更新 Skill 和 Hook | 跨宿主共享规则正文，Skill 可独立更新 | 当前真实痛点不变：插件入口没有 Skill、两段安装、缺失依赖；适合优先独立 Skill 发布的用户 |
| B. Codex 完整插件，同源独立 Skill 为可选分发 | Codex 安装完整包；Grok 当前使用私有目录独立 Skill，其他宿主按已验证能力选择 | Codex 一次安装、原生归属、Skill/Hook 同版本；仍保持单一源码和跨宿主能力 | 推荐方向；先处理已知宿主和旧共享入口，不预设所有插件宿主都支持同一 Hook 协议 |
| C. 仅分发完整插件 | 所有消费者均使用原生插件 | 安装、更新和退出最清楚，无第二种分发方式 | 只有全部真实宿主均支持且验收通过时成立；不应凭主观印象放弃其他 CLI |
| D. 完整插件，Hook 注入全部正文 | 插件一次安装，Hook 提供正文 | 不依赖模型先读取核心文件 | 显式 Skill 又读取时可能重复正文；UI 调用不是自动保证；大输出和长会话成本仍存在，不符合本次偏好 |

B 可先保留一个工程核心 Skill，不为模仿 waza 而拆出 learn/review/architecture 等多个公共入口。只有这些工作流具备独立用户目标、输入输出和触发边界时才值得拆；现有条件 references 可继续留在核心 Skill 下。[OpenAI：Define the workflow boundary](https://developers.openai.com/plugins/build/skills#define-the-workflow-boundary)

### Grok：支持完整插件，不等于支持相同的 Hook 注入

本机 `grok plugin` 提供 install、update、validate 和 marketplace；`grok inspect --json` 已发现独立 `stonefish-engineering`，来源为 user，路径为 `~/.grok/skills/stonefish-engineering/SKILL.md`。当前该目录链接到 `~/.agents/skills/stonefish-engineering`，所以迁移前必须保留其使用链路。

对当前 StonePlugins 插件目录运行只读 validate，返回 `No plugin.json found`，然后按标准目录探测，退出码为 0。这不是当前 `.codex-plugin/plugin.json` 已兼容的证明。官方 manifest 搜索顺序是根 `plugin.json`、`.grok-plugin/plugin.json`、`.claude-plugin/plugin.json`；官方 marketplace 也不是我们的 `.agents/plugins/marketplace.json`。[Manifest 实现](https://github.com/xai-org/grok-build/blob/37949780c144e37df692e3d669051a21fec24f20/crates/codegen/xai-grok-agent/src/plugins/manifest.rs#L260-L265)、[Marketplace 实现](https://github.com/xai-org/grok-build/blob/37949780c144e37df692e3d669051a21fec24f20/crates/codegen/xai-grok-plugin-marketplace/src/index.rs#L189-L200)

Grok 官方实现支持完整插件和 `plugin:skill` 入口，但 `SessionStart`、`SubagentStart` 属于 passive hooks，stdout 会被忽略；允许继续的 `UserPromptSubmit` 同样丢弃 stdout / additionalContext。其压缩事件是 `PreCompact`、`PostCompact`，不能套用 Codex 的 `SessionStart source=compact`。因此不能直接共享当前 Hook JSON 与输出脚本，也不应通过 `PostToolUse` 临时补注入，因为它不保证在首次工程决定前执行。[插件组成](https://github.com/xai-org/grok-build/blob/37949780c144e37df692e3d669051a21fec24f20/crates/codegen/xai-grok-pager/docs/user-guide/09-plugins.md#L398-L413)、[Skills](https://github.com/xai-org/grok-build/blob/37949780c144e37df692e3d669051a21fec24f20/crates/codegen/xai-grok-pager/docs/user-guide/08-skills.md)、[Hook 输出限制](https://github.com/xai-org/grok-build/blob/37949780c144e37df692e3d669051a21fec24f20/crates/codegen/xai-grok-pager/docs/user-guide/10-hooks.md#L85-L113)、[Passive hooks](https://github.com/xai-org/grok-build/blob/37949780c144e37df692e3d669051a21fec24f20/crates/codegen/xai-grok-pager/docs/user-guide/10-hooks.md#L476-L478)

本次建议 Grok 先继续同源独立 Skill，并用前述 `--copy -a grok` 避免新建共享扫描来源。若明确要 Grok 也拥有插件更新与限定名入口，再为这个已确认消费者补原生 manifest、激活方式和独立验收。两宿主复用一份规则正文，但各自安装、更新和信任；不承诺一次安装跨应用自动配置。上述 Hook 限制来自当前官方静态证据，本轮没有运行 Grok 模型验证这些事件。

## 8. 采用前的最小验收

| 要证明的行为 | 必需证据 |
| --- | --- |
| 单次插件安装可使用工程规则 | 在没有独立 Skill 的隔离宿主配置中，安装后出现插件所属 Skill，显式调用读取完整核心和一个相关 reference |
| 自动加载有效 | startup/resume、工程用户请求、compact、独立子 Agent 的轨迹分别显示加载提醒及必要的实际读取；已加载上下文避免重复读取 |
| 正文可独立搬运 | 安装产物中的核心、全部 references 和相对链接有效，不依赖源码 checkout 或全局共享目录 |
| 无重复入口 | Codex 只保留一个有效工程入口；Grok 相同名称来源和 native/plugin 的优先级可解释，不能依赖 CLI 列表去重当证据 |
| 安装与更新可追踪 | 同一版本 Plugin 与 Skill 内容来自同一源码 ref；升级后旧路径引用不会静默转向其他缓存；卸载影响符合宿主边界 |
| 独立 fallback 可用 | 固定 Skills CLI 版本列举拟议 plugin 子目录可发现唯一 Skill；隔离路径安装后 references 完整；`--copy` 不创建共享 canonical 副本 |
| token 与输出行为保持 | 同一任务、模型、起始上下文比较初始列表、Hook 文本、核心和 references 的实际读取次数；不只比较 Hook 字节数 |
| Hook 信任仍正确 | 未信任时按宿主规则跳过，信任后触发；升级造成定义变化时遵守审核，不宣称“一次安装”会绕过信任 |

本轮完成的是官方文档与固定源码核查，没有执行上述新结构安装或 token A/B。现有 `0.5.0` 的通过记录不能直接当作新包装方案的通过证据。
