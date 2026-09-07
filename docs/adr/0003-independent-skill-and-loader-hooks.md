# 独立 Skill 与生命周期加载 Hook

## 状态

已接受，进入 `0.5.0` 候选提交与安装验证阶段，尚未正式发布。替代 [ADR-0002](0002-persistent-execution-contract.md) 中 Hook 直接送达规则正文的实现；保留其常驻工程执行契约与按需 references 的语义。

## 背景

旧版插件同时持有 Skill 和全文注入 Hook，规则更新依赖插件缓存，全文注入也不能证明宿主完成了一次 Skill 加载。已确认目标是让 Skill 通过 Skills CLI 独立安装更新，同时保留生命周期中明确要求加载的能力，避免重复规则来源。

## 决定

- 完整核心与 references 只维护在根目录 `skills/stonefish-engineering/`，允许隐式调用；`plugins/stonefish-engineering/` 只分发 Hook，不携带或注册第二份 Skill。
- SessionStart 的 startup、resume、clear、compact，以及 SubagentStart、UserPromptSubmit，均发送自包含的明确加载要求，不注入规则正文。
- 工程决定前完整加载核心 `SKILL.md`；同一有效上下文已完整加载时不重复读取，references 按任务事实加载，纯文案不强制加载。Skill 缺失或读取失败必须如实说明并暂停依赖它的工程决定，不自动下载、安装或回退旧缓存。
- Skill 与 Hook 分别安装更新。旧插件缓存必须被新版替换，旧手工全文 Hook 应停用；不接受同名 Skill 双份注册或旧全文 Hook 与新加载 Hook 并行运行。

## 后果与验证

规则的单一事实源及长期工程语义保持不变；安装流程增加一个独立组件，宿主负责发现 Skill，Agent 负责实际读取并落实。更新 Skill 不更新 Hook，安装失败不能靠旧正文注入静默兜底。

Hook 协议测试证明加载要求的输出；真实客户端轨迹分别证明要求送达及正文完整加载；固定行为评测验证规则落实。宿主的 Skill 调用展示和使用计数不是本仓库能保证的行为。既有研究与版本评测保留历史状态，不能作为新流程的通过证据；候选版本号不代表正式发布或全部验收通过。
