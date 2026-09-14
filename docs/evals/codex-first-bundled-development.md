# Codex 完整插件：开发候选验证（历史记录）

日期：2026-09-14。本文件保留首次本地候选安装至 Hook 审核前的历史快照，不再持有当前发布门槛或验收结论。下文的 `untrusted`、hash、“源码与缓存无差异”和未验证项均描述当时状态；后续阶段在文末追加，`0.5.1` 正式验收与发布进度转交 [版本评测](v0.5.1.md)。

当时状态：实现、确定性检查、本地安装与原生发现检查完成，等待用户审核 Hook 和新任务验收；当时仅获本地安装试验授权，尚未获提交、推送或发布授权。

## 候选与边界

- 基线 HEAD：`8c518b64f4d03a11d6aaa4233a64b89baf63d302`。候选是其上的未提交工作树，不是 GitHub 现有 `v0.5.0` Release。
- 源目录：`plugins/stoneplugins/`；唯一 Skill：`skills/engineering/`（相对插件根）；期望限定入口：`stoneplugins:engineering`。
- Node `24.16.0`、npm `11.13.0`；沿用现有 TypeScript/npm 工具链，没有增加依赖。
- Git 暂存区开始时为空，SHA-256 为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。不为发布检查暂存新文件。

## 确定性验证

- `npm run check`：类型检查、构建、仓库校验、8 组 Hook 测试全部通过。第一次全检处于文档并行更新中，因个人规则示例仍为旧入口失败；同步示例后原门禁通过，没有放松断言。
- 官方 `quick_validate.py` 与 `validate_plugin.py`：源码目录和安装缓存均通过。
- `git diff --check`：通过；暂存区 hash 与开始时一致，没有提交或发布。
- 缓存完整复制、ESM、含空格路径、实际脚本定位、核心逐字后缀比对、BOM、非法输入、防止 prompt/transcript 哨兵泄漏均有测试。
- 9 类核心故障包括缺失、目录不可读、包外软链接、无/未闭合/缺 name 的 frontmatter、空正文、缺必要结构、超限。两类生命周期均返回脱敏暂停要求，没有部分正文成功或旧缓存回退；逐轮提醒不读取核心。
- 独立审查确认五份 references 与旧 HEAD 逐字节一致。修复审查发现的 Windows 路径分隔符与资源 realpath 越界门禁；Windows 实机未运行，不据此宣称 Windows 宿主验收通过。

在安装缓存、`cwd=/tmp` 直接运行 Hook，四种 SessionStart source 和 SubagentStart 的正文都与安装源逐字相等，保留正文末尾换行。它们的 additionalContext 均为 **5,931 UTF-8 bytes**；UserPromptSubmit 为 **225 bytes**，不含正文。

| 校验对象 | SHA-256 |
| --- | --- |
| `SKILL.md` 完整源文件 | `c7646909b46ee09830da58a8d372753541b2c112543fa79b7181ea9c8d272992` |
| 去 frontmatter 正文，5,279 bytes | `2ad032b6ddd15b7232c3efe8ae78aeeb3d896ae33cc7a0ba2ca719bbd0df66fe` |
| 生成的 `hooks/inject-context.js` | `dc1f2a1b5a35730f2b2886576105925985c7b0be209a53a58ce2ad9d3f82ece1` |
| 缓存生命周期 additionalContext | `797c286562f8143eb2e4614e02445ea2dc90ac5591173525f02a7bbb0f9ecd12` |
| 逐轮 additionalContext | `18186f99887fb66efd5d099e527e7b47df74801ac1b59d7b28a557210ee46a3e` |

源码与缓存 `diff -qr` 无差异。上下文 hash 包含本机路径，换机器或缓存位置后应重测，不要求不同安装目录的 hash 相同。

## 安装与宿主验证

安装前检查：旧 `stonefish-engineering@stonefish` 为 `0.5.0`、已启用；marketplace `stonefish` 指向 GitHub `main`，实际镜像 HEAD 与安装元数据均为 `8c518b64f4d03a11d6aaa4233a64b89baf63d302`。用户配置中的 `last_revision=45c7c75...` 已过期，未用它冒充镜像现状。

Grok 的旧 Skill 链接指向共享 `.agents/skills/stonefish-engineering`。保留共享目录与链接；仅在 Codex 侧通过精确 Skill path 禁用旧入口。当前 Codex 全局 `AGENTS.md` 未匹配旧 Skill 名、压缩强制重读或旧缓存条款，无须修改个人规则。

Codex CLI `0.154.0` 的原生 `plugin/read` 在安装前正确识别本地 `stoneplugins@stonefish`、唯一 Skill `stoneplugins:engineering` 和三类 Hook。诊断先因沙箱禁止初始化本地状态库失败；获批准后只读检查成功，没有为此启动模型或创建任务。

本次实际安装操作：

1. 用原生配置接口只将旧插件 `enabled` 设为 `false`，保留旧缓存和 Hook 信任记录。
2. CLI 直接添加本地源返回“同名不同来源”错误，未修改配置。随后按 CLI 要求移除 `stonefish` 的旧 Git 镜像，再添加 `/Users/stonefish/Desktop/StonePlugins` 本地源；镜像确认没有用户改动，已记录固定恢复提交。
3. `codex plugin add stoneplugins@stonefish` 安装成功，缓存为 `/Users/stonefish/.codex/plugins/cache/stonefish/stoneplugins/0.5.0`。这是新插件 ID 的首次安装，无旧同 ID 缓存；保留候选版本字段，不创建新 Release。
4. 用 `skills/config/write` 按精确路径在 Codex 禁用旧共享 Skill；没有删除共享文件或更改 Grok 链接。

安装后原生 `skills/list(forceReload=true)`：`stoneplugins:engineering` 为 `enabled=true`，路径指向新缓存；旧 `stonefish-engineering` 为 `enabled=false`。`hooks/list`：仅出现新插件的三条工程 Hook，全部 `enabled=true`、`trustStatus=untrusted`、`additionalContextLimit=null`；没有旧插件 Hook 同时发现。命令均指向新缓存。

当时仍未通过：Hook 审核、startup/resume/clear/compact/SubagentStart 在模型上下文中的实际正文送达、手动调用与按需细则、纯聊天及继承父历史行为。已请用户重启并审核，未写入信任哈希、未绕过信任检查，也未把直接执行脚本算作生命周期端到端 PASS。

恢复信息：旧插件缓存 `/Users/stonefish/.codex/plugins/cache/stonefish/stonefish-engineering/0.5.0` 仍在；本轮临时备份 `/tmp/stoneplugins-probe.olUGpr/rollback-plugin-0.5.0` 也保留，但临时目录不作为长期恢复保证。旧 Hook JS SHA-256 为 `453620e860eb920083ffce9520080c617bfe427088c57e658193999bca6521ba`。回退时先停用候选，再恢复上述固定 Git 来源及旧插件/Skill 配置；不整体覆盖用户配置，仍需新任务确认。

## 行为与成本

十个行为案例、每侧三次的正式对照尚未执行；没有模型输入 token、缓存或账单的新比较结论。Hook 字节数只说明输出规模，不是 tokenizer 或真实宿主完整性证明。历史评测不作为本候选 PASS。

默认门槛见 [重构计划](../plans/2026-09-14-codex-first-refactor.md) 与 [行为案例](behavior-cases.md)；本次版本的延期与正式结果见 [v0.5.1 评测](v0.5.1.md)。

## 后续阶段：重启、改名与 0.5.1 授权

以下记录同日首次安装之后的进展，不覆盖上面的历史快照：

- 用户随后确认已重启 Codex 并审核信任 Hook。审核前的 `trustStatus=untrusted` 不代表这一阶段的用户确认；核心生命周期实际送达仍在逐项验收，不能仅据此将全部事件写成 PASS。
- 后续只读核对时，源码 `skills/engineering/agents/openai.yaml` 的 `display_name` 已改为 `Engineering`，已安装的 `stoneplugins/0.5.0` 候选缓存仍为 `StonePlugins Engineering`；`diff -qr` 仅此文件不同。因此，上面的“源码与缓存无差异”属于改名前检查，不能作为改名后缓存已更新的证据。此时缓存仍是完整插件候选，不是同版本号的旧 Hook-only 发布包。
- 用户最新授权补齐核心生命周期验证后发布 `0.5.1`，包括版本同步、提交、推送、tag、CI 与 GitHub Release，并接受 60 次行为/token 对照后置。缓存更新、正式生命周期结果、延期与发布状态由 [v0.5.1 评测](v0.5.1.md)继续记录；本文件不据此宣称已发布或未运行项目通过。
