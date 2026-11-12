import { lstatSync } from "node:fs";
import path from "node:path";
import { OperationError } from "../files/write.js";
import { isMissing, projectPath, readProjectText } from "../documents/files.js";
import { localUrl, markdownLinks, unquote, withoutFences } from "../documents/markdown.js";
import { contextRule, finishPlan, loadWriteContext } from "./context.js";
import { validateCreateInput } from "./input.js";
function fail(code, message, file, exitCode = 1) {
    throw new OperationError({ code, message, path: file, remedy: "核对当前项目的父级、编号、规范骨架和实际输入；修正明确缺口后重新预览，不覆盖旧内容。" }, exitCode);
}
function entryExists(root, relative) {
    try {
        lstatSync(projectPath(root, relative));
        return true;
    }
    catch (error) {
        if (isMissing(error))
            return false;
        throw error;
    }
}
function eol(text) { return text.match(/\r\n|\n|\r/)?.[0] ?? "\n"; }
function newline(text, ending) { return text.replace(/\r\n|\n|\r/g, ending); }
function sections(raw, level = 2) {
    const clean = withoutFences(raw).clean;
    const found = [...clean.matchAll(new RegExp("^" + "#".repeat(level) + "[ \\t]+([^\\r\\n]+)", "gm"))];
    return found.map((match, index) => {
        let headEnd = match.index + match[0].length;
        if (raw.slice(headEnd, headEnd + 2) === "\r\n")
            headEnd += 2;
        else if (/[\r\n]/.test(raw[headEnd] ?? ""))
            headEnd++;
        const end = found[index + 1]?.index ?? raw.length;
        return { title: match[1].trim(), start: match.index, headEnd, end, body: raw.slice(headEnd, end), heading: raw.slice(match.index, match.index + match[0].length) };
    });
}
function skeleton(raw, kind, sourcePath) {
    let source = raw;
    if (kind !== "task") {
        const matches = sections(raw, 3).filter((section) => section.title === (kind === "goal" ? "Goal plan" : "Phase plan"));
        if (matches.length !== 1)
            fail("SOP_TEMPLATE_AMBIGUOUS", "plan SOP 的对象骨架入口必须唯一。", sourcePath);
        source = matches[0].body;
    }
    const blocks = [...source.matchAll(/^ {0,3}(`{3,}|~{3,})markdown[ \t]*\r?\n([\s\S]*?)^ {0,3}\1[ \t]*\r?$/gm)];
    const matching = blocks.filter((block) => kind === "task" ? /^## T0001[ \t]*·/m.test(block[2]) : /^id: /m.test(block[2]));
    if (matching.length !== 1)
        fail("SOP_TEMPLATE_AMBIGUOUS", "对应 Markdown 骨架缺失或不唯一。", sourcePath);
    return matching[0][2];
}
function renderPlan(template, kind, input, id, ending, sourcePath) {
    const parts = sections(template);
    const required = kind === "goal" ? ["背景、成果与范围", "组成阶段", "整体验收条件"] : ["背景与目标", "范围", "验收与退出条件", "阶段材料"];
    const optional = kind === "goal" ? ["推进与风险", "材料与发布意图", "收尾"] : ["成果与用户故事", "推进、依赖与技术概述", "目标差异", "发布意图", "收尾"];
    for (const name of required)
        if (parts.filter((section) => section.title === name).length !== 1)
            fail("SOP_TEMPLATE_UNSUPPORTED", "骨架必需章节缺失或重复：" + name, sourcePath);
    if (parts.some((section) => !required.includes(section.title) && !optional.includes(section.title)))
        fail("SOP_TEMPLATE_UNSUPPORTED", "骨架包含无法明确填写的章节。", sourcePath);
    let prefix = template.slice(0, parts[0].start);
    if ([...prefix.matchAll(/^id: .+$/gm)].length !== 1 || [...prefix.matchAll(/^# [^\r\n]+$/gm)].length !== 1 || !/^status: todo\r?$/m.test(prefix))
        fail("SOP_TEMPLATE_UNSUPPORTED", "骨架需要唯一 id、成果标题及 todo 初始状态。", sourcePath);
    prefix = prefix.replace(/^id: .+$/m, "id: " + id).replace(/^# [^\r\n]+$/m, "# " + input.title);
    const criteria = input.criteria.map((value, index) => `${index + 1}. ${value}`).join("\n");
    let composition = "";
    if (kind === "goal") {
        const table = parts.find((section) => section.title === "组成阶段").body.split(/\r\n|\n|\r/).filter((line) => line.startsWith("|"));
        if (table.length < 2)
            fail("SOP_TEMPLATE_UNSUPPORTED", "Goal 骨架缺少明确的阶段组成表头。", sourcePath);
        composition = table.slice(0, 2).join("\n") + "\n\n当前没有已规划阶段。";
    }
    const values = kind === "goal" ? { "背景、成果与范围": input.scope, "组成阶段": composition, "整体验收条件": criteria } : { "背景与目标": "本阶段属于[所属目标](../../plan.md)。", "范围": input.scope, "验收与退出条件": criteria, "阶段材料": "- [任务清单](tasks.md)" };
    let result = prefix.trimEnd() + "\n\n";
    for (const section of parts)
        if (Object.hasOwn(values, section.title))
            result += section.heading.trimEnd() + "\n\n" + values[section.title] + "\n\n";
    return newline(result.trimEnd() + "\n", ending);
}
function taskSkeleton(template, input, id, phaseId, ending, sourcePath) {
    const marker = /^## T0001[ \t]*·[^\r\n]+/m.exec(template);
    if (!marker)
        fail("SOP_TEMPLATE_UNSUPPORTED", "Task 骨架缺少唯一任务条目。", sourcePath);
    if (!input)
        return newline(template.slice(0, marker.index).replaceAll("<Phase 标识>", phaseId).trimEnd() + "\n\n尚未拆分任务。\n", ending);
    const body = template.slice(marker.index);
    const fields = { "状态": "todo", "交付物": input.deliverable, "完成条件": input.criteria.join("；"), "材料": input.materials?.join("；"), "依赖": input.dependencies, "验证结果": "尚未执行。", "接续说明": undefined };
    const found = [...body.matchAll(/^-[ \t]+([^：:\r\n]+)[：:][ \t]*(.*)$/gm)];
    if (found.length !== 7 || new Set(found.map((match) => match[1])).size !== 7 || found.some((match) => !Object.hasOwn(fields, match[1])))
        fail("SOP_TEMPLATE_UNSUPPORTED", "Task 骨架字段缺失、重复或无法填写。", sourcePath);
    let result = body.replace(/^## T0001[ \t]*·[^\r\n]+/m, "## " + id + " · " + input.title);
    result = result.replace(/^-[ \t]+([^：:\r\n]+)[：:][ \t]*(.*)(?:\r?\n|$)/gm, (_, name) => fields[name] === undefined ? "" : "- " + name + "：" + fields[name] + "\n");
    return newline(result.trimEnd() + "\n", ending);
}
function memberSection(goal) {
    const parts = sections(goal.raw);
    const explicit = parts.filter((section) => ["组成阶段", "阶段与贡献"].includes(section.title));
    if (explicit.length === 1)
        return explicit[0];
    if (explicit.length > 1)
        fail("GOAL_MEMBERS_AMBIGUOUS", "Goal 存在多个阶段组成章节。", goal.path);
    const candidates = parts.filter((section) => {
        const links = markdownLinks(withoutFences(section.body).clean).some(({ target, image }) => {
            if (!target || image || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target))
                return false;
            return /^phases\/[^/]+\/plan\.md$/.test(unquote(localUrl(target).pathname).replace(/^\.\//, ""));
        });
        return links;
    });
    if (candidates.length !== 1)
        fail("GOAL_MEMBERS_AMBIGUOUS", "无法唯一定位 Goal 的阶段组成章节。", goal.path);
    return candidates[0];
}
function insertMember(goal, relativePlan, id, title, contribution) {
    const section = memberSection(goal);
    const lines = [...section.body.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)].filter((match) => match[0]);
    const tableGroups = [];
    for (const line of lines) {
        if (!/^\|.*\|[ \t]*(?:\r?\n|\r)?$/.test(line[0]))
            continue;
        const last = tableGroups.at(-1);
        if (last && last.at(-1).index + last.at(-1)[0].length === line.index)
            last.push(line);
        else
            tableGroups.push([line]);
    }
    if (tableGroups.length !== 1 || tableGroups[0].length < 2)
        fail("GOAL_MEMBERS_AMBIGUOUS", "阶段组成需要唯一表格，不能猜插入其它正文。", goal.path);
    const table = tableGroups[0];
    const cells = (line) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((value) => value.trim());
    if (table.some((line) => cells(line[0]).length !== 3) || cells(table[1][0]).some((value) => !/^:?-{3,}:?$/.test(value)))
        fail("GOAL_MEMBERS_UNSUPPORTED", "阶段组成表必须有明确的三列与表头分隔。", goal.path);
    const last = table.at(-1);
    const offset = last.index + last[0].length;
    const ending = eol(goal.raw);
    const escape = (value) => value.replaceAll("|", "\\|");
    const row = "| [" + id + "](" + relativePlan + ") " + escape(title).replaceAll("[", "\\[").replaceAll("]", "\\]") + " | " + escape(contribution) + " | — |" + ending;
    let body = section.body.slice(0, offset) + (/[\r\n]$/.test(last[0]) ? "" : ending) + row + section.body.slice(offset);
    body = body.replace(/^当前没有已规划阶段。(?:\r\n|\n|\r)?/m, "");
    return goal.raw.slice(0, section.headEnd) + body + goal.raw.slice(section.end);
}
function active(object) {
    if (!["todo", "doing"].includes(object.status) || object.archived)
        fail("PARENT_CLOSED", "父对象已结束或归档，不能新增承诺。", object.path);
}
function allocate(kind, objects, supplied) {
    const prefix = kind === "phase" ? "P" : "T";
    const seen = new Set();
    let maximum = 0n;
    for (const object of objects) {
        const number = BigInt(object.id.slice(1));
        if (seen.has(number.toString()))
            fail("IDENTITY_AMBIGUOUS", "项目存在数值等价的重复编号。", object.path, 3);
        seen.add(number.toString());
        if (number > maximum)
            maximum = number;
    }
    if (supplied) {
        if (seen.has(BigInt(supplied.slice(1)).toString()))
            fail("IDENTITY_EXISTS", "编号已被本项目占用：" + supplied, "docs/goals", 3);
        return supplied;
    }
    return prefix + (maximum + 1n).toString().padStart(kind === "phase" ? 3 : 4, "0");
}
export function planCreate(rootInput, kind, parent, value, author) {
    if (!["goal", "phase", "task"].includes(kind))
        fail("INPUT_INVALID", "不支持的创建对象。", "arguments", 2);
    const input = validateCreateInput(kind, value);
    const context = loadWriteContext(rootInput, author, ["docs/sop/plan.md", "docs/sop/task.md"]);
    const { root } = context;
    const planRule = contextRule(context, "docs/sop/plan.md"), taskRule = contextRule(context, "docs/sop/task.md");
    const planSop = planRule.raw, taskSop = taskRule.raw;
    const { goal: goals, phase: phases, task: tasks } = context.objects;
    const changes = [];
    let id;
    let objectPath;
    if (kind === "goal") {
        if (parent !== undefined)
            fail("INPUT_INVALID", "Goal 不接受父对象参数。", "arguments", 2);
        id = input.id;
        if (goals.some((goal) => goal.id.toLowerCase() === id.toLowerCase()))
            fail("IDENTITY_EXISTS", "Goal 已存在。", "docs/goals", 3);
        const directory = path.posix.join("docs/goals", id.toLowerCase());
        objectPath = path.posix.join(directory, "plan.md");
        if (entryExists(root, directory))
            fail("TARGET_EXISTS", "Goal 目标目录已存在，不能覆盖或接管。", directory, 3);
        const rendered = renderPlan(skeleton(planSop, kind, planRule.path), kind, input, id, eol(planSop), planRule.path);
        memberSection({ raw: rendered, path: objectPath });
        changes.push({ path: objectPath, before: null, after: rendered });
    }
    else {
        if (!parent?.trim())
            fail("INPUT_INVALID", "创建阶段或任务需要明确父对象。", "arguments", 2);
        const owners = kind === "phase" ? goals : phases;
        const owner = owners.find((object) => object.id.toLowerCase() === parent.toLowerCase());
        if (!owner)
            fail("PARENT_NOT_FOUND", "本项目没有对应父对象：" + parent, "docs/goals");
        active(owner);
        const goal = kind === "phase" ? owner : goals.find((object) => object.id === owner.goalId);
        active(goal);
        id = allocate(kind, kind === "phase" ? phases : tasks, input.id);
        if (kind === "phase") {
            const goalDirectory = path.posix.dirname(goal.path);
            const directory = path.posix.join(goalDirectory, "phases", id.toLowerCase() + "-" + input.slug);
            objectPath = path.posix.join(directory, "plan.md");
            if (entryExists(root, directory))
                fail("TARGET_EXISTS", "Phase 目标目录已存在，不能覆盖或接管。", directory, 3);
            const ending = eol(goal.raw);
            changes.push({ path: objectPath, before: null, after: renderPlan(skeleton(planSop, kind, planRule.path), kind, input, id, ending, planRule.path) });
            changes.push({ path: path.posix.join(directory, "tasks.md"), before: null, after: taskSkeleton(skeleton(taskSop, "task", taskRule.path), undefined, "", id, ending, taskRule.path) });
            changes.push({ path: goal.path, before: goal.raw, after: insertMember(goal, path.posix.relative(goalDirectory, objectPath), id, input.title, input.contribution) });
        }
        else {
            objectPath = path.posix.join(path.posix.dirname(owner.path), "tasks.md");
            const before = readProjectText(root, objectPath);
            const ending = eol(before);
            const template = skeleton(taskSop, "task", taskRule.path);
            const empty = taskSkeleton(template, undefined, "", owner.id, ending, taskRule.path);
            const hasTasks = tasks.some((task) => task.phaseId === owner.id);
            const base = !hasTasks && before.startsWith(empty) ? before.slice(0, empty.length - ("尚未拆分任务。" + ending).length) + before.slice(empty.length) : before;
            const separator = base.endsWith(ending + ending) ? "" : base.endsWith(ending) ? ending : ending + ending;
            changes.push({ path: objectPath, before, after: base + separator + taskSkeleton(template, input, id, owner.id, ending, taskRule.path) });
        }
    }
    return finishPlan(context, kind + " new", { kind, id, path: objectPath }, { kind, parent: parent ?? null, input, author }, changes);
}
