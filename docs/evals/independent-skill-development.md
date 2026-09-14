# 独立 Skill 与加载 Hook：开发态验证

状态：独立 Skill 拆分阶段的历史开发证据，原位归档。下文的工作树、安装状态、文件 hash 与未完成项均限于记录时点，不证明当前发布状态或后续重构通过。现行文档见[文档索引](../README.md)；后续目标与未完成验收见 [ADR-0004](../adr/0004-codex-first-bundled-engineering.md) 和[重构计划](../plans/2026-09-14-codex-first-refactor.md)。

日期：2026-09-07。基线提交：`7d97b838f75d651f6144c25dcd1905112998d22d`。候选为当前未提交工作树，版本仍为 `0.4.1`；不是已发布版本评测。

## 候选与环境

- Skill：`skills/stonefish-engineering/`；核心 SHA-256 为 `7e9280dd7557959419d18d70d8d4863cf55c2442f1ad27a30140a599a415f238`。
- Hook：`plugins/stonefish-engineering/hooks/inject-context.js`；SHA-256 为 `757da5122024733463dbb0b93bc28636e7ef7f3ec9c1299d62a02f8271b26c6f`。
- 五份 references 与基线逐字节一致；核心仅新增独立使用与相对路径说明，元数据允许隐式调用。
- macOS，Node.js `24.16.0`、npm `11.13.0`、Skills CLI `1.5.24`、Codex CLI `0.146.0`、Grok CLI `1.0.13`。
- 使用独立临时项目，以下命令中的 `<临时项目>` 与 `<仓库绝对路径>` 为占位符。本快照记录时未切换真实全局 Skill、插件来源、Hook 信任或全局规则，也未暂存、提交、推送或发布；后续候选状态见 [v0.5.0](v0.5.0.md)。

## 已运行的确定性检查

- `npm run check`：类型检查、生成 Hook、仓库校验及 7 项测试全部通过。
- 测试先在旧实现上失败，再在加载 Hook 上通过，覆盖三个事件、SessionStart 的四个来源、子 Agent 提醒、独立缓存 ESM、输入隔离、BOM 和安全错误输出。
- 官方 Skill 与插件校验器均通过。旧插件 Skill 目录已移除；新插件没有 `skills` 声明。
- 活跃文档链接与旧路径消费者检查通过；历史研究和版本评测中的旧路径保留为历史事实。
- `git diff --check` 通过，暂存区为空。普通 CI 运行开发校验，发布 tag 额外运行发布校验；本轮没有运行 GitHub Actions 或宣称发布门槛通过。

## 独立安装与发现

在临时目录运行以下本地安装，没有使用 `-g`：

```bash
npx --yes --cache <临时项目>/npm-cache skills@1.5.24 add <仓库绝对路径> --skill stonefish-engineering -a codex -a grok -y
```

安装到临时项目的 `.agents/skills/stonefish-engineering/`，与源目录比较无差异。Codex 的 `debug prompt-input` 原生技能目录及 Grok 的 `inspect --json` 均发现一份该 Skill；Grok 直接发现 `.agents` 目录，不以安装器的 symlink 展示文字推断另有副本。

这证明本地目录安装与发现，不证明 GitHub 安装、远端更新或旧插件缓存替换成功。`bunx` 命令未单独实跑。

## 工程行为冒烟

临时项目中的完整 `cache.ts`：

```ts
// 契约：调用方以秒传入 TTL，now 与 expiresAt 使用毫秒时间戳。
export function createEntry(value: string, ttlSeconds: number, now = Date.now()) {
  return { value, expiresAt: now + ttlSeconds };
}

export function isExpired(entry: { expiresAt: number }, now = Date.now()) {
  return now >= entry.expiresAt;
}
```

### Codex 原生 Skill 加载

输入：

> 请只读审查 cache.ts 的过期时间逻辑，指出问题、最小修复与应补的测试。不要修改文件、联网或启动服务。

使用 `exec --ignore-user-config --ephemeral --json --sandbox read-only`，未指定模型覆盖；原始输出保留在维护者本地任务记录中。

实际轨迹先完整读取临时安装的核心（包含 `<!-- SF_END -->`），再读取 change-boundaries、verification、decision-summary，随后审查代码。最终指出秒与毫秒混加，推荐在 `createEntry` 乘以 1000，保留正确的 `>=` 比较，并列出确定性边界测试；未修改文件或声称已运行测试。

该次轨迹证明原生 Skill 的加载及一个案例的主要行为。后续事件记录探针未观察到此隔离模式下的项目 Hook 执行，因此不能把这次加载归因于 Hook。

### Codex 显式会话 Hook 闭环

随后使用 CLI `-c` 临时配置 `hooks.SessionStart` 和 `hooks.UserPromptSubmit`，不依赖项目配置发现。Hook 包装器只记录事件名、来源、退出码及输出是否包含加载要求，原样转发候选 Hook 输出；没有记录用户 prompt。单次启用已审查 Hook 的信任绕过，不修改持久信任。

实际记录：

```json
{"event":"SessionStart","source":"startup","exit":0,"hasLoadRequest":true}
{"event":"UserPromptSubmit","exit":0,"hasLoadRequest":true}
```

同次模型轨迹先完整读取独立核心，再读取细则，最后完成 TTL 根因审查，未修改代码。这证明显式会话配置下的 startup/逐轮 Hook 执行、正文加载和一次工程案例闭环；不替代真实 marketplace 安装、项目发现或其他生命周期验收。

使用同一显式会话 Hook 配置又完成两项边界冒烟，事件探针均新增 startup 与逐轮成功记录：

- **纯文案**：输入“把 Hello 翻译成中文，只给译文。”；仅输出“你好”，没有读取 Skill 或调用其他工具。
- **缺失 Skill**：在没有安装该 Skill 的独立临时目录输入“请为一个只有单个调用方的本地 JSON 配置读取函数，给出增加可选字段的最小实现方案。只做分析，不修改文件、不联网、不安装任何东西。”；明确报告可用 Skill 列表没有该技能并暂停方案分析，没有执行工具、安装或回退旧插件缓存。

### Grok 加载与行为

以 `--rules` 传入源 Hook 实际生成的加载要求，使用 `--permission-mode plan`、`--no-subagents`、`--disable-web-search`，且不指定模型覆盖。这里只验证同一加载要求在 Grok 的行为，**不是 Grok 原生 Hook 集成**。

第一次运行完整读取了核心和细则，但遇到终端权限取消，没有完成审查，不记为通过。第二次只开放文件读取、列表和搜索工具，输入为：

> 请只读审查 cache.ts 的过期时间逻辑，指出问题、最小修复与应补的测试。只使用可用的只读工具，不用终端、不修改文件。

第二次运行正常结束。读取轨迹包含核心 60 行及末尾标记，随后加载三份细则。最终正确定位单位错误，建议修改唯一计算点并保留比较边界。维护者可通过 Grok 的会话导出功能核对本机原始轨迹。

发现的行为局限：Grok 把建议的整组测试概括成“修复前失败、修复后通过”，但零 TTL、截止时及截止后用例在旧实现上也可能通过。没有实际执行测试，不能将这个表述记为红绿验证证据。本轮只记录此偏差，不为单次输出扩充通用规则。

## 未完成的验收

- 真实用户安装仍为旧版带 Skill 的插件；新版全局安装、旧缓存替换与重启验收待做。当前 marketplace 跟踪 GitHub，不能拉取未提交工作树；切到本地开发源会改变更新来源，需要单独确认。
- startup/逐轮、纯文案与缺失 Skill 的显式会话配置已完成冒烟；真实插件安装来源及 SubagentStart、resume、clear、compact 的客户端闭环，以及文件不可读、长上下文复用等场景，不能用 Hook 单元测试代替。
- 临时项目 Hook 发现尚未解释清楚；纯翻译前两次没有执行记录，不能用后续显式会话配置通过掩盖这个区别。
- 未完成固定案例多次基线对比，不宣称全量规则落实或发布验收通过。
- 未验证桌面 Skill 调用样式、插件使用计数、GitHub 安装或按名远端更新；这些不能从正文读取轨迹推断。

本轮 Codex CLI 还输出既有模型目录缓存 schema 警告及技能描述预算提示；模型请求完成，但本轮没有修改这些无关全局状态。
