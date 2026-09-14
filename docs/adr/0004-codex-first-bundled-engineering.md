# Codex 优先的完整工程工作流

## 状态

已接受，完整插件已在 `0.5.1` 实现，核心生命周期与本地安装验收通过；用户已授权按本次门槛发布。逐项证据和实际发布入口由 [v0.5.1 评测](../evals/v0.5.1.md)持有，[候选开发验证](../evals/codex-first-bundled-development.md)保留首次安装的历史快照。本文取代 [ADR-0003](0003-independent-skill-and-loader-hooks.md) 的长期分发与加载约束；已发布 `v0.5.0` 基线仍按 ADR-0003 解释。执行步骤、迁移、验证及后置适配的唯一计划是 [Codex 优先重构计划](../plans/2026-09-14-codex-first-refactor.md)。

仅本次 `0.5.1`，用户接受 60 次行为/token 对照后置，不将其未运行作为发布阻断；延期不等于行为无回归或 token 收益已获证明，也不降低未来版本的默认要求。具体范围及实际证据统一见版本评测。

## 决定

StonePlugins 优先提供自包含的 Codex 原生插件：核心 Skill、条件 references 与必要 Hooks 同包，规则只维护一个源文件树。生命周期直接送达完整精简核心，普通轮次仅短提醒，细则按事实加载；保留原生 Skill 入口，不为显示调用或计数重复读取同一核心。直接送达是本次选定的实现方向，必须经过完整性和行为验收，不预先承诺 token 降低。

对外品牌保留 StonePlugins，插件 ID 为 `stoneplugins`，Skill 为 `engineering`，限定入口为 `stoneplugins:engineering`；marketplace ID `stonefish` 保持不变，安装时仍须核对它对应的本地或远端来源。唯一规则树位于 `plugins/stoneplugins/skills/engineering/`，manifest 声明 `skills: ./skills/`，Hooks 沿用默认目录发现。其他 CLI 暂时仅独立安装同源 Skills，原生插件与 Hook 适配后置。

## 原因与后果

旧版两步安装源于把“跨宿主分发、渐进加载、避免重复来源”绑定成“插件不能包含 Skill”。这些目标可以分别满足：Codex 一次安装完整包，其他 CLI 提取同一个技能目录；正文存储与送达职责不同，但不必成为两套必须同步更新的安装。

工程规则是常驻契约，不是几十个可选工作流的集合。直接送达精简核心减少一次依赖模型主动读取的环节，同时会让部分非工程会话、恢复或继承父历史的子 Agent 承担额外上下文成本。若实测没有可靠性收益或发生完整性、行为、成本回归，停止迁移并重新审议加载方式，不增设长期双模式开关。

单一规则来源、工程适用范围、无状态且不联网的 Hook、按需细则、个人全局规则独立、授权边界和以行为证据判断落实均继续保留。不能整份恢复旧版 Hook，也不恢复 EOF 标记、硬编码旧规则、自动下载安装、跨版本缓存兜底或使用次数承诺。

## 依据

[六个工作流的一手源码比较](../research/2026-09-14-codex-first-workflow-patterns.md) 显示完整打包较一致，但 Hook 策略由宿主和工作流性质决定。Codex 官方支持 [插件同包分发](https://developers.openai.com/plugins/build/plugins) 与 [生命周期正文上下文](https://learn.chatgpt.com/docs/hooks)；脚本输出、宿主完整接收和规则落实仍是不同证据。
