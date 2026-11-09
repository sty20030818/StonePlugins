import { anchors, withoutFences, withoutFrontmatter } from "../documents/markdown.js";
import { lstatSync } from "node:fs";
import { isMissing, projectPath, readProjectText, ReadError } from "../documents/files.js";
import { resolveProjectRoot } from "../documents/project.js";
import { readObjects } from "../documents/read.js";
import { OperationError } from "../files/write.js";
import { currentAdoptionFile } from "./adoption.js";
import { finishPlan, loadWriteContext, uniqueObject, validateReferences } from "./context.js";
import { invalidInput } from "./json.js";
import { canonicalReleaseVersion, containsReleaseVersion, inspectReleaseBlocks, releaseAnchor, releaseReferenceKind, renderReleasePlan, renderReleaseRecord, validateReleasePlan, validateReleaseRecord } from "./release-format.js";
const RECORDS = "docs/releases.md";
function issue(code, message, file) {
    return { code, message, path: file, remedy: "保留原文，核对唯一发布意图、实际发布事实及对应版本；不要借重试覆盖历史或复制同版计划。" };
}
function fail(code, message, file, exitCode = 3) { throw new OperationError(issue(code, message, file), exitCode); }
function owner(object) { return { kind: object.kind, id: object.id, path: object.path }; }
function distinct(issues) { return [...new Map(issues.map((value) => [JSON.stringify(value), value])).values()]; }
function readOptionalRecords(root) {
    const file = projectPath(root, RECORDS);
    try {
        lstatSync(file);
    }
    catch (error) {
        if (isMissing(error))
            return null;
        const cause = error.code;
        throw new ReadError(issue("IO_ERROR", "发布资料读取未完成" + (cause ? "（" + cause + "）" : "") + "。", RECORDS), 4);
    }
    return readProjectText(root, RECORDS);
}
function catalog(root, objects, writing = false) {
    const warnings = [];
    const owners = objects ?? ["goal", "phase"].flatMap((kind) => { const found = readObjects(root, kind); warnings.push(...found.warnings); return found.objects; });
    const sources = owners.map((object) => ({ ...inspectReleaseBlocks(object.raw, object.path), owner: owner(object) }));
    const recordsRaw = writing ? currentAdoptionFile(root, RECORDS, "RELEASE_TARGET_INVALID") : readOptionalRecords(root);
    sources.push({ ...inspectReleaseBlocks(recordsRaw ?? "", RECORDS), owner: null });
    const plans = [], records = [], conflicts = [];
    for (const source of sources) {
        warnings.push(...source.warnings);
        if (source.owner) {
            plans.push(...source.plans.map((entry) => ({ ...entry, owner: source.owner })));
            if (source.records.length)
                warnings.push(issue("RELEASE_LOCATION_INVALID", "实际发布记录位于目标/阶段计划内；原文保留，但不作为根发布事实。", source.path));
        }
        else {
            records.push(...source.records);
            if (source.plans.length)
                warnings.push(issue("RELEASE_LOCATION_INVALID", "发布意图位于根发布记录内；原文保留，但不作为唯一承接计划。", source.path));
        }
    }
    for (const entries of [plans, records]) {
        const grouped = new Map();
        for (const entry of entries)
            grouped.set(entry.version, [...(grouped.get(entry.version) ?? []), entry]);
        for (const [version, matches] of grouped)
            if (matches.length > 1)
                for (const entry of matches)
                    conflicts.push(issue("RELEASE_VERSION_DUPLICATE", "同类发布资料中版本重复：" + version + "；位置：" + matches.map((match) => match.path + ":" + match.lineStart).join("、"), entry.path));
    }
    return { plans, records, sources, warnings: distinct(warnings), conflicts: distinct(conflicts), owners, recordSnapshot: recordsRaw };
}
function validateCatalog(value) {
    const invalid = value.conflicts[0] ?? value.warnings.find((warning) => warning.code !== "RELEASE_LEGACY_CONTENT");
    if (invalid)
        throw new OperationError(invalid, 3);
}
function legacyCheck(value, version, kind) {
    const source = value.sources.find((source) => (kind === "plan" ? source.owner !== null : source.owner === null) && containsReleaseVersion(source.legacy, version));
    if (source)
        fail("RELEASE_LEGACY_CONFLICT", "未结构化资料中出现本版本，不能据此认定意图或实际记录不存在：" + version, source.path);
}
function eol(raw) { return raw.match(/\r\n|\n|\r/)?.[0] ?? "\n"; }
function separate(raw, ending) { return raw + (raw.endsWith(ending + ending) ? "" : raw.endsWith(ending) ? ending : ending + ending); }
function appendIntent(raw, kind, block, file) {
    const ending = eol(raw), clean = withoutFences(withoutFrontmatter(raw)).clean;
    const headings = [...clean.matchAll(/^ {0,3}(#{1,2})(?:[ \t]+([^\r\n]*))?(?=\r?$)/gm)].map((heading) => ({ start: heading.index, level: heading[1].length, title: (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim() }));
    const sections = headings.filter((heading) => heading.level === 2 && ["发布意图", "材料与发布意图"].includes(heading.title));
    if (sections.length > 1)
        fail("RELEASE_SECTION_AMBIGUOUS", "计划存在多个发布意图章节，不能猜测插入位置。", file);
    if (!sections.length)
        return separate(raw, ending) + "## " + (kind === "goal" ? "材料与发布意图" : "发布意图") + ending + ending + block + ending;
    const section = sections[0], end = headings.find((heading) => heading.start > section.start)?.start ?? raw.length;
    return separate(raw.slice(0, end), ending) + block + ending + ending + raw.slice(end);
}
function sameInput(entry, value) {
    const normalized = entry.kind === "plan" ? validateReleasePlan(value) : validateReleaseRecord(value);
    const fields = entry.kind === "plan" ? ["schemaVersion", "version", "includes", "criteria"] : ["schemaVersion", "version", "date", "scope", "artifacts", "evidence", "limits"];
    return JSON.stringify(Object.fromEntries(fields.map((key) => [key, entry[key]]))) === JSON.stringify(normalized);
}
function assertSnapshot(root, value) {
    let current;
    try {
        current = ["goal", "phase"].flatMap((kind) => readObjects(root, kind).objects);
    }
    catch (error) {
        if (error instanceof ReadError && error.exitCode !== 4)
            fail("CONTENT_CHANGED", "参与版本盘点的对象或成员结构已变化，请重新读取。", error.diagnostic.path);
        throw error;
    }
    const signature = (objects) => JSON.stringify(objects.map((object) => ({ kind: object.kind, id: object.id, path: object.path, raw: object.raw })).sort((left, right) => (left.kind + ":" + left.path).localeCompare(right.kind + ":" + right.path)));
    if (signature(current) !== signature(value.owners))
        fail("CONTENT_CHANGED", "参与版本唯一性判断的计划正文或成员集合已变化，请重新生成计划。", "docs/goals");
    if (currentAdoptionFile(root, RECORDS, "RELEASE_TARGET_INVALID") !== value.recordSnapshot)
        fail("CONTENT_CHANGED", "实际发布记录或其存在状态在本次盘点中变化，请重新生成计划。", RECORDS);
}
function finishRelease(context, value, command, object, request, changes, extraBasis) {
    const plan = finishPlan(context, command, object, request, changes, extraBasis);
    assertSnapshot(context.root, value);
    return plan;
}
function base(context) { return catalog(context.root, [...context.objects.goal, ...context.objects.phase], true); }
function localBasis(context, refs) { return validateReferences(context, refs.filter((ref) => releaseReferenceKind(ref) === "local")); }
function archiveGuard(context, object) {
    if (object.archived || (object.kind === "phase" && uniqueObject(context, "goal", object.goalId).archived))
        fail("OBJECT_ARCHIVED", "承接对象或所属目标已归档，不能追加普通发布意图。", object.path, 1);
}
export function planRelease(rootInput, kind, id, value, author) {
    if (kind !== "goal" && kind !== "phase")
        invalidInput("发布意图只由 Goal 或 Phase 的唯一plan承接。");
    const input = validateReleasePlan(value), context = loadWriteContext(rootInput, author, ["docs/sop/plan.md"]), object = uniqueObject(context, kind, id);
    archiveGuard(context, object);
    const found = base(context);
    validateCatalog(found);
    const references = localBasis(context, input.includes);
    const prior = found.plans.find((entry) => entry.version === input.version);
    const request = { kind, id: object.id, input, author };
    const finish = (changes) => finishRelease(context, found, "release plan", { kind: "release-plan", id: input.version, path: object.path }, request, changes, [RECORDS, ...references]);
    if (prior) {
        if (prior.owner.kind !== kind || prior.owner.id !== object.id || !sameInput(prior, input))
            fail("RELEASE_VERSION_CONFLICT", "本版本已有不同承接对象或不同内容的发布意图，不能覆盖或复制。", prior.path);
        legacyCheck(found, input.version, "plan");
        return finish([]);
    }
    legacyCheck(found, input.version, "plan");
    const anchor = releaseAnchor("plan", input.version);
    if (anchors(object.raw).has(anchor))
        fail("RELEASE_ANCHOR_CONFLICT", "发布意图稳定anchor已被现有原文占用。", object.path);
    const block = renderReleasePlan(object.path, input).replaceAll("\n", eol(object.raw));
    const after = appendIntent(object.raw, kind, block, object.path);
    return finish([{ path: object.path, before: object.raw, after }]);
}
export function planReleaseRecord(rootInput, value, author) {
    const input = validateReleaseRecord(value), context = loadWriteContext(rootInput, author), found = base(context);
    validateCatalog(found);
    const references = localBasis(context, [...input.scope, ...input.artifacts, ...input.evidence]);
    const original = found.recordSnapshot, before = original ?? "";
    const request = { input, author };
    const finish = (changes) => finishRelease(context, found, "release record", { kind: "release-record", id: input.version, path: RECORDS }, request, changes, [RECORDS, ...references]);
    const prior = found.records.find((entry) => entry.version === input.version);
    if (prior) {
        if (!sameInput(prior, input))
            fail("RELEASE_VERSION_CONFLICT", "本版本已有不同实际记录，不能借重试修改已发布事实。", RECORDS);
        legacyCheck(found, input.version, "record");
        return finish([]);
    }
    legacyCheck(found, input.version, "record");
    if (anchors(before).has(releaseAnchor("record", input.version)))
        fail("RELEASE_ANCHOR_CONFLICT", "实际记录稳定anchor已被现有原文占用。", RECORDS);
    const ending = eol(before), block = renderReleaseRecord(RECORDS, input).replaceAll("\n", ending);
    const after = separate(original ?? "# 发布记录" + ending, ending) + block + ending;
    return finish([{ path: RECORDS, before: original, after }]);
}
export function readRelease(rootInput, query) {
    if (!query || typeof query !== "object" || Array.isArray(query) || Object.keys(query).some((key) => !["version", "goal", "phase"].includes(key)))
        invalidInput("发布查询只接受版本或唯一Goal/Phase。");
    const values = Object.entries(query).filter(([, value]) => value !== undefined);
    if (values.length !== 1 || typeof values[0][1] !== "string" || !values[0][1].trim())
        invalidInput("发布查询须且仅须提供版本、Goal 或 Phase之一。");
    const root = resolveProjectRoot(rootInput), found = catalog(root);
    let plans, records, normalized;
    if (query.version !== undefined) {
        const version = canonicalReleaseVersion(query.version);
        normalized = { version };
        plans = found.plans.filter((entry) => entry.version === version);
        records = found.records.filter((entry) => entry.version === version);
    }
    else {
        const kind = query.goal !== undefined ? "goal" : "phase", id = query.goal ?? query.phase;
        const candidates = found.owners.filter((object) => object.kind === kind && object.id.toLowerCase() === id.toLowerCase());
        if (candidates.length !== 1)
            fail(candidates.length ? "OBJECT_ID_DUPLICATE" : "OBJECT_NOT_FOUND", "项目不能唯一定位发布意图承接对象：" + id, "docs/goals", candidates.length ? 3 : 1);
        const selected = candidates[0];
        normalized = kind === "goal" ? { goal: selected.id } : { phase: selected.id };
        plans = found.plans.filter((entry) => entry.owner.kind === kind && entry.owner.id === selected.id);
        const versions = new Set(plans.map((entry) => entry.version));
        records = found.records.filter((entry) => versions.has(entry.version));
    }
    const warnings = [...found.warnings];
    if (!plans.length && !records.length)
        warnings.push(issue("RELEASE_NOT_FOUND", "没有可识别的匹配原生条目；原始资料及未知格式仍保留，不能据此判断未规划或未发布。", RECORDS));
    return { query: normalized, plans, records, sources: found.sources, warnings: distinct(warnings), conflicts: found.conflicts };
}
