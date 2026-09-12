# 石头鱼的工程规则与 Codex 插件

`stonefish-engineering` 把长期维护、正确职责边界、简洁架构和证据验证组成一份常驻工程执行契约。完整规则作为独立 Skill 安装；Codex Hook 插件负责在生命周期中要求 Agent 加载它，让用户不再为每个工程请求重复追加方法论。

> 规则正文和插件说明以中文为主，Skill 展示名为 `Stonefish Engineering`，技术标识保持 `stonefish-engineering`。这些规则会尊重项目上下文，不会把作者个人的语言、称呼、包管理器或项目约定强加给其他用户。

## 石头鱼的工程规则

规则与加载要求分别由两个组件持有：

- [独立 Skill](skills/stonefish-engineering/SKILL.md)：完整核心契约和 references 位于根目录 `skills/stonefish-engineering/`，是运行时规则的唯一来源，允许隐式调用。
- Hook 插件：位于 `plugins/stonefish-engineering/`，不再携带或注册 Skill，也不注入规则正文。
- `SessionStart`：startup、resume、clear 只在工程正文缺失时要求加载；`source: "compact"` 在压缩后的下一次模型请求前要求无条件重新完整读取，不重复注册 `PostCompact`。
- `SubagentStart`：提醒子 Agent 的上下文独立；工程任务必须自行加载核心，不能沿用父 Agent 的加载声明。
- `UserPromptSubmit`：每轮发送精简的语义边界提醒，不读取提示内容做关键词路由，也不回显用户输入。
- 所有任务继续遵守各宿主的全局协作规则。需要改变或评价软件行为、代码、配置、依赖、数据、接口、测试、架构或发布的任务加载工程 Skill；边界不清时按工程任务处理。同一有效上下文已完整加载时不重复读取，references 仍根据事实按需加载。
- Skill references：根据项目事实按需读取[条件方法选择](skills/stonefish-engineering/references/method-selection.md)、架构、修改边界、验证和[公开决策说明](skills/stonefish-engineering/references/decision-summary.md)。
- [方法论目录与治理](docs/methodologies.md)：保存完整方法目录、来源、冲突和晋升规则，不参与每轮运行时注入。

多个来源的同事件命令 Hook 可能并发运行，完成顺序不保证；每个事件的加载要求都自包含，不依赖其他 Hook 先后顺序。`additionalContextLimit` 是 Hook 上下文触发落盘预览的近似 token 阈值，不是字节上限，也不证明 Skill 已加载。事件语义以 [OpenAI Docs 的 Hooks 文档](https://learn.chatgpt.com/docs/hooks) 为准。

Hook 契约与方法论取舍的形成过程保留在 [工程规则审计](docs/research/2026-08-27-stonefish-engineering-audit.md)、[方法论研究](docs/research/2026-08-27-methodology-index-and-routing.md)、[决策透明度研究](docs/research/2026-08-28-methodology-disclosure-and-decision-transparency.md)、[决策文案研究](docs/research/2026-08-29-engineering-rationale-copy-structure.md) 和[常驻行为研究](docs/research/2026-08-31-persistent-engineering-rules-and-evaluation.md)中。当前开发态行为以核心 Skill、references、[行为评测集](docs/evals/behavior-cases.md)、测试和 [ADR-0003](docs/adr/0003-independent-skill-and-loader-hooks.md) 为准；[ADR-0002](docs/adr/0002-persistent-execution-contract.md) 的常驻契约语义继续保留。

`docs/research/` 和按版本命名的 `docs/evals/v*.md` 是历史快照，其中旧目录和全文注入方式只描述当时版本。[v0.4.1 发布评测](docs/evals/v0.4.1.md)不证明本次拆分改造通过。

核心倾向：

- 所有常驻方法共同参与理解、设计、实施和验证：第一性原则、正确所有者、SRP、高内聚低耦合、模块化、知识级 DRY、KISS/YAGNI、长期单轨、因果范围和风险相称证据。
- 整洁架构与六边形架构的领域独立、依赖方向和边界原则始终参与设计；Port、Adapter、DDD、迁移模式等具体结构只在真实信号出现时采用。
- 知识级 DRY 让同一业务知识只有一个权威来源，不把变化原因独立的相似代码强行合并。
- 可以主动推荐破坏性长期方案；实际执行仍需满足消费者、迁移、数据、恢复和当前授权。
- 外科手术式修改限定因果范围，Boy Scout Rule 只改善范围内阻碍正确实现或验证的结构。
- 失败测试不能靠弱化断言、跳过或盲目重试变绿；完成声明区分实际验证、静态推断和待人工验收。
- 存在实质工程决定时，用“事实 → 方法作用 → 决定 → 影响与取舍”解释石头鱼的工程规则如何形成方案；完整常驻契约始终共同生效，公开说明只展开可观察影响。

**加载要求送达、规则正文加载、规则落实**是三种证据：Hook 单元测试证明输出协议，真实客户端记录证明要求送达，完整读取轨迹证明正文加载，固定工程案例评测产物中的规则落实。CLI 是否显示技能调用或累计使用次数由宿主决定；计数、Hook 成功或加载要求出现都不能互相替代，也不能证明规则已落实。命令权限、不可逆操作和 CI 仍由 Codex 审批、沙箱、`.rules` 和项目检查负责。

## 安装

先安装 Skill，再安装 Hook 插件。需要：

- 使用 `npx skills` 或 `bunx skills` 安装独立 Skill；本次验证的 Skills CLI `1.5.24` 要求 Node.js 22.20 或更高版本；
- Hook 插件需要支持 Plugins 和 Hooks 的当前 Codex CLI 或 ChatGPT 桌面版 Codex；
- Hook 运行环境的 `PATH` 中存在 Node.js 22.18 或更高版本。

当前稳定版本为 `0.5.0`，用于独立 Skill 与 Hook 分发。未从 GitHub 安装时，可先在本仓库根目录安装本地 Skill：

```bash
npx skills add . --skill stonefish-engineering -g -a codex -a grok
```

本地目录来源不能当作可从 GitHub 更新的安装记录；要转为远端更新，按下面的远端命令重新安装并确认来源。隔离本地安装与核心加载记录见[开发态验证](docs/evals/independent-skill-development.md)，`0.5.0` 的候选证据见[候选验证](docs/evals/v0.5.0.md)。

从 GitHub 安装 Skill：

```bash
npx skills add sty20030818/StonePlugins --skill stonefish-engineering -g -a codex -a grok
```

上述命令也可将 `npx` 换成 `bunx`。根目录布局可被默认发现，不需要 `--full-depth`；`-a codex -a grok` 选择两个 Skill 安装目标，Hook 插件仍只面向 Codex。命令语法见 [Skills CLI 官方说明](https://github.com/vercel-labs/skills#readme) 和 [Bun 的 bunx 文档](https://bun.com/docs/pm/bunx)。

然后检查 Node 并安装对应新版 Hook 插件：

```bash
node --version
```

```bash
codex plugin marketplace add sty20030818/StonePlugins --ref main
codex plugin add stonefish-engineering@stonefish
```

安装后：

1. 启动一个新任务。
2. 在 Codex 中打开 `/hooks`。
3. 审查并信任 `SessionStart`、`SubagentStart` 和 `UserPromptSubmit` 三个 Hook。
4. 确认可用 Skill 中只有一份 `stonefish-engineering`，并核对实际安装路径。
5. 再开一个工程任务，分别检查 Hook 加载要求、完整 `SKILL.md` 读取轨迹和按需读取的 references。

插件安装不会自动信任 Hook；Hook 内容变化后也可能需要重新审查。旧版插件自带 Skill，升级必须替换旧缓存后再启用新版，不能同时保留同名 Skill 的两份注册或让旧全文 Hook 与新加载 Hook 一起运行。

## 使用

安装并信任后，Hook 持续要求工程任务加载 Skill；Skill 自身设置 `allow_implicit_invocation: true`，宿主也可以按任务选择它。当 Hook 未信任、被禁用、运行失败、宿主不支持 Hooks，或需要主动重读规则时，可以显式调用：

```text
$stonefish-engineering 按石头鱼的工程规则处理这个重构，并加载匹配的参考文件。
```

显式调用只影响当前任务，不能替代生命周期提醒。Skill 缺失、不可读或加载失败时，Agent 应明确说明并暂停依赖该规则的工程决定，不能声称已加载；不自动下载或安装 Skill，也不回退到旧插件缓存中的正文。

插件不会自动改变你的全局 `AGENTS.md`。工程方法论与最佳实践由独立 Skill 维护；全局文件适合保留日常交互、权限、Git 边界、项目工具优先和 Bun 等个人偏好，避免复制规则正文形成第二事实源。作者示例位于 [examples/AGENTS.stonefish.md](examples/AGENTS.stonefish.md)，仅供选择性合并。

也可以将以下短约定加入各 CLI 实际使用的全局规则文件；请先确认对应 CLI 的规则路径。本仓库只提供示例，不自动写入配置：

```text
所有任务继续遵守全局协作规则。需要改变或评价软件行为、代码、配置、依赖、数据、接口、测试、架构或发布时，通过宿主 Skill 入口完整加载 stonefish-engineering 的 SKILL.md；边界不清时加载，同一有效上下文已完整加载时不重复读取。压缩后重新完整读取。找不到 Skill 或读取失败时明确报告并暂停依赖该规则的工程决定，不自动安装或回退旧缓存。
```

## 更新与旧版迁移

独立 Skill 使用 Skills CLI 更新；远端安装来源必须已经包含本次改造。要保持 Codex/Grok 两个安装目标，重复执行带明确目标的安装命令即可更新内容：

```bash
npx skills add sty20030818/StonePlugins --skill stonefish-engineering -g -a codex -a grok
```

也可以将 `npx` 换成 `bunx`。Skills CLI `1.5.24` 的 `skills update stonefish-engineering -g` 会重新检测宿主，不保证保留初次安装的目标范围，见[上游更新实现](https://github.com/vercel-labs/skills/blob/1682051d48c34f5eb135e6475c1a965dce05e820/src/update.ts#L710-L712)。更新 Skill 不会更新 Hook 插件；Hook 仍通过 Codex marketplace 更新：

```bash
codex plugin marketplace upgrade stonefish
codex plugin add stonefish-engineering@stonefish
```

从旧版迁移时，先安装独立 Skill，再替换带有旧 Skill 的插件缓存。检查 `/hooks` 的来源并停用曾手动写入全局或项目配置的旧副本，确认只有新版插件的三个 Hook，且没有同名 Skill 重复注册，再启动新任务。若 Hook 定义的 hash 发生变化，重新审查和信任；本仓库不会自动修改全局配置。

停用时先禁用或卸载 Hook 插件，再按需移除独立 Skill；只移除 Skill 而保留 Hook，会按设计暂停依赖该规则的工程决定。升级失败时不要继续使用旧新混合状态，先停用 Hook 并核对实际安装来源。

日常远端安装跟踪仓库来源，Hook marketplace 示例显式跟踪 `main`；版本历史使用 Git tag 与 GitHub Release。旧 `v0.4.1` tag 不包含本次改造，不能用它验证新版安装流程。正式创建 `v0.5.0` tag 后，才可使用以下固定版本示例；固定来源不跟随 `main` 更新：

```bash
codex plugin marketplace add sty20030818/StonePlugins --ref v0.5.0
codex plugin add stonefish-engineering@stonefish
```

## 隐私与安全

- Hook 不联网、不写日志、不保存状态。
- `UserPromptSubmit` 不使用用户 prompt 做路由，也不会把它回显到输出。
- Hook 不读取或输出规则正文；Skill 的发现与加载由 Agent 和宿主完成。
- Hook 入口校验输入，失败只输出不含原始输入的安全错误标识，不读取插件 manifest，也不绑定用户安装路径。Hook 正常返回不证明 Skill 已安装、可读或已加载；若 Node 在入口执行前退出，需要修复运行环境或重新安装插件。

## 本地开发

插件运行时没有 npm 依赖。仓库开发使用 TypeScript，首次检查先安装开发依赖：

```bash
npm ci
npm run check
```

Hook 源码是 `plugins/stonefish-engineering/src/inject-context.ts`；`npm run build` 会生成安装时实际执行的 `hooks/inject-context.js`，插件自己的 `package.json` 保证它进入独立缓存后仍按 ESM 运行。不要直接编辑生成物。三个生命周期事件共用这个无状态入口，因为输入校验、错误脱敏和输出协议相同；只有某个事件出现独立依赖或复杂流程时才拆分。完整 Skill 仅维护在 `skills/stonefish-engineering/`，不要再复制进插件目录。

发布新版本时：

1. 同步更新根 `package.json`、`package-lock.json` 与 `.codex-plugin/plugin.json` 的 SemVer。
2. 更新 `CHANGELOG.md`。
3. 规则语义或加载流程变化时重放 [固定行为案例](docs/evals/behavior-cases.md) 并新增对应版本评测；完成独立 Skill 安装/更新、旧缓存替换，以及 startup、逐轮、子 Agent、resume、clear 和 compact 的真实客户端冒烟，分开记录要求送达、正文加载和行为落实。
4. 运行本地验证并等待 GitHub Actions 通过；普通分支运行常规校验，发布 tag 额外运行 `validate:release`，发布前需补齐与版本一致的固定安装示例及版本评测。
5. 创建与 manifest 相同版本的 tag，再创建 GitHub Release。

## 许可

[MIT](LICENSE)
