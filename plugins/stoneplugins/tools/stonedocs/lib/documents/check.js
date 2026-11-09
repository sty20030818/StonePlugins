/** 检查仓内链接及 Goal → Phase → Task 的明确结构，不替代语义审阅。 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { resolveProjectRoot } from "./project.js";
import { isMissing, inside, exists as diskExists, resolvedPath, projectPath, ReadError, isUtf8Text } from "./files.js";
import { STATES, withoutFences, anchors, markdownLinks, unquote, localUrl, metadata, parseTaskSections } from "./markdown.js";
export const CHECK_SCOPE = "本地链接/锚点、结构、身份和明确状态约束；成员仅按本 Goal 内 Phase 链接核对，语义仍需人工审阅。";
const REMEDIES = {
    "MARKDOWN_OUTSIDE_ROOT": "将 Markdown 文件放回项目根内，或移除越界软链接。",
    "FILE_READ_ERROR": "检查文件是否仍存在及当前进程的读取权限，然后重试检查。",
    "UNCLOSED_FENCE": "补齐代码围栏后重新检查，避免正文被误当成示例。",
    "LINK_DEFINITION_MISSING": "为引用式链接补充对应定义，或改用明确的有效链接。",
    "LOCAL_LINK_OUTSIDE_ROOT": "将本地引用改为项目内路径；跨项目资料使用明确的外部来源。",
    "LOCAL_LINK_MISSING": "核对目标文件位置，并修正源文档的链接。",
    "LOCAL_ANCHOR_MISSING": "核对目标标题或明确锚点，并同步源链接。",
    "LINK_READ_ERROR": "检查目标文件的编码与读取权限，然后重新检查。",
    "LEGACY_TASK_LOCATION": "将工作整理到所属 Goal 的 Phase 中，保留唯一任务清单及引用。",
    "METADATA_MISSING": "在 plan 开头提供唯一的 YAML id 和 status，并闭合元数据块。",
    "IDENTITY_INVALID": "只保留一个非空 id，并核对其目录与引用。",
    "STATE_INVALID": "只保留一个 todo/doing/done/cancelled 状态，按真实事实填写。",
    "ARCHIVE_INVALID": "仅使用一个布尔 archived 属性，不以归档替代完成判断。",
    "ARCHIVE_STATE_INVALID": "先核对退出条件及收尾依据；活跃对象不能归档。",
    "GOAL_OUTSIDE_ROOT": "将 Goal 目录放回项目根内，不通过链接引用外部活跃计划。",
    "GOAL_PLAN_MISSING": "在该 Goal 目录补齐其唯一计划，或修正错误目录。",
    "GOAL_ID_INVALID": "使 Goal id 为有效英文标识，并与目录名忽略大小写一致。",
    "GOAL_ID_DUPLICATE": "核对两处 Goal 身份，保留唯一对象并修正关联引用。",
    "PHASE_OUTSIDE_ROOT": "将 Phase 目录放回所属 Goal 内，不通过链接引用外部活跃阶段。",
    "PHASE_PLAN_MISSING": "补齐所属 Phase 的唯一计划，并明确其目标归属。",
    "PHASE_TASKS_MISSING": "在该 Phase 目录提供唯一 tasks.md；尚未拆任务时如实说明。",
    "PHASE_ID_INVALID": "使用项目内唯一的 P 加数字标识。",
    "PHASE_DIRECTORY_INVALID": "使用 <phase-id>-<outcome> 目录，使前缀与 plan 中的 id 一致。",
    "PHASE_ID_DUPLICATE": "在项目范围核对阶段身份，保留唯一对象并修正引用。",
    "TASKS_LOCATION_INVALID": "将任务正文放到所属 Goal/Phase 的唯一 tasks.md。",
    "DUPLICATE_STATE_TABLE": "删除重复进度表，任务状态只保留在各自条目中。",
    "DUPLICATE_STATE_CHECKBOX": "移除第二套勾选状态，使用任务条目中的唯一状态字段。",
    "TASK_OWNER_INVALID": "将该 Task 的唯一正文归入明确 Phase 的 tasks.md。",
    "TASK_HEADING_INVALID": "使用二级标题、稳定 Task ID 和非空成果名称。",
    "TASK_ID_DUPLICATE": "核对项目内同号任务，保留唯一正文及实际交接入口。",
    "TASK_STATE_INVALID": "为该 Task 保留一个 todo/doing/done/cancelled 状态。",
    "TASK_CRITERIA_INVALID": "为该 Task 写出唯一且可判断的完成条件。",
    "GOAL_MEMBER_MISSING": "在 Goal plan 中链接其直属 Phase，不在导航维护第二份组成。",
    "GOAL_MEMBER_INVALID": "将成员引用修正为本 Goal 下实际直属 Phase 的计划。",
    "GOAL_DONE_WITH_OPEN_PHASE": "核对整体条件与真实阶段结果，不能提前声明目标完成。",
    "PHASE_DONE_WITH_OPEN_TASK": "处理未完任务的成果或明确交接，不通过改状态绕过退出条件。",
    "INVALID_UTF8": "将文件修正为有效 UTF-8，不能用替代字符掩盖损坏内容。"
};
const IGNORED_DIRS = new Set([".git", "node_modules", ".venv", "__pycache__"]);
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function diskIsDirectory(file) {
    try {
        return statSync(file).isDirectory();
    }
    catch (error) {
        if (!isMissing(error))
            throw error;
        return false;
    }
}
function diskIsFile(file) {
    try {
        return statSync(file).isFile();
    }
    catch (error) {
        if (!isMissing(error))
            throw error;
        return false;
    }
}
function diskDirectories(root) {
    if (!diskIsDirectory(root))
        return [];
    return readdirSync(root).map((name) => path.join(root, name)).filter(diskIsDirectory).sort();
}
function diskMarkdownFiles(root) {
    if (!diskIsDirectory(root))
        return [];
    const found = [];
    const visit = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (IGNORED_DIRS.has(entry.name))
                continue;
            const file = path.join(directory, entry.name);
            if (entry.name.endsWith(".md"))
                found.push(file);
            if (entry.isDirectory())
                visit(file);
        }
    };
    visit(root);
    return found.sort();
}
function diskReadMarkdown(file) {
    return UTF8.decode(readFileSync(file));
}
function readErrorName(error) {
    if (error instanceof TypeError)
        return "无效 UTF-8";
    const code = error?.code;
    return code ?? "读取错误";
}
export function checkRepository(rootInput, overlayInput = new Map()) {
    const root = resolveProjectRoot(rootInput);
    const overlay = new Map();
    const virtualDirectories = new Set();
    for (const [relative, text] of overlayInput) {
        if (path.isAbsolute(relative) || !relative || typeof text !== "string" || !isUtf8Text(text))
            throw new ReadError({ code: "OVERLAY_INVALID", message: "覆盖视图需要项目内相对路径与有效文本。", path: relative, remedy: "仅预览本次实际文件变更，不提供越界或损坏文本。" });
        const file = projectPath(root, relative);
        overlay.set(file, text);
        for (let directory = path.dirname(file); inside(root, directory); directory = path.dirname(directory)) {
            virtualDirectories.add(directory);
            if (directory === root)
                break;
        }
    }
    const hasPath = (file) => overlay.has(file) || virtualDirectories.has(file) || diskExists(file);
    const isFile = (file) => overlay.has(file) || diskIsFile(file);
    const directories = (directory) => [...new Set([...diskDirectories(directory), ...virtualDirectories].filter((entry) => entry !== directory && path.dirname(entry) === directory))].sort();
    const readMarkdown = (file) => overlay.get(file) ?? diskReadMarkdown(file);
    const result = { diagnostics: [], complete: true, markdown: 0, links: 0, goals: 0, phases: 0, tasks: 0 };
    const relative = (file) => inside(root, file) ? path.relative(root, file) || "." : file;
    const fail = (file, code, message) => {
        result.diagnostics.push({ code, message, path: relative(file), remedy: REMEDIES[code] });
        if (["FILE_READ_ERROR", "LINK_READ_ERROR"].includes(code))
            result.complete = false;
    };
    const files = [...new Set([...diskMarkdownFiles(root), ...overlay.keys()].filter((file) => file.endsWith(".md")))].sort();
    result.markdown = files.length;
    const texts = new Map();
    const clean = new Map();
    const linkTargets = new Map();
    for (const file of files) {
        if (!inside(root, resolvedPath(file))) {
            fail(file, "MARKDOWN_OUTSIDE_ROOT", "Markdown 文件通过链接越出项目根目录");
            continue;
        }
        let text;
        try {
            text = readMarkdown(file);
            texts.set(file, text);
        }
        catch (error) {
            fail(file, error instanceof TypeError ? "INVALID_UTF8" : "FILE_READ_ERROR", "无法读取 Markdown：" + readErrorName(error));
            continue;
        }
        const stripped = withoutFences(text);
        clean.set(file, stripped.clean);
        if (stripped.unclosed)
            fail(file, "UNCLOSED_FENCE", "代码围栏未闭合");
        const targets = [];
        for (const { target, image } of markdownLinks(stripped.clean)) {
            if (target === undefined) {
                fail(file, "LINK_DEFINITION_MISSING", "引用链接缺少对应定义");
                continue;
            }
            if (/^[A-Za-z][\p{L}\p{N}_+.-]*:/u.test(target) || target.startsWith("//"))
                continue;
            result.links++;
            const url = localUrl(target);
            const local = unquote(url.pathname).replace(/\\([()])/g, "$1");
            const destination = local ? resolvedPath(path.resolve(path.dirname(file), local)) : file;
            if (!inside(root, destination)) {
                fail(file, "LOCAL_LINK_OUTSIDE_ROOT", "本地链接目标越出项目根目录：" + target);
                continue;
            }
            targets.push({ destination, image });
            if (!hasPath(destination))
                fail(file, "LOCAL_LINK_MISSING", "本地链接不存在：" + target);
            else if (url.fragment && path.extname(destination).toLowerCase() === ".md") {
                try {
                    const content = texts.get(destination) || readMarkdown(destination);
                    if (!anchors(content).has(unquote(url.fragment)))
                        fail(file, "LOCAL_ANCHOR_MISSING", "本地锚点不存在：" + target);
                }
                catch (error) {
                    fail(file, error instanceof TypeError ? "INVALID_UTF8" : "LINK_READ_ERROR", "链接目标无法读取：" + target);
                }
            }
        }
        linkTargets.set(file, targets);
    }
    for (const legacy of ["docs/phases", "docs/tasks", "docs/tasks.md", "tasks.md"]) {
        const file = path.join(root, legacy);
        if (hasPath(file))
            fail(file, "LEGACY_TASK_LOCATION", "旧的全局 Phase/Task 位置不可用；Phase 应属于 docs/goals/<goal>/phases/");
    }
    const readState = (file, kind) => {
        const data = metadata(texts.get(file) ?? "");
        if (data === null) {
            fail(file, "METADATA_MISSING", kind + " 缺少完整 YAML id/status");
            return [null, null];
        }
        const identities = data.get("id") ?? [];
        const states = data.get("status") ?? [];
        const archived = data.get("archived") ?? [];
        let ident = identities[0] ?? null;
        let state = states[0] ?? null;
        if (identities.length !== 1 || !ident) {
            fail(file, "IDENTITY_INVALID", kind + " id 必须唯一且非空");
            ident = null;
        }
        if (states.length !== 1 || !STATES.has(state ?? "")) {
            fail(file, "STATE_INVALID", kind + " status 必须唯一且属于 todo/doing/done/cancelled");
            state = null;
        }
        if (archived.length > 1 || (archived.length > 0 && !["true", "false"].includes(archived[0])))
            fail(file, "ARCHIVE_INVALID", kind + " archived 必须是单个 true/false");
        if (archived.length === 1 && archived[0] === "true" && !["done", "cancelled"].includes(state ?? ""))
            fail(file, "ARCHIVE_STATE_INVALID", kind + " 只有 done/cancelled 可以归档");
        return [ident, state];
    };
    const goals = new Map();
    const phases = new Map();
    const goalIds = new Map();
    const phaseIds = new Map();
    const canonicalTasks = new Map();
    for (const goalDirectory of directories(path.join(root, "docs/goals"))) {
        if (!inside(root, resolvedPath(goalDirectory))) {
            fail(goalDirectory, "GOAL_OUTSIDE_ROOT", "Goal 目录通过链接越出项目根目录");
            continue;
        }
        const goalPlan = path.join(goalDirectory, "plan.md");
        if (!isFile(goalPlan))
            fail(goalPlan, "GOAL_PLAN_MISSING", "Goal 缺少 plan.md");
        const [ident, state] = readState(goalPlan, "Goal");
        if (ident) {
            const identity = ident.toLowerCase();
            if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(ident) || identity !== path.basename(goalDirectory).toLowerCase())
                fail(goalPlan, "GOAL_ID_INVALID", "Goal id 应为英文标识，并与目录名忽略大小写一致");
            const prior = goalIds.get(identity);
            if (prior)
                fail(goalPlan, "GOAL_ID_DUPLICATE", "重复 Goal id " + ident + "；首次位于 " + relative(prior));
            goalIds.set(identity, goalPlan);
        }
        goals.set(goalPlan, { state, members: new Set() });
        for (const phaseDirectory of directories(path.join(goalDirectory, "phases"))) {
            if (!inside(root, resolvedPath(phaseDirectory))) {
                fail(phaseDirectory, "PHASE_OUTSIDE_ROOT", "Phase 目录通过链接越出项目根目录");
                continue;
            }
            const phasePlan = path.join(phaseDirectory, "plan.md");
            const tasksFile = path.join(phaseDirectory, "tasks.md");
            if (!isFile(phasePlan))
                fail(phasePlan, "PHASE_PLAN_MISSING", "Phase 缺少 plan.md");
            if (!isFile(tasksFile))
                fail(tasksFile, "PHASE_TASKS_MISSING", "Phase 缺少唯一的 tasks.md");
            const [phaseId, phaseState] = readState(phasePlan, "Phase");
            if (phaseId) {
                if (!/^P\d+$/.test(phaseId))
                    fail(phasePlan, "PHASE_ID_INVALID", "Phase id 应使用 P 加数字");
                const name = path.basename(phaseDirectory);
                const separator = name.indexOf("-");
                if (separator < 0 || !name.slice(separator + 1).trim() || name.slice(0, separator).toLowerCase() !== phaseId.toLowerCase())
                    fail(phasePlan, "PHASE_DIRECTORY_INVALID", "Phase 目录应使用 <phase-id>-<outcome>，且前缀与 id 一致（忽略大小写）");
                const prior = phaseIds.get(phaseId);
                if (prior)
                    fail(phasePlan, "PHASE_ID_DUPLICATE", "重复 Phase id " + phaseId + "；首次位于 " + relative(prior));
                phaseIds.set(phaseId, phasePlan);
            }
            phases.set(phasePlan, { state: phaseState, tasks: [] });
            goals.get(goalPlan).members.add(phasePlan);
            canonicalTasks.set(tasksFile, phasePlan);
        }
    }
    for (const file of files) {
        if (path.basename(file) === "tasks.md" && !canonicalTasks.has(file))
            fail(file, "TASKS_LOCATION_INVALID", "tasks.md 只能位于 Goal 嵌套 Phase 目录，Goal/版本/全局不拥有任务表");
    }
    const taskIds = new Map();
    for (const [file, content] of clean) {
        if (canonicalTasks.has(file)) {
            if (/^\|.*状态/m.test(content))
                fail(file, "DUPLICATE_STATE_TABLE", "tasks.md 不应使用状态表重复记录任务状态");
            if (/^- \[[ xX]\]/m.test(content))
                fail(file, "DUPLICATE_STATE_CHECKBOX", "tasks.md 不应使用勾选框重复记录任务状态");
        }
        for (const task of parseTaskSections(content)) {
            result.tasks++;
            const ident = task.id;
            if (!canonicalTasks.has(file))
                fail(file, "TASK_OWNER_INVALID", ident + " Task 记录只能位于所属 Phase 的 tasks.md");
            if (task.level !== 2 || !task.title)
                fail(file, "TASK_HEADING_INVALID", ident + " 需使用二级标题和非空成果名称：## " + ident + " · 名称");
            const prior = taskIds.get(ident);
            if (prior)
                fail(file, "TASK_ID_DUPLICATE", "重复 Task id " + ident + "；首次位于 " + relative(prior));
            taskIds.set(ident, file);
            const statuses = task.statuses;
            const criteria = task.criteria;
            if (statuses.length !== 1 || !STATES.has(statuses[0]))
                fail(file, "TASK_STATE_INVALID", ident + " 状态必须唯一且有效");
            if (criteria.length !== 1 || !criteria[0].trim())
                fail(file, "TASK_CRITERIA_INVALID", ident + " 必须有唯一非空完成条件");
            const owner = canonicalTasks.get(file);
            if (owner)
                phases.get(owner).tasks.push(...statuses);
        }
    }
    for (const [goalPlan, info] of goals) {
        const ownRoot = path.join(path.dirname(goalPlan), "phases");
        const referenced = new Set((linkTargets.get(goalPlan) ?? []).filter(({ destination, image }) => !image && path.basename(destination) === "plan.md" && inside(ownRoot, destination)).map(({ destination }) => destination));
        for (const missing of [...info.members].filter((member) => !referenced.has(member)).sort())
            fail(goalPlan, "GOAL_MEMBER_MISSING", "Goal 成员入口遗漏本 Goal 的 Phase：" + relative(missing));
        for (const invalid of [...referenced].filter((member) => !info.members.has(member)).sort())
            fail(goalPlan, "GOAL_MEMBER_INVALID", "Goal 成员入口不是本 Goal 的直属 Phase：" + relative(invalid));
        if (info.state === "done") {
            for (const member of [...info.members].sort())
                if (phases.get(member).state !== "done")
                    fail(goalPlan, "GOAL_DONE_WITH_OPEN_PHASE", "Goal 已 done，但成员 Phase 未 done：" + relative(member));
        }
    }
    for (const [phasePlan, info] of phases) {
        if (info.state === "done" && info.tasks.some((state) => ["todo", "doing"].includes(state)))
            fail(phasePlan, "PHASE_DONE_WITH_OPEN_TASK", "Phase 已 done，但 tasks.md 仍有 todo/doing Task");
    }
    result.goals = goals.size;
    result.phases = phases.size;
    return { ...result, errors: result.diagnostics.map((issue) => issue.path + ": " + issue.message) };
}
