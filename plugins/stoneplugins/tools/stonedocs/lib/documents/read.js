import path from "node:path";
import { projectDirectories, projectFileExists, readProjectText, ReadError } from "./files.js";
import { documentTitle, lineAt, metadata, parseTaskSections, STATES, withoutFences } from "./markdown.js";
import { resolveProjectRoot } from "./project.js";
function diagnostic(code, message, file) {
    return { code, message, path: file, remedy: "核对项目内唯一身份、所属目录和该对象原文；不通过筛选或猜值绕过结构缺口。" };
}
function reject(code, message, file, exitCode = 1) {
    throw new ReadError(diagnostic(code, message, file), exitCode);
}
function identityPattern(kind) {
    return kind === "goal" ? /^[A-Za-z][A-Za-z0-9._-]*$/ : kind === "phase" ? /^P\d+$/ : /^T\d+$/;
}
function plan(root, file, kind, parent) {
    const exists = projectFileExists(root, file);
    const raw = exists ? readProjectText(root, file) : "";
    const data = metadata(raw);
    const ids = data?.get("id") ?? [];
    const statuses = data?.get("status") ?? [];
    const archived = data?.get("archived") ?? [];
    const directory = path.basename(path.dirname(file));
    const fallback = kind === "goal" ? directory : directory.split("-")[0].toUpperCase();
    const id = ids[0] ?? fallback;
    const issues = [];
    if (!exists)
        issues.push("缺少 plan.md");
    if (!data || ids.length !== 1 || !identityPattern(kind).test(id))
        issues.push("id 必须唯一且格式有效");
    if (kind === "goal" && directory.toLowerCase() !== id.toLowerCase())
        issues.push("Goal id 与目录名不一致");
    if (kind === "phase" && (directory.slice(0, id.length).toLowerCase() !== id.toLowerCase() || directory[id.length] !== "-" || !directory.slice(id.length + 1).trim()))
        issues.push("Phase 目录前缀或成果名不明确");
    if (statuses.length !== 1 || !STATES.has(statuses[0]))
        issues.push("status 必须唯一且有效");
    if (archived.length > 1 || (archived.length === 1 && !["true", "false"].includes(archived[0])))
        issues.push("archived 必须是单个布尔值");
    if (archived[0] === "true" && !["done", "cancelled"].includes(statuses[0]))
        issues.push("活跃对象不能归档");
    if (withoutFences(raw).unclosed)
        issues.push("代码围栏未闭合");
    const heading = documentTitle(raw);
    if (!heading)
        issues.push("缺少成果标题");
    return { object: { kind, id, title: heading, status: statuses[0] ?? "", path: file, lineStart: 1, lineEnd: lineAt(raw, Math.max(0, raw.length - 1)), goalId: kind === "goal" ? id : parent?.object.id ?? null, phaseId: kind === "phase" ? id : null, archived: archived[0] === "true", raw, related: [] }, declaredIds: ids, issues, parent };
}
function markDuplicates(entries) {
    const seen = new Map();
    for (const entry of entries) {
        for (const identity of new Set(entry.declaredIds.map((id) => id.toLowerCase()).filter(Boolean))) {
            const key = entry.object.kind + ":" + identity;
            const prior = seen.get(key);
            if (prior && prior !== entry) {
                prior.duplicate = true;
                entry.duplicate = true;
            }
            else
                seen.set(key, entry);
        }
    }
}
function declares(entry, id) {
    const identities = entry.declaredIds.length ? entry.declaredIds : [entry.object.id];
    return identities.some((identity) => identity.toLowerCase() === id.toLowerCase());
}
function checkEntry(entry) {
    if (entry.duplicate)
        reject("OBJECT_ID_DUPLICATE", "项目内对象身份重复：" + entry.object.id, entry.object.path, 3);
    if (entry.parent)
        checkEntry(entry.parent);
    if (entry.issues.length)
        reject("OBJECT_STRUCTURE_INVALID", entry.object.id + "：" + entry.issues.join("；"), entry.object.path);
}
function addRelated(root, object, warnings) {
    const directory = path.dirname(object.path);
    const goalDirectory = object.kind === "goal" ? directory : path.dirname(path.dirname(directory));
    const candidates = [{ kind: "agents", path: "AGENTS.md" }, { kind: "conventions", path: "docs/conventions.md" }, { kind: "sop-index", path: "docs/sop/README.md" }];
    if (object.kind === "goal") {
        candidates.push({ kind: "goal-plan", path: object.path }, { kind: "goal-verification", path: path.join(directory, "verification.md") });
        for (const phaseDirectory of projectDirectories(root, path.join(directory, "phases")))
            candidates.push({ kind: "phase-plan", path: path.join(phaseDirectory, "plan.md") });
    }
    else {
        candidates.push({ kind: "goal-plan", path: path.join(goalDirectory, "plan.md") });
        for (const file of ["plan.md", "tasks.md", "design.md", "spec-deltas.md", "verification.md", "review.md"])
            candidates.push({ kind: file === "plan.md" ? "phase-plan" : file.slice(0, -3), path: path.join(directory, file) });
    }
    for (const candidate of candidates) {
        try {
            if (projectFileExists(root, candidate.path))
                object.related.push(candidate);
        }
        catch (error) {
            if (!(error instanceof ReadError) || error.exitCode === 4)
                throw error;
            warnings.push(error.diagnostic);
        }
    }
}
export function readObjects(rootInput, kind, query = {}) {
    const root = resolveProjectRoot(rootInput);
    if (!["goal", "phase", "task"].includes(kind))
        reject("QUERY_INVALID", "不支持的对象类型。", "arguments");
    for (const [key, value] of Object.entries(query)) {
        if (!["id", "goal", "phase", "status"].includes(key) || typeof value !== "string" || !value.trim())
            reject("QUERY_INVALID", "查询字段不完整或未知。", "arguments");
        const valid = key === "status" ? STATES.has(value) : identityPattern(key === "id" ? kind : key === "goal" ? "goal" : "phase").test(value);
        if (!valid)
            reject("QUERY_INVALID", "查询标识或状态格式无效：" + key, "arguments");
    }
    const warnings = [];
    const entries = [];
    const goalDirectories = projectDirectories(root, "docs/goals");
    if (!goalDirectories.length)
        warnings.push(diagnostic("GOALS_NOT_FOUND", "项目没有可读取的 Goal 目录。", "docs/goals"));
    for (const goalDirectory of goalDirectories) {
        const goal = plan(root, path.join(goalDirectory, "plan.md"), "goal");
        entries.push(goal);
        if (kind === "goal")
            continue;
        for (const phaseDirectory of projectDirectories(root, path.join(goalDirectory, "phases"))) {
            const phase = plan(root, path.join(phaseDirectory, "plan.md"), "phase", goal);
            entries.push(phase);
            if (kind !== "task")
                continue;
            const file = path.join(phaseDirectory, "tasks.md");
            if (!projectFileExists(root, file)) {
                warnings.push(diagnostic("PHASE_TASKS_MISSING", "Phase 缺少唯一 tasks.md，未能读取其任务。", file));
                continue;
            }
            const raw = readProjectText(root, file);
            const unclosed = withoutFences(raw).unclosed;
            for (const section of parseTaskSections(raw)) {
                const issues = [];
                if (section.level !== 2 || !section.title)
                    issues.push("Task 必须使用二级标题和非空成果名");
                if (section.statuses.length !== 1 || !STATES.has(section.statuses[0]))
                    issues.push("Task 状态必须唯一且有效");
                if (section.criteria.length !== 1 || !section.criteria[0].trim())
                    issues.push("Task 必须有唯一非空完成条件");
                if (unclosed)
                    issues.push("tasks.md 的代码围栏未闭合");
                entries.push({ object: { kind: "task", id: section.id, title: section.title, status: section.statuses[0] ?? "", path: file, lineStart: section.lineStart, lineEnd: section.lineEnd, goalId: goal.object.id, phaseId: phase.object.id, archived: phase.object.archived, raw: section.raw, related: [] }, declaredIds: [section.id], issues, parent: phase });
            }
        }
    }
    markDuplicates(entries);
    const candidates = entries.filter((entry) => entry.object.kind === kind);
    if (!query.id) {
        const duplicate = candidates.find((entry) => entry.duplicate);
        if (duplicate)
            checkEntry(duplicate);
    }
    if (query.id) {
        const declared = candidates.filter((entry) => declares(entry, query.id));
        if (!declared.length)
            reject("OBJECT_NOT_FOUND", "当前项目没有符合查询的对象：" + query.id, "docs/goals");
        if (declared.length !== 1)
            reject("OBJECT_ID_DUPLICATE", "筛选不能消除项目内重复身份：" + query.id, "docs/goals", 3);
        checkEntry(declared[0]);
    }
    const selected = candidates.filter((entry) => (!query.id || declares(entry, query.id)) && (!query.goal || entry.object.goalId?.toLowerCase() === query.goal.toLowerCase()) && (!query.phase || entry.object.phaseId === query.phase) && (!query.status || entry.object.status === query.status));
    if (query.id && !selected.length)
        reject("OBJECT_NOT_FOUND", "对象存在但不符合本次归属或状态筛选：" + query.id, "docs/goals");
    for (const entry of entries.filter((entry) => !selected.includes(entry))) {
        if (entry.duplicate)
            warnings.push(diagnostic("OBJECT_ID_DUPLICATE", "未选中资料存在重复身份：" + entry.declaredIds.join("、"), entry.object.path));
        if (entry.issues.length)
            warnings.push(diagnostic("OBJECT_STRUCTURE_INVALID", "未选中资料有结构缺口：" + entry.issues.join("；"), entry.object.path));
    }
    for (const entry of selected) {
        checkEntry(entry);
        addRelated(root, entry.object, warnings);
    }
    return { objects: selected.map((entry) => entry.object), warnings };
}
