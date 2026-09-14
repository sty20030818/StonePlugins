# StonePlugins：Codex 优先重构计划

日期：2026-09-14。状态：运行时重构、确定性检查、本地 `0.5.1` 安装和核心生命周期验收完成；用户已授权按本次门槛发布。正式验收与实际发布入口由 [v0.5.1 评测](../evals/v0.5.1.md)持有，[候选评测](../evals/codex-first-bundled-development.md)保留首次安装的历史快照。决定依据为 [ADR-0004](../adr/0004-codex-first-bundled-engineering.md)，历史调研不再持有活动建议或待办。

## 目标与基线

最小方案是把现有唯一 Skill 放回完整插件，由现有无状态 Hook 在生命周期读取核心；保留现有主题细则、构建器和验证入口，不新增工作流框架。

当前基线为 `8c518b64f4d03a11d6aaa4233a64b89baf63d302`、`0.5.0`。仓库主路径是 TypeScript、npm、提交生成的 JavaScript Hook，CI 为 Node `22.18.0` / `24`。本轮本机为 Node `24.16.0`、npm `11.13.0`。开始实施前重新核对 Git 状态，保持用户 staged/unstaged 分界，不能把这些快照当作未来状态。

完成目标：Codex 不预装外置工程 Skill，也能通过一次插件安装取得完整工作流；启动、恢复、压缩与独立子 Agent 得到完整核心，细则按需读取；插件入口、源码与缓存资源一致，只有一份有效工程来源。

## 范围与非目标

本次重构包括包装与技术命名、核心送达、全部相关消费者、测试和维护文档。实现涉及超过 8 个文件，这是同一契约的必要连带修改；不能只改 manifest 或搬 Skill。

不做：新增依赖、MCP/网络服务、持久模式数据库、自动安装器、旧缓存兜底、EOF 标记、多宿主 Hook 转换器、为模仿其他项目拆出很多 Skills、为了调用计数重复读取。全局个人规则不并入插件；现有工程正文语义及公开说明格式不借机重写。

用户最新已授权补齐核心生命周期验证后发布 `0.5.1`，包括版本同步、提交、推送、tag、CI 与 GitHub Release；并接受本次 60 次行为/token 对照后置。具体延期与正式验收记录由 [v0.5.1 评测](../evals/v0.5.1.md)持有；未运行项不记为通过，也不把已发布 `0.5.0` 的记录改成新方案通过。

## 固定接口与所有权

| 项目 | 0.5.0 基线 | 目标 |
| --- | --- | --- |
| 品牌 | StonePlugins | StonePlugins |
| marketplace ID | `stonefish` | 保持 `stonefish`，不扩张安装源迁移 |
| 插件 ID / 目录 | `stonefish-engineering` / `plugins/stonefish-engineering/` | `stoneplugins` / `plugins/stoneplugins/` |
| Skill 名与唯一根目录 | `stonefish-engineering` / `skills/stonefish-engineering/` | `engineering` / `plugins/stoneplugins/skills/engineering/` |
| Codex 限定入口 | 外置 Skill，无插件限定入口 | `stoneplugins:engineering`，由真实宿主发现确认 |
| 安装选择器 | `stonefish-engineering@stonefish` | `stoneplugins@stonefish` |
| 私有 npm 根包名 | `stonefish-codex-plugins` | 保持，不影响插件命名空间 |
| 插件格式 | `.codex-plugin/plugin.json` | 继续使用当前受支持格式，增加包内 `skills` 声明 |

目标包包含现有的 `.codex-plugin`、assets、hooks、src、ESM package，以及 `skills/engineering/` 下核心、agents metadata 和五份 references。只有这份 Skill 可编辑；其他 CLI 的独立安装直接选择此子目录，不保留根目录 mirror、symlink 源或旧插件目录作为长期兼容入口。

包装决定不要求换成新的 portable manifest。现有格式仍受支持，未来宿主适配不反向增加当前实现成本。[OpenAI 包装规则](https://developers.openai.com/plugins/build/plugins)

## 核心送达契约

1. 继续使用一个 Hook 源入口及构建生成物。从实际运行脚本所在的插件根解析唯一 Skill 文件，不从用户项目 cwd、全局 Skill 或旧版本缓存搜索正文。
2. SessionStart 的 startup、resume、clear、compact，以及 SubagentStart，读取完整 Skill，校验 frontmatter 和非空核心，移除 frontmatter 后完整送达正文。不要读取并展开五份 references。
3. 输出包含当前安装的 Skill 文件位置和资源解析基准，并明确核心已通过本次上下文送达、仅适用于工程决定。同一有效上下文不为展示调用再次读同份核心；显式 Skill 入口及未完整送达时的正常读取仍保留。
4. UserPromptSubmit 保留短执行提醒，输出不超过当前 300-byte 提醒预算；不读 prompt/transcript 做关键词路由，也不复制核心。新工程事实仍可触发相应 reference。
5. 生命周期 additionalContext 采用单一内部上限 **8,000 UTF-8 bytes**；超限显式失败，不能截取后假装完整。保留 Codex 默认约 **2,500 tokens** 的有限阈值，不设 `additionalContextLimit: 0`。字节预算不是 tokenizer 或宿主完整性的证明，必须同时通过实际送达检查。
6. 核心缺失、不可读、frontmatter 损坏、正文为空或超预算时，只输出脱敏错误与明确的工程暂停要求，不回显原始输入，不自动安装、不回退硬编码旧规则。宿主是否阻断和 Agent 是否执行暂停分别验证；SubagentStart 不能通过 `continue:false` 保证机械阻断。
7. 保持单个合法 JSON 输出、合理超时和无运行时 npm 依赖。不为生成路径或展示版本额外依赖旧 manifest 读取流程；现有 `${PLUGIN_ROOT}` 仅用于宿主找到 Hook 入口。

最脆弱的前提是：精简核心可在实际 Codex 上完整送达，且减少读取依赖带来的收益足以覆盖非工程会话和部分继承上下文的重复成本。当前文件约 5.5 KB，为初始预算提供依据，但不能据此宣布该前提成立。失败时保持现有安装，停止切换并重新审议，不制造长期双模式。

[官方 Hooks](https://learn.chatgpt.com/docs/hooks) 支持 compact 后、下一次模型请求前的 SessionStart 送达；不为同一目的再注册 PostCompact。安装完整与 Hook 信任、正文完整与规则落实均是不同验收项目。

## 一个原子代码变更集

以下是一组必须一起完成的仓库改造，不拆成“先搬文件但调用方还没改”的可发布阶段。中间工作态不发布；完成后即使不进行本机安装迁移，仓库本身也可独立构建和验证。

| 消费者 | 必须同步的修改 |
| --- | --- |
| marketplace 与插件 manifest | 插件名称、source.path、展示文案、包内 `skills: ./skills/`；保留默认 hooks 文件发现，不再重复声明同一配置 |
| Skill 树 | 将整个现有目录移入目标插件；改 frontmatter name、技术调用标识、agents/openai.yaml 的展示及默认提示；五份细则保持语义 |
| Hook 源码与配置 | 实现上述正文送达和错误契约，保留三种生命周期事件；构建生成新的 hooks/inject-context.js，不手改生成物 |
| tsconfig.json、tsconfig.hook.json | 更新 include、rootDir、outDir 对应插件目录 |
| tests/inject-context.test.ts | 更新根路径与缓存 fixture，替换旧“所有事件都禁止正文且≤300 bytes”的断言，保留输入与脱敏负例 |
| scripts/validate-repository.ts | 分开插件名与 Skill 名；SKILL_ROOT 指向包内；替换“禁止插件带 Skill”为“唯一包内 Skill、完整资源、无旧入口”；更新名称、README、example 和 Hook 契约检查 |
| .github/workflows/validate.yml | 更新 manifest 版本路径、生成物 Git 跟踪与重建 diff 路径；保留现有 Node 矩阵及 npm 入口 |
| README、examples/AGENTS.stonefish.md、docs/methodologies.md | 真正实现后才切换活动路径与安装说明；个人示例只保留调用方式与边界，不复制工程正文 |
| 文档与评测 | 更新 ADR 实施状态和本计划进度，新增 codex-first-bundled-development.md 保存候选原始证据；不重写旧版本结果 |

validator 仍验证版本一致、ESM 缓存运行、精确 Hook 允许列表、资源存在/发布跟踪和关键工程语义。旧 ADR 与研究只是历史证据，不再用其固定实现形状阻止目标；引用存在检查可保留，不为清理历史移动或删除它们。

## 验证与停止条件

### 确定性检查

- 正常：四类 SessionStart source 和 SubagentStart 的正文，完整等于源 Skill 去 frontmatter 的结果；prompt 单独满足短预算。
- 输入：BOM、空输入、非对象、非法 JSON、未知事件、constructor/__proto__、额外字段；不泄漏 prompt 或 transcript 中的哨兵秘密。
- 资源：完整插件复制到含空格的临时缓存后可运行；没有仓库 checkout 或全局 Skill 仍可解析全部细则；资源不能逃逸插件根。
- 故障：缺少/不可读 Skill、破损 frontmatter、空核心、缺失必要结构、超预算；单一安全 JSON，不截断为成功、不静默回退。
- 重建：保留官方 Skill/插件结构检查；候选提交的干净 checkout 构建后无生成物漂移。开发态新生成物相对旧 HEAD 的正常差异不能误判为漂移。

根级验证入口：`npm run check`、`git diff --check`。本次提交/发布已获授权，新文件按已授权范围和正常流程进入 Git 跟踪后，再执行 `npm run validate:release`；仍须保持任务外用户修改及暂存分界。

### 宿主验收

在隔离安装配置中只装新完整插件，不预装外置 Skill；审查并信任三类 Hook，分别记录 startup、UserPromptSubmit、SubagentStart、resume、clear、compact。安装完成、Hook 输出、宿主收到完整正文、实际按需读取细则和规则落实分别留证。

核对原生入口只有一个；检查手动 Skill 调用、纯聊天、继承父历史的子 Agent，以及升级后缓存路径变化。纯聊天不产生工程任务/披露；已完整收到核心时不为技能徽标重复读取。无须保证 Hook 每次都被 UI 计为技能使用。

复用 [十个行为案例及评分](../evals/behavior-cases.md)，每侧至少三次，无关键失败、无实质行为回归。整体对比当前 `0.5.0` 与候选，分别报告包装/加载共同变化的影响；若要隔离加载策略，可在临时测试配置中使用候选同包 Skill 的短提醒对照，但不能发布两套实现或增加产品配置开关。

仅本次 `0.5.1`：用户已接受上述十个案例 × 两侧 × 三次的 60 次行为/token 对照后置，不将其未运行作为本次发布阻断。完整评分、无实质行为回归与 token 收益仍属未验证，不以延期代替 PASS；核心生命周期、资源可达和其他必需检查仍须完成。延期范围、实际证据及后续状态统一记录于 [v0.5.1 评测](../evals/v0.5.1.md)，不改变未来版本的默认评测要求。

记录原始输入、模型与 reasoning、有效指令、源文件 hash、收到的核心、reference 读取、工具往返、输入 token 与缓存口径。旧 token 数或 Hook 字节数不能代替新方案账单证据。出现核心遗漏、资源失联、用户 Git 边界破坏、伪造验证或明显成本回归，停止安装迁移，先修复或重新审议。

## 安装迁移与发布

本地安装试验与 `0.5.1` 发布均已获授权。用户已确认重启并信任 Hook，继续补齐核心生命周期及版本产物验收，再执行发布；不得把用户信任确认替代正文完整送达证据，也不宣称后置的行为/token 对照通过。不影响尚未迁移用户继续使用已发布 `0.5.0`。

1. 先盘点当前插件、Hook 来源、Skill 注册、共享目录使用者，以及用户曾从 README 合入全局/项目规则文件的旧加载条款，记录旧版本固定来源与可恢复配置；不要修改 Hook 信任哈希。特别搜索 `stonefish-engineering`、compact 必须重读和旧缓存绝对路径，不能只查插件清单。
2. 在隔离环境验证候选。要更新真实安装时，先停止旧 Hook/插件，再启用新插件，不能在同一活动任务并行两份注入。CLI 当前支持 `codex plugin remove stonefish-engineering@stonefish` 和 `codex plugin add stoneplugins@stonefish`；只有目标已在选定 marketplace ref 中且获授权后才能执行。
3. 默认通过 Codex 的精确 Skill path 禁用旧外置工程入口，保留其他 CLI 正在使用的共享目录及链接；不直接删除共享 Skill。若存在旧强制加载条款，仅在获授权后修改 Codex 适用部分，改为新入口以及核心已完整送达可沿用的语义，防止继续强制读取已禁用名字；不覆盖个人规则或其他 CLI 的条款。共享规则文件无法区分宿主时先确认拆分边界，不静默改写。若改用其他 CLI 私有副本，先逐个验证其独立安装，再另行清理旧来源。
4. 其他 CLI 的新独立安装从目标插件子目录选 `engineering`。Grok 的 `--copy -a grok` 可避免再次创建共享扫描来源；迁移要核对旧名字和同名冲突，不能靠“只选择 Grok”假设 Codex 看不到共享目录。
5. 新任务中重新审核 Hook，并回读版本、唯一入口、完整核心和细则路径。旧任务的已加载上下文不是新安装证据，必要时由用户重启后验收。
6. 按本次已授权的 `0.5.1` 同步根 package、lock、插件 manifest、CHANGELOG、固定 ref 安装示例和对应评测；完成本次必需验收后执行现有提交、推送、tag、CI、GitHub Release 流程。首次远端写入前重新核对目标与状态；CI 只验证，不自动创建 Release。

回退不涉及业务数据：在获授权后停止候选插件，按已记录固定版本恢复旧插件/独立 Skill 及本次改变的配置，重新信任并开启新任务；不回滚用户其他配置、不 stash/reset 用户代码。代码阶段只回退本变更集，未授权时不重写历史。

## 文档治理完成项

- 本计划持有执行步骤、迁移和待办；ADR-0004 只持有决定及取舍。
- README 区分仍在运行的 `0.5.0` 与新目标；CONTEXT 只维护不绑定实现的术语。
- ADR-0001/2 保留有效原则和历史状态；ADR-0003 的三条偏移实现约束不再作为长期门禁。
- 研究和版本评测原位归档，不删除原始依据、不重写旧失败，不将历史未完成清单当活动待办。
- 行为案例保持十个任务与评分，正文完整送达替代“任何加载方式都必须产生文件读取”的长期前提。

## 后置适配待办

- [ ] Claude 原生插件与 Hook：Codex 方案验收完成且用户要求适配后再启动；当前仅独立 Skills，不纳入本次交付门槛。
- [ ] Grok 原生插件与 Hook：同上；启动时按其真实 manifest、生命周期和输出契约验证，不能原样复用 Codex 注入协议。

这些是本计划唯一的跨宿主活动待办，不创建定时任务，也不承诺未经后续请求自动安装或发布。
