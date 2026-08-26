# 石头鱼 Codex 插件

一个可通过 GitHub 安装和升级的 Codex marketplace。首个插件 `stonefish-engineering` 提供一套偏长期、重证据、控制复杂度的工程工作流。

> 当前以中文为主。工作流会尊重项目上下文，不会把作者个人的语言、称呼、包管理器或项目约定强加给其他用户。

## 石头鱼工程工作流

它把工程规则分成三层：

- `SessionStart`：在会话启动、恢复、清空或压缩后注入精简核心。
- `SubagentStart`：让子 Agent 获得同一工程底线。
- `UserPromptSubmit`：每轮只注入一条短提醒，不重复整份规则。
- Skill references：仅在匹配任务中读取架构、修改边界和验证细则。

核心倾向：

- 先理解真实调用链、消费者、不变量和失败边界；
- 修复正确所有者处的根因，不追求错误位置上的最小 diff；
- KISS/YAGNI 默认优先，DRY、端口和抽象必须有当前证据；
- 外科手术式修改限定因果范围，Boy Scout Rule 改善范围内质量；
- 允许经授权的破坏性重构，但先审计消费者、迁移和恢复边界；
- 完成声明必须区分实际验证、静态推断和待人工验收。

Hook 可以保证已信任脚本在相应生命周期运行并注入上下文，但不能数学意义上保证模型正确判断“是否长期最优”。命令权限、不可逆操作和 CI 仍应由 Codex 审批、沙箱、`.rules` 与项目检查负责。

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
$stonefish-engineering 按工程设计、实现与验证工作流处理这个重构，并加载匹配的参考文件。
```

插件不会自动改变你的全局 `AGENTS.md`。作者自己的称呼、中文回复、Bun 兜底和 CodeGraph 规则位于 [examples/AGENTS.stonefish.md](examples/AGENTS.stonefish.md)，仅供选择性合并，不属于公开插件默认行为。

## 更新

```bash
codex plugin marketplace upgrade stonefish
codex plugin add stonefish-engineering@stonefish
```

更新后启动新任务。若 Hook 定义的 hash 发生变化，在 `/hooks` 中重新审查和信任。

日常安装跟踪 `main`，版本历史使用 Git tag 与 GitHub Release。需要固定版本时，在添加 marketplace 时使用 `--ref v0.3.0`。

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

1. 同步更新根 `package.json` 与 `.codex-plugin/plugin.json` 的 SemVer。
2. 更新 `CHANGELOG.md`。
3. 运行本地验证并等待 GitHub Actions 通过。
4. 创建同版本 tag，例如 `v0.1.1`，再创建 GitHub Release。

## 许可

[MIT](LICENSE)
