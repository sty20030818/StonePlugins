# 石头鱼 Codex 插件

一个可通过 GitHub 安装和升级的 Codex marketplace。首个插件 `stonefish-engineering` 提供一套重视长期维护、控制改动范围并用证据验证结果的工程规则。

> 规则正文和插件说明以中文为主，Skill 展示名为 `Stonefish Engineering`，技术标识保持 `stonefish-engineering`。这些规则会尊重项目上下文，不会把作者个人的语言、称呼、包管理器或项目约定强加给其他用户。

## 石头鱼的工程规则

规则通过三类 Hook 自动注入，并通过 Skill references 按需加载细则：

- `SessionStart`：在会话启动、恢复、清空或压缩后注入核心 Skill 正文；官方 `source: "compact"` 会在压缩后的下一次模型请求前触发，不重复注册 `PostCompact`。
- `SubagentStart`：只注入同一核心 Skill 正文，不展开 references；细则仍按任务需要读取。
- `UserPromptSubmit`：每轮注入同一条短提醒，不根据提示内容做启发式匹配，也不回显用户输入。
- Skill references：仅在匹配任务中读取架构、修改边界和验证细则。

多个来源的同事件命令 Hook 可能并发运行，完成顺序不保证；本插件的每次注入都自包含，不依赖其他 Hook 先后顺序。事件语义以 [OpenAI Docs 的 Hooks 文档](https://learn.chatgpt.com/docs/hooks) 为准。

Hook 契约、规则取舍、维护信号与测试矩阵见 [工程规则审计](docs/research/2026-08-27-stonefish-engineering-audit.md)。

核心倾向：

- 先理解真实调用链、消费者、不变量和失败边界；
- 修复正确所有者处的根因，不追求错误位置上的最小 diff；
- KISS/YAGNI 默认优先，DRY、端口和抽象必须有当前证据；
- 外科手术式修改限定因果范围，Boy Scout Rule 改善范围内质量；
- 允许经授权的破坏性重构，但先审计消费者、迁移和恢复边界；
- 完成声明必须区分实际验证、静态推断和待人工验收。
- 失败测试不能靠弱化断言、跳过或盲目重试变绿；错误、安全、外部副作用和文档同步按风险读取对应细则。

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

安装并信任后，核心规则自动生效。复杂工程任务也可以显式调用：

```text
$stonefish-engineering 按石头鱼的工程规则处理这个重构，并加载匹配的参考文件。
```

插件不会自动改变你的全局 `AGENTS.md`。作者自己的称呼、中文回复、Bun 兜底和 CodeGraph 规则位于 [examples/AGENTS.stonefish.md](examples/AGENTS.stonefish.md)，仅供选择性合并，不属于公开插件默认行为。

## 更新

```bash
codex plugin marketplace upgrade stonefish
codex plugin add stonefish-engineering@stonefish
```

更新后启动新任务。若 Hook 定义的 hash 发生变化，在 `/hooks` 中重新审查和信任。

日常安装跟踪 `main`，版本历史使用 Git tag 与 GitHub Release。需要固定版本时，在添加 marketplace 时使用 `--ref v0.3.2`。

## 隐私与安全

- Hook 不联网、不写日志、不保存状态。
- `UserPromptSubmit` 不读取规则文件，也不会把用户 prompt 回显到输出。
- Session 与子 Agent Hook 只读取插件自带的 manifest 和 Skill 正文。
- Hook 失败时只输出不包含原始输入的安全错误标识。

## 本地开发

插件运行时没有 npm 依赖。仓库开发使用 TypeScript，首次检查先安装开发依赖：

```bash
npm ci
npm run check
```

Hook 源码位于 `plugins/stonefish-engineering/src/`；`npm run build` 会生成安装时实际执行的 `.mjs` 文件，不要直接编辑生成物。

发布新版本时：

1. 同步更新根 `package.json`、`package-lock.json` 与 `.codex-plugin/plugin.json` 的 SemVer。
2. 更新 `CHANGELOG.md`。
3. 运行本地验证并等待 GitHub Actions 通过。
4. 创建与 manifest 相同版本的 tag，再创建 GitHub Release。

## 许可

[MIT](LICENSE)
