# 石头鱼 Codex 插件

一个可通过 GitHub 安装和升级的 Codex marketplace。首个插件 `stonefish-engineering` 提供一套重视长期维护、控制改动范围并用证据验证结果的工程规则。

> 规则正文和插件说明以中文为主，Skill 展示名为 `Stonefish Engineering`，技术标识保持 `stonefish-engineering`。这些规则会尊重项目上下文，不会把作者个人的语言、称呼、包管理器或项目约定强加给其他用户。

## 石头鱼的工程规则

规则通过三类 Hook 自动注入，并通过 Skill references 按需加载细则：

- `SessionStart`：在会话启动、恢复、清空或压缩后注入核心 Skill 正文；官方 `source: "compact"` 会在压缩后的下一次模型请求前触发，不重复注册 `PostCompact`。
- `SubagentStart`：只注入同一核心 Skill 正文，不展开 references；每个子 Agent 独立注入，成本会随数量线性增长，大量短任务可在 `/hooks` 关闭此事件，但子 Agent 将不再收到核心规则。
- `UserPromptSubmit`：每轮注入同一条短提醒，不根据提示内容做启发式匹配，也不回显用户输入。
- Skill references：仅在匹配任务中读取架构、修改边界和验证细则。
- [方法论索引](plugins/stonefish-engineering/skills/stonefish-engineering/references/methodology-index.md)：只在同时采用或比较多种方法、分类不确定、维护规则或运行固定评测时读取，不参与每轮 Hook 注入。

多个来源的同事件命令 Hook 可能并发运行，完成顺序不保证；本插件的每次注入都自包含，不依赖其他 Hook 先后顺序。如果曾把旧版石头鱼 Hook 手动写入全局或项目配置，升级后应在 `/hooks` 核对来源并停用旧副本，避免新旧规则同时注入。`additionalContextLimit` 是触发落盘预览的近似 token 阈值，不是字节上限；仓库另外用字节预算控制核心正文。事件语义以 [OpenAI Docs 的 Hooks 文档](https://learn.chatgpt.com/docs/hooks) 为准。

Hook 契约与方法论取舍的形成过程保留在 [工程规则审计](docs/research/2026-08-27-stonefish-engineering-audit.md)、[方法论研究](docs/research/2026-08-27-methodology-index-and-routing.md)、[决策透明度研究](docs/research/2026-08-28-methodology-disclosure-and-decision-transparency.md) 和 [决策文案研究](docs/research/2026-08-29-engineering-rationale-copy-structure.md) 中。当前源码行为以核心 Skill、references、测试和 [v0.3.7 评测](docs/evals/v0.3.7.md) 为准；上一版本的历史证据保留在 [v0.3.6 评测](docs/evals/v0.3.6.md)。

核心倾向：

- 先理解真实调用链、消费者、不变量和失败边界；
- 修复正确所有者处的根因，不追求错误位置上的最小 diff；
- 每个工程任务轻量检查单一职责、高内聚低耦合、模块边界、知识级 DRY、KISS/YAGNI、长期连贯性和风险相称验证；检查不等于强制增加结构；
- 外科手术式修改限定因果范围，Boy Scout Rule 改善范围内质量；
- 允许经授权的破坏性重构，但先审计消费者、迁移和恢复边界；
- 完成声明必须区分实际验证、静态推断和待人工验收。
- 失败测试不能靠弱化断言、跳过或盲目重试变绿；错误、安全、外部副作用和文档同步按风险读取对应细则。
- 方法论、工程判断或用户约束真正改变方案、风险边界或验证时，在一个 `## 🧭 本次决策与方法论（石头鱼的工程规则）` 区块中按独立决策说明所有实际采用的方法、准确分类、具体作用，以及阶段对应的影响与验证；简单、普通和复杂决定使用自适应 Markdown，没有实际影响时不显示。

Hook 可以确保已信任的脚本在相应生命周期运行并注入规则，但不能保证模型每次都能正确判断“是否长期最优”。命令权限、不可逆操作和 CI 仍应由 Codex 审批、沙箱、`.rules` 和项目检查负责。

## 安装

需要：

- 支持 Plugins 和 Hooks 的当前 Codex CLI 或 ChatGPT 桌面版 Codex；
- Hook 运行环境的 `PATH` 中存在 Node.js 22.18 或更高版本。

安装前检查：

```bash
node --version
```

```bash
codex plugin marketplace add sty20030818/stonefish-codex-plugins --ref main
codex plugin add stonefish-engineering@stonefish
```

安装后：

1. 启动一个新任务。
2. 在 Codex 中打开 `/hooks`。
3. 审查并信任 `SessionStart`、`SubagentStart` 和 `UserPromptSubmit` 三个 Hook。
4. 再开一个新任务，让 Codex 报告它收到的 `STONEFISH ENGINEERING ACTIVE` 版本和 references 基准路径。

插件安装不会自动信任 Hook；Hook 内容变化后也可能需要重新审查。

## 使用

安装并信任后，核心规则由 Hook 自动生效，不需要再显式调用 Skill。Skill 不参与隐式自动选择；当 Hook 未信任、被禁用、运行失败、宿主不支持 Hooks，或用户希望当前任务主动重读规则与 references 时，可以显式调用：

```text
$stonefish-engineering 按石头鱼的工程规则处理这个重构，并加载匹配的参考文件。
```

显式调用只影响当前任务，不能替代会话恢复、压缩后、子 Agent 启动和逐轮提醒等生命周期注入。

插件不会自动改变你的全局 `AGENTS.md`。作者自己的称呼、中文回复、Bun 兜底和 CodeGraph 规则位于 [examples/AGENTS.stonefish.md](examples/AGENTS.stonefish.md)，仅供选择性合并，不属于公开插件默认行为。

## 更新

```bash
codex plugin marketplace upgrade stonefish
codex plugin add stonefish-engineering@stonefish
```

更新后先在 `/hooks` 确认只有预期来源的三个 Hook，再启动新任务。若 Hook 定义的 hash 发生变化，重新审查和信任。

日常安装跟踪 `main`，版本历史使用 Git tag 与 GitHub Release。需要固定版本时，在添加 marketplace 时使用 `--ref v0.3.7`。

## 隐私与安全

- Hook 不联网、不写日志、不保存状态。
- `UserPromptSubmit` 不读取规则文件，也不会把用户 prompt 回显到输出。
- Session 与子 Agent Hook 只读取插件自带的 manifest 和 Skill 正文。
- Hook 入口会拒绝不可读、不可解析、正文为空或关键结构缺失的缓存，只输出不含原始输入的安全错误标识；若 Node 在入口执行前退出，需要重新安装插件。

## 本地开发

插件运行时没有 npm 依赖。仓库开发使用 TypeScript，首次检查先安装开发依赖：

```bash
npm ci
npm run check
```

Hook 源码是 `plugins/stonefish-engineering/src/inject-context.ts`；`npm run build` 会生成安装时实际执行的 `hooks/inject-context.js`，插件自己的 `package.json` 保证它进入独立缓存后仍按 ESM 运行。不要直接编辑生成物。三个生命周期事件共用这个无状态入口，因为输入校验、错误脱敏和输出协议相同；只有某个事件出现独立依赖或复杂流程时才拆分。

发布新版本时：

1. 同步更新根 `package.json`、`package-lock.json` 与 `.codex-plugin/plugin.json` 的 SemVer。
2. 更新 `CHANGELOG.md`。
3. 规则语义变化时更新对应版本的评测记录；Hook 生命周期变化时完成其中列出的真实客户端冒烟项。
4. 运行本地验证并等待 GitHub Actions 通过。
5. 创建与 manifest 相同版本的 tag，再创建 GitHub Release。

## 许可

[MIT](LICENSE)
