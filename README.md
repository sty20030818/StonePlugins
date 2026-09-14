# StonePlugins：石头鱼的工程规则

StonePlugins 把长期维护、正确职责边界、简洁架构和证据验证组成一份常驻工程执行契约。Codex 插件同包提供 Skill、条件细则和生命周期 Hook；其他 CLI 可以独立安装同源 Skill。

## 当前状态

`v0.5.1` 改为 Codex 优先的完整插件：一次安装取得工程 Skill、五份细则和生命周期 Hook。Skill 展示名为 `Engineering`，限定入口为 `$stoneplugins:engineering`。从 `v0.5.0` 升级涉及插件 ID 和 Skill 来源迁移，请勿直接叠加启用旧插件。

本版本的实际验收记录见 [v0.5.1 验证](docs/evals/v0.5.1.md)。核心生命周期验证是发布门槛；60 次行为/token 对照经用户确认后置，不声称新方案已证明行为等价或节省 token。设计依据见 [ADR-0004](docs/adr/0004-codex-first-bundled-engineering.md)，迁移和后置适配见[重构计划](docs/plans/2026-09-14-codex-first-refactor.md)，历史资料见[文档索引](docs/README.md)。

## 规则与加载

唯一正文位于 [plugins/stoneplugins/skills/engineering/SKILL.md](plugins/stoneplugins/skills/engineering/SKILL.md)。插件 ID 为 `stoneplugins`，Skill 名为 `engineering`，Codex 限定入口为 `$stoneplugins:engineering`；marketplace ID 仍为 `stonefish`。对话中称为“石头鱼的工程规则”，不把作者的语言、称呼或包管理器偏好强加给其他用户。

- `SessionStart` 的 startup、resume、clear、compact，以及 `SubagentStart`，从实际运行的插件缓存读取包内 Skill，移除 frontmatter 后送达完整核心，并给出当前资源路径；不展开五份 references。
- `UserPromptSubmit` 每轮只发送不超过 300 UTF-8 bytes 的执行提醒，不根据用户提示关键词路由，也不重复注入核心。
- 工程任务沿用当前上下文已完整收到的核心，根据新事实按需读取[条件方法选择](plugins/stoneplugins/skills/engineering/references/method-selection.md)、架构、修改边界、验证和[公开决策说明](plugins/stoneplugins/skills/engineering/references/decision-summary.md)。不为显示调用徽标重复读取同一核心。
- 所有任务继续遵守宿主的全局协作规则；纯聊天、翻译等非工程任务不因此变成工程任务，也不强制输出工程决策说明。
- [方法论目录与治理](docs/methodologies.md)用于维护和研究，不参与运行时注入。

生命周期上下文上限为 8,000 UTF-8 bytes；超限显式失败，不截断后声称成功。这不是 tokenizer 计数，也不保证宿主完整接收。Codex 的 `additionalContextLimit` 仍用默认有限阈值，没有设为 `0`。多个同事件命令 Hook 可能并发，不能依赖完成顺序。宿主协议见 [OpenAI Hooks 文档](https://learn.chatgpt.com/docs/hooks)。

规则的核心倾向不因包装变化而改变：

- 常驻方法共同参与理解、设计、实施和验证：第一性原则、正确所有者、SRP、高内聚低耦合、知识级 DRY、KISS/YAGNI、长期单轨、因果范围和风险相称证据。
- 整洁架构与六边形架构的领域独立、依赖方向和边界原则常驻；Port、Adapter、DDD 和迁移模式等具体结构只按真实信号增加。
- 可以推荐破坏性长期方案，但实施仍受消费者、迁移、数据、恢复和当前授权约束。
- 不靠弱化断言、跳过测试或盲目重试制造通过；实质工程决定按“事实 → 方法作用 → 决定 → 影响与取舍”说明可观察作用。

**插件已安装、Hook 输出、宿主完整接收、规则落实**是不同证据。单元测试不能替代真实客户端轨迹或行为评测；调用徽标、使用次数也不能证明规则落实。命令权限、不可逆操作和 CI 仍由 Codex 审批、沙箱、`.rules` 和项目检查负责。

## 安装

需要支持 Plugins 和 Hooks 的 Codex，以及在 `PATH` 中可用的 Node.js 22.18 或更高版本。Hook 运行时没有 npm 依赖。

### Codex：一次安装完整插件

以下固定版本命令面向**尚未配置 `stonefish` 来源、未安装旧工程插件**的新用户：

```bash
node --version
codex plugin marketplace add sty20030818/StonePlugins --ref v0.5.1
codex plugin add stoneplugins@stonefish
```

不需要另跑 Skills CLI 给 Codex 安装 `engineering`，插件包已经包含核心、元数据与细则。开发试验可在仓库根目录使用 `codex plugin marketplace add .`；本地来源与 GitHub 来源不能在同一 marketplace ID 下混用，固定 ref 也不会自动跟随未来版本。

安装后，在新任务中审查并信任 `SessionStart`、`SubagentStart`、`UserPromptSubmit` 三个 Hook，核对原生入口 `$stoneplugins:engineering` 和资源位置；再分别验证生命周期送达、完整核心和按需读取细则。插件安装不自动信任 Hook，配置变化后可能需要重新审核。当前任务里已加载的旧上下文不能作为新安装验收证据。

如果已经安装旧版，不要直接叠加运行；先按下面的迁移顺序核对来源。

### 其他 CLI：只安装同源 Skill

检出 `v0.5.1` 后，在仓库根目录中以 Grok 为例：

```bash
npx skills add ./plugins/stoneplugins --skill engineering -g -a grok --copy
```

可以将 `npx` 换成 `bunx`。此处直接选择插件目录内的同源 Skill，`--copy` 避免额外建立 Codex 也会扫描的共享 Skill 来源；不安装 Codex Hooks。其他宿主应选其实际支持的安装目标，Claude/Grok 原生工作流适配不属于本版本。命令说明见 [Skills CLI](https://github.com/vercel-labs/skills#readme)。

独立安装后的入口为 `$engineering`，不带 Codex 插件限定名。不要删除其他 CLI 仍在使用的旧共享目录或链接；旧名字和新名字的迁移须逐个核对。

## 使用与失败边界

安装并信任后，生命周期 Hook 负责送达核心；Skill 保留 `allow_implicit_invocation: true`，也可以显式调用：

```text
$stoneplugins:engineering 按石头鱼的工程规则处理这个重构，并加载匹配的参考文件。
```

核心未完整送达时，通过正常 Skill 入口完整加载；已经完整收到时不为调用展示重复读取。独立 CLI 没有这些 Hook，需要由其 Skill 入口加载，压缩后重新确认完整核心。

包内 Skill 缺失、不可读、frontmatter 损坏、核心为空、缺少必要结构或超过预算时，Hook 输出脱敏错误与工程暂停要求。不自动安装、不回退旧缓存或硬编码规则。暂停要求仍需 Agent 遵守，不能把错误输出当作宿主已经机械阻断；若 Node 在入口执行前失败，则需先修复运行环境。

插件不修改全局 `AGENTS.md`。工程规则只在包内维护；全局文件继续承载日常交互、权限、Git 分界和工具偏好。作者的[个人规则示例](examples/AGENTS.stonefish.md)仅供选择性合并，不应复制核心形成第二来源。

## 更新与旧版迁移

升级前先记录已有 `stonefish` marketplace 的来源、旧插件、共享 Skill 使用者和可恢复配置。切换来源会影响这个 marketplace 的后续更新，不能仅凭相同 ID 假定本地目录与远端来源等价。具体执行与验收记录见[重构计划](docs/plans/2026-09-14-codex-first-refactor.md)及 [v0.5.1 验证](docs/evals/v0.5.1.md)。

迁移顺序：

1. 验证新包和目标安装来源，然后停止旧 `stonefish-engineering@stonefish` 插件，再启用新 `stoneplugins@stonefish`，避免两个 Hook 同时注入。
2. 通过 Codex 的精确 Skill 路径配置禁用旧外置工程入口；保留其他 CLI 使用的共享文件及链接。只改明确属于 Codex 的旧强制加载约定，不覆盖个人规则。
3. 开启新任务，重新审核 Hook，检查唯一入口、当前缓存路径、完整正文与细则。验收失败时停止切换，不维持新旧混合状态。

本地来源更新时，先更新对应 checkout，再执行 `codex plugin add stoneplugins@stonefish`；版本变化后回读缓存和 Skill 入口。GitHub 固定 ref 来源需显式切换到目标版本，不能假定重新安装会自动升级。其他 CLI 可重复执行上面的明确目标安装命令，更新其副本不会更新 Codex 插件。

### 已发布 v0.5.0 的历史安装

旧版采用两步安装，完整说明保留在 [v0.5.0 README](https://github.com/sty20030818/StonePlugins/blob/v0.5.0/README.md)。旧 Hook 的固定版本来源如下；这是旧实现或回退使用的示例，且依赖旧外置 `stonefish-engineering` Skill 已安装：

```bash
codex plugin marketplace add sty20030818/StonePlugins --ref v0.5.0
codex plugin add stonefish-engineering@stonefish
```

不能与新插件并行启用。回退须恢复事先记录的插件与 Skill 配置，重新信任并开新任务；不恢复或覆盖用户的其他配置。

## 隐私与安全

- Hook 不联网、不写日志、不保存状态。
- 不读取 transcript，也不使用或回显用户 prompt；只验证输入事件并读取当前包内核心。
- 从实际运行脚本位置解析同包资源，不信任项目 cwd 或用户传入的 `PLUGIN_ROOT` 来查找正文，不搜索其他版本缓存。
- 失败只输出安全原因；无自动下载、权限扩张、信任哈希修改或安装器。

## 本地开发与发布

沿用 TypeScript、npm 和现有构建流程：

```bash
npm ci
npm run check
```

源码为 `plugins/stoneplugins/src/inject-context.ts`；`npm run build` 生成实际执行的 `hooks/inject-context.js`，同包 `package.json` 保证缓存中仍按 ESM 运行。不要手改生成物。唯一 Skill 树为 `plugins/stoneplugins/skills/engineering/`，不保留根目录镜像、旧插件或兼容副本。

发布另行授权后，同步根 package、lock、插件 manifest、CHANGELOG、固定 ref 示例与版本评测。按[十个行为案例](docs/evals/behavior-cases.md)和全部生命周期保留原始证据，区分字节预算、模型 token、缓存口径、正文完整与行为落实。新文件按正常流程进入 Git 跟踪后再运行 `npm run validate:release`，不能为使检查通过擅自暂存。

推送候选提交和与 manifest 相同版本的 tag，等待该 tag 的 CI 通过，再创建并回读 GitHub Release；CI 验证不会自动发布。历史研究与版本评测原位归档，不重写旧结果为新版本通过。

## 许可

[MIT](LICENSE)
