# 条件方法选择

初步查明真实路径、消费者、不变量和风险后，如果具体方法可能改变模块形态、迁移方式、契约或验证，读取本文件。它是运行时选择器，不是每轮浏览的方法名清单。

## 选择规则

1. 信号必须来自项目代码、契约、消费者、数据或运行证据，不能只来自方法名称或用户口号。
2. 命中信号时读取对应主题 reference，再根据触发、反触发和退出条件决定是否采用。
3. 没有真实信号时，继续由常驻执行契约形成直接方案；不为展示专业性增加结构。
4. 多个方法回答同一问题时只保留能改变决定的最小组合；回答不同问题时可以共同采用。
5. 条件方法不覆盖项目事实、公共契约、权限、安全和当前授权。

## 信号路由

| 已确认信号 | 候选方法 | 反触发或停止信号 | 读取 |
| --- | --- | --- | --- |
| 调用方被迫理解内部顺序或策略，多个调用点重复协调 | 深模块、信息隐藏、最小 Interface | 新层只透传参数，或没有可隐藏的复杂度 | [architecture.md](architecture.md) |
| 领域规则与数据库、框架、远程服务或 UI 交错 | Clean Architecture、Hexagonal、DIP、Functional Core / Imperative Shell | 简单 CRUD、单一路径且普通模块已能隔离变化 | [architecture.md](architecture.md) |
| 多个实现、provider、adapter 或 test double 承担同一角色 | LSP、ISP、行为契约、共享 Contract Testing | 实现能力本就不同，或只有一个无替换需求的实现 | [architecture.md](architecture.md)、[verification.md](verification.md) |
| 已观察到稳定变化轴，需要在不改核心契约时增加行为 | OCP、组合、策略接缝 | 变化仍是假想，或扩展点比直接修改更复杂 | [architecture.md](architecture.md) |
| 同一术语在不同业务区域含义冲突，跨域翻译责任不清 | DDD、Bounded Context、Context Map、领域语言 | 简单技术工具、通用支撑能力或单一清晰模型 | [architecture.md](architecture.md) |
| Package 独立发布、跨团队复用、依赖环或发布连锁 | REP、CCP、CRP、ADP、SDP、SAP | 只是普通目录分文件，没有独立消费者和发布边界 | [architecture.md](architecture.md) |
| 小型可回退结构调整能让目标行为只改一个所有者 | Tidy First | 整理与目标无因果关系，或本身是高成本迁移 | [change-boundaries.md](change-boundaries.md) |
| 所有消费者可以在同一变更中迁移 | Clean cut | 存在无法同步升级的外部消费者、数据或部署约束 | [change-boundaries.md](change-boundaries.md) |
| 公共契约消费者不能同步升级 | Parallel Change | 兼容层没有负责人、退出证据或删除时点 | [change-boundaries.md](change-boundaries.md) |
| 主干需持续交付，同时逐步替换内部框架或实现 | Branch by Abstraction | 可以一次干净切换，或临时接缝没有退出条件 | [change-boundaries.md](change-boundaries.md) |
| 大型遗留系统能按业务能力逐片替换 | Strangler Fig | 找不到真实拦截 Seam，或新旧状态无法安全收敛 | [change-boundaries.md](change-boundaries.md) |
| 大型源码重构不断暴露未知前置条件 | Mikado Method | 小型直接重构已有清晰依赖和恢复路径 | [change-boundaries.md](change-boundaries.md) |
| 遗留行为缺少可信规范和测试 | Characterization Testing | 已有稳定公共契约和充分行为测试 | [verification.md](verification.md) |
| 行为能从稳定 Interface 先写成可失败示例 | TDD、垂直切片 | 纯文案、一行事实或缺少可观察接缝 | [verification.md](verification.md) |
| 权限、敏感数据、外部副作用、金钱或配额路径 | Threat Modeling、最小权限、失败安全、幂等与恢复 | 风险与当前变更无关，或只是在做全系统仪式 | [architecture.md](architecture.md)、[verification.md](verification.md) |
| 决定难以逆转且存在真实可行替代 | Design It Twice、ADR | 普通实现细节，或约束只留下一个可行方向 | [architecture.md](architecture.md) |
| 项目已有可自动测量的架构质量属性 | Fitness Functions | 没有项目特有指标，只想自动化抽象口号 | [architecture.md](architecture.md)、[verification.md](verification.md) |

## 常见冲突

- **OCP 与 YAGNI**：只为已观察到且值得保护的变化轴建立扩展接缝。
- **DRY 与低耦合**：共享同一业务知识，不合并变化原因独立的相似代码。
- **模块化与 KISS**：边界用于隐藏复杂度和集中变化，不以文件、接口或层级数量衡量。
- **Clean cut 与渐进迁移**：消费者能同步时干净切换；真实迁移约束存在时才增加临时双轨，并定义退出条件。
- **Boy Scout / Tidy First 与外科手术式修改**：只整理当前因果边界内阻碍正确实现或验证的结构。
- **长期最优与当前授权**：可以提出破坏性目标方案；执行仍受消费者、数据、恢复和授权约束。

选择结束后，用项目事实说明为什么该方法改变了决定。只读取或与结果相容，不算采用。
