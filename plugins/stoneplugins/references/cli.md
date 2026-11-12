# 配套 CLI 用法

本页只拥有技能与工具的调用适配。操作前提、填写内容和完成判断由项目采用的共同约定与对应 SOP 持有；CLI 提供确定性的定位、校验和常规写入，不替执行者判断范围、授权或验收。

## 定位与版本

从本次实际读取的 SKILL.md 所在目录解析 `../../tools/stonedocs/lib/cli/main.js`；这是插件包内[配套 CLI](../tools/stonedocs/lib/cli/main.js)，不是项目源码或全局命令。把解析后的真实绝对路径记为 `stone_cli`，把用户指定或项目入口已核实的项目根记为 `project_root`。包含空格的路径始终引用，不把作者电脑路径抄成安装契约。

首次使用这份安装产物或排查兼容问题时，可运行 `node "$stone_cli" --version --json`；[产物清单](../tools/stonedocs/artifact.json)记录程序来源和契约，[规范清单](../tools/stonedocs/rules/source.json)记录包内固定规范。运行需 Node >=22.18.0，无需安装 TS 运行器或额外全局 CLI。程序、插件和项目采用的规范分别有版本，不要求相等。

项目已采用的本地 SOP 和明确差异优先；包内快照不能默默覆盖它们。工具缺失、Node 不满足要求或规则契约不支持时，说明具体缺口；可按项目 SOP 在已有授权内手工接续，不临时重写 CLI、不换用 PATH 中另一版、不自动安装或升级项目。普通文档读取不必以写入兼容为前提。

## 规则与方法读取

先从项目入口、采用记录和实际 SOP 确认来源，工具版本不代替项目规则身份。按当前问题读取相关方法，不要求每次通读全部资料或补演技能调用：

| 情况 | 实际读取路线 |
| --- | --- |
| 已采用 v1 | 项目本地 docs/conventions.md 与对应 docs/sop；继续本地旧流程，不因插件携带 v2 而新增方法前置或自动升级 |
| 已采用 v2 | 先读项目本地共同约定和对应 SOP，相关技术工作再读本地 docs/knowledge/technical-design.md；包内同名链接只供定位参照 |
| 明确的作者模式 | 按项目入口及显式作者资源描述读取映射后的唯一源；sop show 加 --author 返回实际路径和工作树来源，不把它当固定采用 |
| 未采用的讨论 | 可读本插件固定包内的共同约定、SOP 及匹配方法来形成草案；明确尚未采用，不自动执行 init 或写回项目 |

作者仓有 handbook/resources.json 时，source→target 映射决定实际源；没有描述的旧作者布局由工具按旧合同处理。不能只因看见 handbook 目录就切换来源，也不能借 --author 绕过已有采用记录。已有项目例外与本次授权仍适用。

必需知识缺失、损坏、来源未知或契约不支持时说明精确缺口，只暂停依赖它的设计/写回；可以继续无关只读调查，不从包内另一版本、作者 checkout、安装缓存或远端 latest 静默补齐。显式升级须取得匹配旧/新固定包并核对差异；新版工具不替代用户的迁移选择。

## 按需读取与操作

下面命令中的变量均为上述已核实的路径。只读讨论不执行写入；仅在需要对应机械操作时调用工具，不为每次技能触发先跑全部检查或 help。

```sh
node "$stone_cli" help task new --json
node "$stone_cli" task show T0001 --project "$project_root" --json
node "$stone_cli" sop show task --project "$project_root" --json
```

按当前职责选择 goal/phase/task list 或 show、result show、release show、sop list/show；同一编号的对象始终限定当前项目。对象返回路径和关联入口后，继续读取真正需要的资料，不能把摘要当作完整设计或行为规则。需要校验文档结构时调用 check；它不代替测试、语义审阅或业务验收。

准备某个写入时先查该命令的 `help <对象> <动作> --json`，采用真实帮助给出的输入合同；具体 JSON 只保存本次实际内容，不在技能另维护一套模板。所有写入显式带 `--project "$project_root"`。未采用的规范作者仓才在已核实范围使用 `--author`，不能借它绕过采用记录故障或契约冲突。

new/init/upgrade 默认只读预览，核对变更和授权后带 `--apply --expect <本次预览摘要>` 应用。start/done/cancel/archive、result add、release plan/record 默认直接写回，需预览时先加 `--dry-run`，可用 `--expect` 引用对应预览；参数不是用户授权。状态、验收、完成、归档是独立动作，不因一个动作成功自动执行下一个。

写入返回 incomplete 时，核对实际变更和 data.recovery，按同一命令 help 及明确操作 ID 选择 --resume 或 --rollback；不直接删锁、不带旧输入重跑猜成功。JSON stdout 为单个对象，退出码和 outcome 一起判断，不将预览或读取成功写成已应用。

## 固定规范与分发边界

首次采用时向 init 的 `--rules` 提供本次安装下 `tools/stonedocs/rules` 的实际绝对路径；升级还需显式提供与项目旧采用身份匹配的 `--from` 包，目标由 `--rules` 明确。旧包缺失时停止，不用项目当前原文或远端 latest 猜旧基线。

插件安装或更新不会改变项目采用的规范。升级、Git 提交、tag、实际发版、远端写入与 Linear 操作分别遵守本次授权，CLI 不替代发布或连接器。没有 CLI 时仍可按普通 Markdown + Git 使用 SOP。
