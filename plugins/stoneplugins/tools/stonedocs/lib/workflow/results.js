import path from "node:path";
import { projectFileExists, readProjectText } from "../documents/files.js";
import { anchors, lineAt, parseTaskSections, withoutFences } from "../documents/markdown.js";
import { resolveProjectRoot } from "../documents/project.js";
import { readObjects } from "../documents/read.js";
import { OperationError } from "../files/write.js";
import { finishPlan, loadWriteContext, referenceLink, uniqueObject, validateReferences } from "./context.js";
import { inputObject, inputStrings, inputText, invalidInput } from "./json.js";
export const RESULT_INPUT = {
    required: ["schemaVersion", "date", "batch", "objectVersion", "standardVersion", "method", "actual", "evidence", "limits"],
    properties: {
        schemaVersion: "整数 1", date: "显式真实日期 YYYY-MM-DD", batch: "所有者内唯一小写英文数字 slug，以连字符分隔",
        objectVersion: "实际提交、构建或工作树范围及未提交状态", standardVersion: "实际标准及可核对版本",
        method: "实际操作、环境及命令退出码，可多行", actual: "真实观察与判断，可多行；不要求通过",
        evidence: "项目根相对文件引用数组，可带 anchor；明确无附件时 []", limits: "局限与后续字符串数组，明确无补充时 []",
    },
    example: { schemaVersion: 1, date: "2026-11-09", batch: "http-1", objectVersion: "6993bd3 + src/workflow 未提交修改", standardVersion: "本项目 verify SOP 与阶段条件", method: "执行聚焦检查，退出码 1。", actual: "失败：实际观察不符合条件。", evidence: [], limits: ["未覆盖外部运行环境。"] },
};
const LABELS = ["对象版本", "标准版本", "方法", "实际结果", "证据", "限制与后续"];
const BATCH = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const END = "<!-- /stonedocs:result:v1 -->";
const normalize = (raw) => raw.replace(/\r\n|\r/g, "\n");
const ending = (raw) => raw.match(/\r\n|\n|\r/)?.[0] ?? "\n";
function issue(code, message, file) {
    return { code, message, path: file, remedy: "核对唯一结果所有者及原始批次；保留旧内容，修正明确格式缺口或改用新的批次。" };
}
function fail(code, message, file, exitCode = 3) { throw new OperationError(issue(code, message, file), exitCode); }
function validate(value) {
    const data = inputObject(value, RESULT_INPUT.required, RESULT_INPUT.required);
    const date = inputText(data.date, "date");
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + "T00:00:00Z") : null;
    if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
        invalidInput("date 必须是 YYYY-MM-DD 的真实日历日期。");
    const batch = inputText(data.batch, "batch");
    if (!BATCH.test(batch))
        invalidInput("batch 必须是小写英文数字 slug，以单个连字符分隔。");
    return { schemaVersion: 1, date, batch, objectVersion: inputText(data.objectVersion, "objectVersion"), standardVersion: inputText(data.standardVersion, "standardVersion"), method: normalize(inputText(data.method, "method", true)), actual: normalize(inputText(data.actual, "actual", true)), evidence: inputStrings(data.evidence, "evidence", true), limits: inputStrings(data.limits, "limits", true) };
}
function anchor(owner, batch) { return "result-" + owner.kind + "-" + owner.id.toLowerCase() + "-" + batch; }
function literal(text) {
    const maximum = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
    const fence = "`".repeat(maximum + 1);
    return "  " + fence + "text\n" + (text ? text.split("\n").map((line) => "  " + line).join("\n") + "\n" : "") + "  " + fence;
}
function block(owner, file, input) {
    const fields = [literal(input.objectVersion), literal(input.standardVersion), literal(input.method), literal(input.actual), input.evidence.length ? input.evidence.map((ref) => "  - " + referenceLink(file, ref)).join("\n") : "  无。", literal(input.limits.join("\n"))];
    return "<!-- stonedocs:result:v1 " + owner.kind + " " + owner.id + " " + input.batch + " -->\n" + '<a id="' + anchor(owner, input.batch) + '"></a>\n' + (owner.kind === "task" ? "### " : "## ") + input.date + " · " + input.batch + "\n\n" + LABELS.map((label, index) => "- " + label + "：\n\n" + fields[index]).join("\n\n") + "\n" + END;
}
function parseLiteral(lines, cursor) {
    const open = /^  (`{3,})text$/.exec(lines[cursor.index++] ?? "");
    if (!open)
        throw new Error("结果文本围栏缺失。");
    const content = [];
    while (cursor.index < lines.length && lines[cursor.index] !== "  " + open[1]) {
        const line = lines[cursor.index++];
        if (!line.startsWith("  "))
            throw new Error("结果文本未隔离。");
        content.push(line.slice(2));
    }
    if (lines[cursor.index++] !== "  " + open[1])
        throw new Error("结果文本围栏未闭合。");
    return content.join("\n");
}
function parseBlock(owner, file, raw) {
    const lines = normalize(raw).split("\n");
    const header = new RegExp("^" + (owner.kind === "task" ? "### " : "## ") + "(\\d{4}-\\d{2}-\\d{2}) · ([a-z0-9-]+)$").exec(lines[2] ?? "");
    if (!header)
        throw new Error("批次标题无效。");
    const cursor = { index: 4 };
    const values = [];
    const evidence = [];
    for (let index = 0; index < LABELS.length; index++) {
        if (lines[cursor.index++] !== "- " + LABELS[index] + "：" || lines[cursor.index++] !== "")
            throw new Error("批次字段缺失、重复或顺序不明。");
        if (index === 4) {
            if (lines[cursor.index] === "  无。")
                cursor.index++;
            else
                while (lines[cursor.index]?.startsWith("  - ")) {
                    const entry = /^  - \[((?:\\.|[^\]])*)\]\([^)]+\)$/.exec(lines[cursor.index++]);
                    if (!entry)
                        throw new Error("证据引用格式不明。");
                    evidence.push(entry[1].replace(/\\([\\\[\]`])/g, "$1").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"));
                }
            if (!evidence.length && lines[cursor.index - 1] !== "  无。")
                throw new Error("证据数组格式不明。");
            values.push("");
        }
        else
            values.push(parseLiteral(lines, cursor));
        if (index < LABELS.length - 1 && (lines[cursor.index++] !== ""))
            throw new Error("字段间隔无效。");
    }
    const input = validate({ schemaVersion: 1, date: header[1], batch: header[2], objectVersion: values[0], standardVersion: values[1], method: values[2], actual: values[3], evidence, limits: values[5] ? values[5].split("\n") : [] });
    if (block(owner, file, input) !== normalize(raw))
        throw new Error("批次正文与版本 1 格式不一致。");
    return input;
}
function resultPath(owner) { return owner.kind === "task" ? owner.path : path.posix.join(path.posix.dirname(owner.path), "verification.md"); }
function legacyContent(owner, raw) {
    if (owner.kind !== "task")
        return raw.trim();
    return raw.split(/\r\n|\n|\r/).filter((line) => !/^## T\d+\s*·/.test(line) && !/^-[ \t]+(?:状态|交付物|完成条件|材料|依赖|接续说明)[：:]/.test(line) && line !== "- 验证结果：尚未执行。" && !/^- 验证结果：\[批次记录\]\(#result-task-[a-z0-9-]+\)。$/.test(line)).join("\n").trim();
}
function inspect(owner, file, raw, warnings) {
    const records = [];
    const ranges = [];
    const clean = withoutFences(raw).clean;
    const markers = [...clean.matchAll(/^ {0,3}<!--[ \t]*\/?stonedocs:result[^\r\n]*$/gm)];
    const seen = new Set();
    for (let index = 0; index < markers.length; index++) {
        const opening = markers[index];
        const start = /^<!-- stonedocs:result:v1 (goal|phase|task) ([A-Za-z][A-Za-z0-9._-]*) ([a-z0-9-]+) -->$/.exec(opening[0]);
        const closing = markers[index + 1];
        if (!start || start[1] !== owner.kind || start[2] !== owner.id || !closing || closing[0] !== END) {
            warnings.push(issue("RESULT_FORMAT_INVALID", "结果注释缺失、版本未知、归属不符或块未闭合；保留原文。", file));
            continue;
        }
        index++;
        const end = closing.index + closing[0].length;
        const original = raw.slice(opening.index, end);
        try {
            const input = parseBlock(owner, file, original);
            if (seen.has(input.batch))
                warnings.push(issue("RESULT_BATCH_DUPLICATE", "结果所有者内批次重复：" + input.batch, file));
            seen.add(input.batch);
            records.push({ ...input, anchor: anchor(owner, input.batch), path: file, lineStart: lineAt(raw, opening.index) + (owner.kind === "task" ? owner.lineStart - 1 : 0), lineEnd: lineAt(raw, end - 1) + (owner.kind === "task" ? owner.lineStart - 1 : 0), raw: original });
            ranges.push([opening.index, end]);
        }
        catch {
            warnings.push(issue("RESULT_FORMAT_INVALID", "结果块正文无法按版本 1 识别；保留原文。", file));
        }
    }
    let remaining = raw;
    for (const [start, end] of ranges.reverse())
        remaining = remaining.slice(0, start) + remaining.slice(end);
    const legacy = legacyContent(owner, remaining);
    if (legacy)
        warnings.push(issue("RESULT_LEGACY_CONTENT", "存在未结构化原文；不能将它视为没有结果。", file));
    return { owner, path: file, raw, records, legacy, warnings };
}
export function readResults(rootInput, kind, id, batch) {
    const root = resolveProjectRoot(rootInput);
    const selected = readObjects(root, kind, { id });
    const owner = selected.objects[0];
    if (batch !== undefined && !BATCH.test(batch))
        invalidInput("batch 格式无效。");
    const file = resultPath(owner);
    const raw = owner.kind === "task" ? owner.raw : projectFileExists(root, file) ? readProjectText(root, file) : "";
    const result = inspect(owner, file, raw, selected.warnings);
    if (batch !== undefined) {
        result.records = result.records.filter((record) => record.batch === batch);
        if (!result.records.length)
            result.warnings.push(issue("RESULT_BATCH_NOT_FOUND", "没有可识别的指定批次；原文与格式缺口仍保留。", file));
    }
    return result;
}
function skeleton(root) {
    const source = readProjectText(root, "docs/sop/verify.md");
    const matches = [...source.matchAll(/^ {0,3}(`{3,}|~{3,})markdown[ \t]*\r?\n([\s\S]*?)^ {0,3}\1[ \t]*\r?$/gm)].filter((match) => /^# <Goal 或阶段交付目标> 验收记录$/m.test(normalize(match[2])));
    if (matches.length !== 1)
        fail("SOP_TEMPLATE_AMBIGUOUS", "verify SOP 的验收骨架必须唯一。", "docs/sop/verify.md", 1);
    const template = normalize(matches[0][2]);
    const labels = [...template.matchAll(/^- ([^：\r\n]+)：/gm)].map((match) => match[1]);
    if (JSON.stringify(labels) !== JSON.stringify(LABELS) || !/^## <日期> · <本结果所有者内唯一批次>$/m.test(template))
        fail("SOP_TEMPLATE_UNSUPPORTED", "verify SOP 必要字段或批次入口无法明确填写。", "docs/sop/verify.md", 1);
    return template;
}
export function planResult(root, kind, id, value, author) {
    const context = loadWriteContext(root, author, ["docs/sop/verify.md"]);
    const owner = uniqueObject(context, kind, id);
    const input = validate(value);
    const parents = [owner, ...context.objects.goal.filter((goal) => goal.id === owner.goalId), ...context.objects.phase.filter((phase) => phase.id === owner.phaseId)];
    if (parents.some((object) => object.archived))
        fail("OBJECT_ARCHIVED", "对象或祖先已归档，普通结果新增不修改历史。", owner.path, 1);
    const template = skeleton(context.root);
    const references = validateReferences(context, input.evidence);
    const file = resultPath(owner);
    const before = owner.kind === "task" ? readProjectText(context.root, file) : projectFileExists(context.root, file) ? readProjectText(context.root, file) : null;
    const raw = owner.kind === "task" ? owner.raw : before ?? "";
    const result = inspect(owner, file, raw, []);
    const malformed = result.warnings.find((warning) => ["RESULT_FORMAT_INVALID", "RESULT_BATCH_DUPLICATE"].includes(warning.code));
    if (malformed)
        fail(malformed.code, malformed.message, file);
    const prior = result.records.find((record) => record.batch === input.batch);
    if (prior && JSON.stringify({ schemaVersion: prior.schemaVersion, date: prior.date, batch: prior.batch, objectVersion: prior.objectVersion, standardVersion: prior.standardVersion, method: prior.method, actual: prior.actual, evidence: prior.evidence, limits: prior.limits }) !== JSON.stringify(input))
        fail("RESULT_BATCH_CONFLICT", "同批次已有不同内容，不能覆盖。", file);
    const request = { kind, id: owner.id, input, author };
    if (prior)
        return finishPlan(context, "result add", { kind, id: owner.id, path: file }, request, [], [...references, file]);
    if (anchors(before ?? "").has(anchor(owner, input.batch)))
        fail("RESULT_ANCHOR_CONFLICT", "拟用的稳定结果 anchor 已被现有正文占用。", file);
    const eol = ending(before ?? owner.raw);
    const rendered = block(owner, file, input).replaceAll("\n", eol);
    const append = (base) => base + (base.endsWith(eol + eol) ? "" : base.endsWith(eol) ? eol : eol + eol) + rendered + eol;
    let after;
    if (owner.kind === "task") {
        const section = parseTaskSections(before).find((task) => task.id === owner.id);
        const placeholders = [...withoutFences(section.raw).clean.matchAll(/^- 验证结果：尚未执行。(?=\r?$)/gm)];
        if (placeholders.length > 1)
            fail("RESULT_PLACEHOLDER_AMBIGUOUS", "Task 存在多个未执行占位，不能猜测替换位置。", file);
        const placeholder = placeholders[0];
        const body = placeholder ? section.raw.slice(0, placeholder.index) + "- 验证结果：[批次记录](#" + anchor(owner, input.batch) + ")。" + section.raw.slice(placeholder.index + placeholder[0].length) : section.raw;
        after = before.slice(0, section.start) + append(body) + (section.end < before.length ? eol : "") + before.slice(section.end);
    }
    else {
        let base = before;
        if (base === null) {
            const prefix = template.slice(0, template.indexOf("## <日期>"));
            base = prefix.replace("<Goal 或阶段交付目标>", owner.id + " · " + owner.title).replace(/<要回答的问题、关联成果\/Task、标准来源，以及本记录的覆盖边界。>/, "本记录针对[" + owner.id + "](plan.md)，实际覆盖以各批方法、观察和限制为准。").trimEnd().replaceAll("\n", eol) + eol;
        }
        after = append(base);
    }
    return finishPlan(context, "result add", { kind, id: owner.id, path: file }, request, [{ path: file, before, after }], references);
}
