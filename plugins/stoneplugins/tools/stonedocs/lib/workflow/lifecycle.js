import { readProjectText } from "../documents/files.js";
import { parseTaskSections, withoutFences } from "../documents/markdown.js";
import { OperationError } from "../files/write.js";
import { finishPlan, loadWriteContext, referenceLink, uniqueObject, validateReferences } from "./context.js";
import { inputObject, inputStrings, inputText, invalidInput } from "./json.js";
export const LIFECYCLE_INPUTS = {
    done: {
        required: ["schemaVersion", "evidence"],
        properties: { schemaVersion: "固定整数 1", evidence: "非空根相对文件引用数组，可带 anchor；只验证可定位，不代判业务通过" },
        example: { schemaVersion: 1, evidence: ["docs/goals/v1/phases/p001-result/tasks.md#t0001--实际成果"] },
    },
    cancel: {
        required: ["schemaVersion", "reason", "handoff"],
        properties: { schemaVersion: "固定整数 1", reason: "非空单行取消原因", handoff: "根相对接收引用数组；没有未结束子工作可为空" },
        example: { schemaVersion: 1, reason: "范围已明确调整", handoff: ["docs/goals/v1/phases/p002-next/plan.md"] },
    },
    archive: {
        required: ["schemaVersion", "review", "handoff"],
        properties: { schemaVersion: "固定整数 1", review: "已有收尾记录的根相对文件引用，可带 anchor", handoff: "根相对遗留接收引用数组；没有未结束工作可为空" },
        example: { schemaVersion: 1, review: "docs/goals/v1/phases/p001-result/plan.md#收尾", handoff: [] },
    },
};
function fail(code, message, file, exitCode = ["ENDING_CONFLICT", "CLOSURE_AMBIGUOUS"].includes(code) ? 3 : 1) {
    throw new OperationError({ code, message, path: file, remedy: "核对当前对象、实际依据和遗留接收位置后重试；历史更正不能通过重试覆盖。" }, exitCode);
}
function inputFor(action, value) {
    if (action === "start") {
        if (value !== undefined)
            invalidInput("start 不接受输入正文。");
        return null;
    }
    const definition = LIFECYCLE_INPUTS[action];
    const input = inputObject(value, Object.keys(definition.properties), definition.required);
    if (action === "done")
        return { schemaVersion: 1, evidence: inputStrings(input.evidence, "evidence") };
    const handoff = inputStrings(input.handoff, "handoff", true);
    return action === "cancel" ? { schemaVersion: 1, reason: inputText(input.reason, "reason"), handoff } : { schemaVersion: 1, review: inputText(input.review, "review"), handoff };
}
function ending(text) { return text.match(/\r\n|\n|\r/)?.[0] ?? "\n"; }
function separated(text, eol) { return text + (text.endsWith(eol + eol) ? "" : text.endsWith(eol) ? eol : eol + eol); }
function plain(text) { return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/[\\`*_[\]]/g, "\\$&"); }
function block(action, input, ownerPath, eol) {
    const lines = ["<!-- stonedocs:lifecycle:" + action + ":v1 -->"];
    if (action === "done")
        lines.push("### 完成依据", "", ...input.evidence.map((ref) => "- 依据：" + referenceLink(ownerPath, ref)));
    else if (action === "cancel")
        lines.push("### 取消依据", "", "- 原因：" + plain(input.reason));
    else
        lines.push("### 归档依据", "", "- 收尾：" + referenceLink(ownerPath, input.review));
    if (action !== "done")
        lines.push(...(input.handoff.length ? input.handoff.map((ref) => "- 接收：" + referenceLink(ownerPath, ref)) : ["- 遗留：无未结束工作需要接收。"]));
    lines.push("<!-- /stonedocs:lifecycle:" + action + ":v1 -->");
    return lines.join(eol);
}
/** 只识别本工具的有界原文，不从任意人工文字猜测上次请求。 */
function records(raw, file) {
    const clean = withoutFences(raw).clean;
    const markers = [...clean.matchAll(/^<!-- (\/?)stonedocs:lifecycle:(done|cancel|archive):v1 -->(?=\r?$)/gm)];
    const candidates = [...clean.matchAll(/^ {0,3}<!--[ \t]*\/?[ \t]*stonedocs:lifecycle\b[^\r\n]*$/gm)];
    if (candidates.length !== markers.length)
        fail("ENDING_CONFLICT", "已有生命周期记录边界未知或不完整。", file);
    const found = new Map();
    for (let index = 0; index < markers.length; index += 2) {
        const open = markers[index];
        const close = markers[index + 1];
        const action = open[2];
        if (open[1] || !close || close[1] !== "/" || close[2] !== action || found.has(action))
            fail("ENDING_CONFLICT", "已有生命周期记录重复、交叉或不完整。", file);
        found.set(action, raw.slice(open.index, close.index + close[0].length));
    }
    if (found.has("done") && found.has("cancel"))
        fail("ENDING_CONFLICT", "同一对象存在互相冲突的结束依据。", file);
    return found;
}
function validateObjectHistory(object) {
    const history = records(object.raw, object.path);
    if ((history.has("done") && object.status !== "done") || (history.has("cancel") && object.status !== "cancelled") || (history.has("archive") && (!object.archived || object.kind === "task")))
        fail("ENDING_CONFLICT", "对象当前状态与已有结束或归档记录不一致。", object.path);
    return history;
}
function appendRecord(raw, object, record, eol) {
    if (object.kind === "task")
        return separated(raw, eol) + record + eol + eol;
    const clean = withoutFences(raw).clean;
    const headings = [...clean.matchAll(/^ {0,3}(#{1,2})(?:[ \t]+([^\r\n]*))?(?=\r?$)/gm)].map((match) => ({ index: match.index, level: match[1].length, title: (match[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim() }));
    const closure = headings.filter((heading) => heading.level === 2 && heading.title === "收尾");
    if (closure.length > 1)
        fail("CLOSURE_AMBIGUOUS", "plan 存在多个收尾章节，不能猜测写入位置。", object.path);
    if (!closure.length)
        return separated(raw, eol) + "## 收尾" + eol + eol + record + eol;
    const section = closure[0];
    const end = headings.find((heading) => heading.index > section.index)?.index ?? raw.length;
    return separated(raw.slice(0, end), eol) + record + eol + eol + raw.slice(end);
}
function metadataChange(raw, field, value, file) {
    const end = /(?:\r\n|\n|\r)---[ \t]*(?=\r?$)/m.exec(raw);
    if (!end)
        fail("BASIS_INVALID", "对象缺少完整元数据。", file);
    const header = raw.slice(0, end.index);
    const fieldPattern = new RegExp("^(" + field + ":[ \\t]*)([\\\"']?)(?:todo|doing|done|cancelled|true|false)\\2([ \\t]*(?:#.*)?)(?=\\r?$)", "m");
    if (fieldPattern.test(header))
        return header.replace(fieldPattern, (_, prefix, quote, suffix) => prefix + quote + value + quote + suffix) + raw.slice(end.index);
    if (field === "status")
        fail("BASIS_INVALID", "对象状态无法唯一更新。", file);
    return header + ending(raw) + field + ": " + value + raw.slice(end.index);
}
function taskChange(raw, value, file) {
    const clean = withoutFences(raw).clean;
    const matches = [...clean.matchAll(/^(-[ \t]+状态[ \t]*[：:][ \t]*)(todo|doing|done|cancelled)([ \t]*)(?=\r?$)/gm)];
    if (matches.length !== 1)
        fail("BASIS_INVALID", "Task 状态无法唯一更新。", file);
    const match = matches[0];
    return raw.slice(0, match.index) + match[1] + value + match[3] + raw.slice(match.index + match[0].length);
}
function ancestors(context, object) {
    return object.kind === "goal" ? [] : object.kind === "phase" ? [uniqueObject(context, "goal", object.goalId)] : [uniqueObject(context, "phase", object.phaseId), uniqueObject(context, "goal", object.goalId)];
}
function openChildren(context, object) {
    if (object.kind === "task")
        return [];
    const children = object.kind === "phase" ? context.objects.task.filter((task) => task.phaseId === object.id) : [...context.objects.phase.filter((phase) => phase.goalId === object.id), ...context.objects.task.filter((task) => task.goalId === object.id)];
    for (const child of children)
        validateObjectHistory(child);
    return children.filter((child) => ["todo", "doing"].includes(child.status));
}
export function planLifecycle(rootInput, kind, id, action, value, author) {
    if (!["goal", "phase", "task"].includes(kind) || !["start", "done", "cancel", "archive"].includes(action))
        invalidInput("未知生命周期对象或动作。");
    if (kind === "task" && action === "archive")
        invalidInput("Task 随所属 Phase 归档，没有独立 archive 动作。");
    const input = inputFor(action, value);
    const context = loadWriteContext(rootInput, author, ["docs/sop/task.md", "docs/sop/review.md"]);
    const object = uniqueObject(context, kind, id);
    const parents = ancestors(context, object);
    const history = validateObjectHistory(object);
    const eol = ending(object.raw);
    const expected = action === "start" ? null : block(action, input, object.path, eol);
    const refs = action === "done" ? input.evidence : action === "cancel" ? input.handoff : action === "archive" ? [input.review, ...input.handoff] : [];
    const basis = validateReferences(context, refs);
    const request = { kind, id: object.id, action, input, author };
    const finish = (changes) => finishPlan(context, kind + " " + action, { kind, id: object.id, path: object.path }, request, changes, basis);
    if (action === "archive" && object.archived) {
        if (history.get("archive") === expected)
            return finish([]);
        fail("ENDING_CONFLICT", "已归档对象的依据与本次请求不同，不能通过重试更正。", object.path);
    }
    for (const parent of parents)
        validateObjectHistory(parent);
    if (object.archived || parents.some((parent) => parent.archived))
        fail("OBJECT_ARCHIVED", "对象或其所属目标/阶段已归档，常规写入拒绝。", object.path);
    if (action === "start") {
        if (!["todo", "doing"].includes(object.status))
            fail("STATE_TRANSITION_INVALID", "已结束对象不能重新开工。", object.path);
        if (history.size)
            fail("ENDING_CONFLICT", "活跃状态与已有结束记录不一致。", object.path);
        if (parents.some((parent) => !["todo", "doing"].includes(parent.status)))
            fail("PARENT_CLOSED", "所属目标或阶段已结束，不能开始工作。", object.path);
        if (kind === "task" && parents[0].status !== "doing")
            fail("PHASE_NOT_STARTED", "Task 开工前须显式 phase start，将所属 Phase 设为 doing。", parents[0].path);
        if (object.status === "doing")
            return finish([]);
    }
    else if (action === "archive") {
        if (!["done", "cancelled"].includes(object.status))
            fail("STATE_TRANSITION_INVALID", "只有已结束 Goal/Phase 可以归档。", object.path);
        if (history.has("archive"))
            fail("ENDING_CONFLICT", "归档属性与已有归档记录不一致。", object.path);
        if (openChildren(context, object).length && !input.handoff.length)
            fail("HANDOFF_REQUIRED", "归档前须明确仍未结束工作的接收位置。", object.path);
    }
    else {
        const target = action === "done" ? "done" : "cancelled";
        if (object.status === target) {
            if (history.get(action) === expected)
                return finish([]);
            fail("ENDING_CONFLICT", "已有结束依据无法确证为同一请求，不能静默覆盖。", object.path);
        }
        if (!["todo", "doing"].includes(object.status))
            fail("STATE_TRANSITION_INVALID", "done 与 cancelled 不能通过普通状态操作互换。", object.path);
        if (history.size)
            fail("ENDING_CONFLICT", "活跃状态与已有结束记录不一致。", object.path);
        if (action === "done") {
            const members = kind === "goal" ? context.objects.phase.filter((phase) => phase.goalId === object.id) : [];
            for (const member of members)
                validateObjectHistory(member);
            const blocked = kind === "goal" ? members.filter((phase) => phase.status !== "done") : openChildren(context, object);
            if (blocked.length)
                fail("OPEN_CHILDREN", kind === "goal" ? "Goal 完成前所有组成 Phase 须为 done。" : "Phase 完成前不能保留 todo/doing Task。", object.path);
        }
        else if (openChildren(context, object).length && !input.handoff.length)
            fail("HANDOFF_REQUIRED", "取消前须明确未结束子工作的接收位置。", object.path);
    }
    let after = action === "archive" ? metadataChange(object.raw, "archived", "true", object.path) : kind === "task" ? taskChange(object.raw, action === "start" ? "doing" : action === "done" ? "done" : "cancelled", object.path) : metadataChange(object.raw, "status", action === "start" ? "doing" : action === "done" ? "done" : "cancelled", object.path);
    if (expected)
        after = appendRecord(after, object, expected, eol);
    let before = object.raw;
    if (kind === "task") {
        before = readProjectText(context.root, object.path);
        const matches = parseTaskSections(before).filter((section) => section.id === object.id);
        if (matches.length !== 1 || matches[0].raw !== object.raw)
            fail("IDENTITY_AMBIGUOUS", "写前 Task 区间或身份已变化。", object.path, 3);
        const section = matches[0];
        after = before.slice(0, section.start) + after + before.slice(section.end);
    }
    return finish([{ path: object.path, before, after }]);
}
