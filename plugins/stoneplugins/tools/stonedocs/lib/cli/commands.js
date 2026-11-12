export const OPTIONS = {
    project: { value: "目录", description: "显式选择真实项目根；优先于自动定位。" },
    json: { description: "stdout 输出一个 JSON 结果对象；npm 调用同时使用 --silent。" },
    help: { description: "只查看帮助，不定位项目或读取采用配置。" },
    version: { description: "查看实际程序版本，不将插件或项目版本当作程序版本。" },
    goal: { value: "Goal ID", description: "创建阶段时指定所属 Goal，或按 Goal 筛选；不会掩盖重复身份。" },
    phase: { value: "Phase ID", description: "创建任务时指定所属 Phase，或按 Phase 筛选 Task；编号不表示顺序。" },
    kind: { value: "对象种类", description: "显式指定 goal、phase 或 task，避免结果对象被猜测。" },
    batch: { value: "批次标识", description: "读取指定原生验收批次；省略时保留所有批次与已有自由格式结果。" },
    status: { value: "状态", description: "筛选 todo、doing、done 或 cancelled；没有此选项时包含所有状态及归档资料。" },
    author: { description: "显式使用本项目本地作者规则；不是用户授权，也不能绕过未知采用记录。" },
    from: { value: "旧固定规范包目录", description: "显式提供当前采用来源的旧原文包；不以当前文件、摘要或 latest 猜基线。" },
    rules: { value: "固定规范包目录", description: "显式选择带 source.json 与完整资源的固定规则包，不读取作者工作树或远端 latest。" },
    input: { value: "JSON 文件或 -", description: "有版本的操作输入；- 从标准输入读取，字段与示例见对应命令帮助。" },
    apply: { description: "应用已预览计划，必须同时提供 --expect；不证明用户已批准业务范围。" },
    expect: { value: "预览摘要", description: "引用本次实际输入/相关资料的预览；写前重建后不匹配即拒绝。" },
    "dry-run": { description: "只生成预览，不创建锁、恢复材料或业务文件。" },
    resume: { value: "操作ID", description: "显式接续本命令中断的匹配操作；不能与输入或普通应用参数混用。" },
    rollback: { value: "操作ID", description: "撤销本命令中断且仍匹配的操作；后续人工改动会使恢复停止。" },
};
const common = ["project", "json", "help"];
const progressOptions = [...common, "author", "expect", "dry-run", "resume", "rollback"];
export const COMMANDS = [
    { path: "init", summary: "盘点并采用固定规范与必要入口；默认预览，不生成空业务文档或安装工具。", usage: "init --project <目录> --rules <固定规范包> [--apply --expect <摘要>] [--dry-run] [--json]；中断恢复仅带项目与 --resume 或 --rollback", options: [...common, "rules", "apply", "expect", "dry-run", "resume", "rollback"], example: "init --project /path/to/project --rules /path/to/fixed-rules --json" },
    { path: "upgrade", summary: "比较旧规范、本地内容与目标规范；默认预览，任一冲突整次不应用。", usage: "upgrade --project <目录> --from <旧固定包> --rules <目标固定包> [--apply --expect <摘要>] [--dry-run] [--json]；恢复仅带项目与 --resume 或 --rollback，不带规范包", options: [...common, "from", "rules", "apply", "expect", "dry-run", "resume", "rollback"], example: "upgrade --project /path/to/project --from /path/to/old-rules --rules /path/to/new-rules --json" },
    { path: "check", summary: "只读检查项目的链接、身份、状态和归属，不判断业务验收。", usage: "check [--project <目录>] [--json]", options: common, example: "check --project /path/to/project --json" },
    { path: "sop list", summary: "列出项目本地 SOP 与来源缺口；显式作者模式读取唯一作者布局。", usage: "sop list [--project <目录>] [--author] [--json]；作者模式须显式 --project", options: [...common, "author"], example: "sop list --project /path/to/project" },
    { path: "sop show", summary: "读取指定本地 SOP 完整原文；index 表示索引，--author 显式读取作者源。", usage: "sop show <流程名> [--project <目录>] [--author] [--json]；作者模式须显式 --project", argument: "流程名", options: [...common, "author"], example: "sop show task --project /path/to/project" },
    ...["goal", "phase", "task"].flatMap((kind) => {
        const filters = kind === "goal" ? ["status"] : kind === "phase" ? ["goal", "status"] : ["goal", "phase", "status"];
        return [
            { path: kind + " new", inputKind: kind, summary: "从本地 SOP 形成创建计划；默认只预览，显式应用后才写入，不自动开工。", usage: kind + " new --project <目录> [--author] --input <文件|-> " + (kind === "phase" ? "--goal <ID> " : kind === "task" ? "--phase <ID> " : "") + "[--apply --expect <摘要>] [--dry-run] [--json]；中断恢复：--resume <操作ID> 或 --rollback <操作ID>", options: [...common, "author", "input", "apply", "expect", "dry-run", "resume", "rollback", ...(kind === "phase" ? ["goal"] : kind === "task" ? ["phase"] : [])], example: kind + " new --project /path/to/project --author --input " + kind + ".json" + (kind === "phase" ? " --goal V1" : kind === "task" ? " --phase P003" : "") },
            ...["start", "done", "cancel", ...(kind === "task" ? [] : ["archive"])].map((action) => ({
                path: kind + " " + action, action: action, objectKind: kind, argument: "ID",
                ...(action !== "start" ? { inputSchema: action } : {}),
                summary: ({ start: "只开始本对象；Task 要求所属 Phase 已 doing，不自动开工父级。", done: "按现有可定位依据完成本对象；不自动记录结果或归档。", cancel: "明确取消原因及未完工作的承接；不改变子对象状态。", archive: "结束后按审阅和交接原地归档；不改变子对象状态。" })[action],
                usage: kind + " " + action + " <ID> --project <目录> [--author] " + (action === "start" ? "" : "--input <文件|-> ") + "[--dry-run] [--expect <摘要>] [--json]；恢复只带 --resume <操作ID> 或 --rollback <操作ID>，不带 ID 或输入",
                options: [...progressOptions, ...(action === "start" ? [] : ["input"])],
                example: kind + " " + action + " " + ({ goal: "V1", phase: "P001", task: "T0001" }[kind]) + " --project /path/to/project --author" + (action === "start" ? "" : " --input " + action + ".json"),
            })),
            { path: kind + " list", summary: "列出 " + kind + " 的身份、归属、位置和材料入口；原文由 show 返回。", usage: kind + " list [--project <目录>] " + filters.map((f) => "[--" + f + " <值>]").join(" ") + " [--json]", options: [...common, ...filters], example: kind + " list --project /path/to/project" },
            { path: kind + " show", summary: "读取项目内唯一 " + kind + " 原文及行范围，歧义时拒绝。", usage: kind + " show <ID> [--project <目录>] [--json]", argument: "ID", options: common, example: kind + " show " + ({ goal: "V1", phase: "P001", task: "T0001" }[kind]) + " --project /path/to/project --json" },
        ];
    }),
    { path: "result add", action: "result", inputSchema: "result", argument: "ID", summary: "给唯一对象追加实际验收批次；保留失败，不自动完成对象。同批次内容一致时不重复写入。", usage: "result add <ID> --kind <goal|phase|task> --project <目录> [--author] --input <文件|-> [--dry-run] [--expect <摘要>] [--json]；恢复只带 --resume 或 --rollback、项目及作者模式", options: [...progressOptions, "kind", "input"], example: "result add T0001 --kind task --project /path/to/project --author --input result.json" },
    { path: "result show", argument: "ID", summary: "只读返回原生验收批次与现有原文，未识别资料单列缺口，不视为没有结果。", usage: "result show <ID> --kind <goal|phase|task> [--batch <标识>] [--project <目录>] [--json]", options: [...common, "kind", "batch"], example: "result show T0001 --kind task --project /path/to/project --json" },
    { path: "release plan", action: "release-plan", inputSchema: "releasePlan", summary: "在唯一 Goal/Phase plan 维护发布意图；默认直接写文档，可只读预览，不创建实际发布记录。", usage: "release plan (--goal <ID> | --phase <ID>) --project <目录> [--author] --input <文件|-> [--dry-run] [--expect <摘要>] [--json]；恢复仅带项目/原作者模式和 --resume 或 --rollback", options: [...progressOptions, "goal", "phase", "input"], example: "release plan --phase P001 --project /path/to/project --input release-plan.json --dry-run --json" },
    { path: "release show", argument: "版本", argumentOptional: true, summary: "按版本或唯一承接对象读取意图、实际记录和原文；不从计划推断已发布。", usage: "release show [版本] [--goal <ID> 或 --phase <ID>] [--project <目录>] [--json]；版本、Goal、Phase 三者恰一", options: [...common, "goal", "phase"], example: "release show 0.1.0-beta.1 --project /path/to/project --json" },
    { path: "release record", action: "release-record", inputSchema: "releaseRecord", summary: "独立追加真实发布事实，不强制先有计划，也不执行打包、tag、GitHub或云端发布。", usage: "release record --project <目录> [--author] --input <文件|-> [--dry-run] [--expect <摘要>] [--json]；恢复仅带项目/原作者模式和 --resume 或 --rollback", options: [...progressOptions, "input"], example: "release record --project /path/to/project --input released.json --json" },
    { path: "help", summary: "查看已实现命令，不读取目标项目或采用配置。", usage: "help [命令路径] [--json]", options: common, example: "help task show" },
    { path: "version", summary: "查看实际程序版本；源码未标版本时如实说明。", usage: "--version [--json]", options: ["json"], example: "--version --json" },
];
export class UsageError extends Error {
    diagnostic;
    constructor(message) {
        super(message);
        this.diagnostic = { code: "USAGE_ERROR", message, path: "arguments", remedy: "执行 stonedocs help 或 stonedocs help <命令路径> 查看实际参数。" };
    }
}
export function parseCommand(args) {
    const words = [];
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith("--")) {
            if (arg.startsWith("-"))
                throw new UsageError("未知参数：" + arg);
            words.push(arg);
            continue;
        }
        const name = arg.slice(2);
        if (!new Set([...COMMANDS.flatMap((command) => command.options), "version"]).has(name) || Object.hasOwn(options, name))
            throw new UsageError("未知或重复参数：" + arg);
        if (!OPTIONS[name].value)
            options[name] = true;
        else {
            const value = args[++i];
            if (!value?.trim() || (value.startsWith("-") && !(name === "input" && value === "-")))
                throw new UsageError(arg + " 需要非空参数。");
            options[name] = value;
        }
    }
    if (options.version || words[0] === "version") {
        if (words.join(" ") !== (options.version ? "" : "version") || Object.keys(options).some((k) => !["version", "json"].includes(k)))
            throw new UsageError("版本查询只接受 --json。");
        return { definition: COMMANDS.find((c) => c.path === "version"), options };
    }
    if (options.help || words[0] === "help") {
        if (Object.keys(options).some((k) => !common.includes(k)))
            throw new UsageError("帮助查询包含不适用参数。");
        const target = (words[0] === "help" ? words.slice(1) : words).join(" ");
        if (target && !COMMANDS.some((c) => c.path === target || c.path.startsWith(target + " ")))
            throw new UsageError("未知帮助入口：" + target);
        return { definition: COMMANDS.find((c) => c.path === "help"), options, helpTarget: target };
    }
    const definition = COMMANDS.find((c) => c.path !== "help" && c.path !== "version" && words.slice(0, c.path.split(" ").length).join(" ") === c.path);
    if (!definition)
        throw new UsageError("缺少命令或命令尚未实现。");
    const arguments_ = words.slice(definition.path.split(" ").length);
    const recovering = (definition.inputKind || definition.action) && (options.resume || options.rollback);
    const requiredArguments = definition.argument && !definition.argumentOptional && !recovering ? 1 : 0;
    const allowedArguments = definition.argument && !recovering ? 1 : 0;
    if (arguments_.length < requiredArguments || arguments_.length > allowedArguments)
        throw new UsageError("用法：stonedocs " + definition.usage);
    for (const name of Object.keys(options))
        if (!definition.options.includes(name))
            throw new UsageError("当前命令不接受 --" + name);
    if (options.kind && !["goal", "phase", "task"].includes(String(options.kind)))
        throw new UsageError("--kind 需要 goal/phase/task。 ");
    if (definition.path === "result show" && typeof options.kind !== "string")
        throw new UsageError("result show 需要 --kind <goal|phase|task>。");
    if (definition.path === "release show" && Number(Boolean(arguments_[0])) + Number(Boolean(options.goal)) + Number(Boolean(options.phase)) !== 1)
        throw new UsageError("release show 的位置版本、--goal、--phase 必须恰好提供一项，不使用全局 --version 传发布版本。");
    if (options.status && !["todo", "doing", "done", "cancelled"].includes(String(options.status)))
        throw new UsageError("--status 需要 todo/doing/done/cancelled。");
    if (definition.path === "sop show" && !/^[a-z][a-z0-9-]*$/.test(arguments_[0]))
        throw new UsageError("SOP 名称仅使用英文小写、数字和连字符，索引用 index。");
    return { definition, options, argument: arguments_[0] };
}
