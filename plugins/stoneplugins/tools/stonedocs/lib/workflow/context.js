import { readAdoption, readRuleText } from "../rules/format.js";
import { readAuthorLayout } from "../rules/author.js";
import { lstatSync } from "node:fs";
import path from "node:path";
import { checkRepository } from "../documents/check.js";
import { isMissing, isUtf8Text, projectDirectories, projectFileExists, projectPath, readProjectText, ReadError } from "../documents/files.js";
import { anchors, localUrl, markdownLinks, unquote, withoutFences } from "../documents/markdown.js";
import { resolveProjectRoot } from "../documents/project.js";
import { readObjects } from "../documents/read.js";
import { captureGuard, OperationError } from "../files/write.js";
function fail(code, message, file, exitCode = 1) {
    throw new OperationError({ code, message, path: file, remedy: "核对本项目的身份、规范、实际状态和引用后重新预览；不覆盖旧内容。" }, exitCode);
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
export function loadWriteContext(rootInput, author, requiredRules = []) {
    const root = resolveProjectRoot(rootInput);
    const authored = author ? readAuthorLayout(root) : undefined;
    const adoption = author ? null : readAdoption(root);
    if (!adoption && !author)
        fail("ADOPTION_REQUIRED", "项目尚未采用受支持规范；先 init，或明确选择本地作者模式。", "docs/.stonedocs.json", 2);
    const ruleSnapshot = authored?.snapshot ?? new Map();
    const rules = new Map();
    const basis = new Set(["AGENTS.md", "docs/.stonedocs.json", ...ruleSnapshot.keys()]);
    for (const target of new Set(["docs/conventions.md", ...requiredRules, ...(adoption?.managed.files ?? [])])) {
        const file = authored?.files.find((entry) => entry.target === target)?.source ?? target;
        if (!projectFileExists(root, file))
            fail(adoption ? "ADOPTED_RULES_MISSING" : "AUTHOR_RULES_MISSING", "本地缺少非空必要规则；不回退作者目录或远端。", file);
        const raw = ruleSnapshot.get(file) ?? readProjectText(root, file);
        if (!raw.trim())
            fail(adoption ? "ADOPTED_RULES_MISSING" : "AUTHOR_RULES_MISSING", "本地缺少非空必要规则；不回退作者目录或远端。", file);
        ruleSnapshot.set(file, raw);
        basis.add(file);
        rules.set(target, { path: file, raw });
    }
    const objects = { goal: [], phase: [], task: [] };
    for (const kind of ["goal", "phase", "task"]) {
        const catalog = readObjects(root, kind);
        for (const warning of catalog.warnings)
            if (warning.code !== "GOALS_NOT_FOUND")
                fail("INVENTORY_INCOMPLETE", "身份盘点存在缺口：" + warning.message, warning.path);
        objects[kind] = catalog.objects;
        const numeric = new Set();
        for (const object of catalog.objects) {
            basis.add(object.path);
            if (kind !== "goal") {
                const id = BigInt(object.id.slice(1)).toString();
                if (numeric.has(id))
                    fail("IDENTITY_AMBIGUOUS", "项目存在数值等价的重复编号。", object.path, 3);
                numeric.add(id);
            }
        }
    }
    for (const directory of ["docs", "docs/sop", "docs/goals", ...projectDirectories(root, "docs/goals")])
        if (entryExists(root, directory))
            basis.add(directory);
    for (const goal of objects.goal) {
        const directory = path.posix.join(path.posix.dirname(goal.path), "phases");
        if (entryExists(root, directory))
            basis.add(directory);
    }
    for (const phase of objects.phase)
        basis.add(path.posix.dirname(phase.path));
    return { root, author, objects, basis: [...basis], rules, ruleSnapshot };
}
export function contextRule(context, target) {
    const rule = context.rules?.get(target);
    if (!rule)
        fail("RULE_BASIS_MISSING", "当前动作未取得必要规则。", target);
    return rule;
}
export function uniqueObject(context, kind, id) {
    if (typeof id !== "string" || !id.trim())
        fail("INPUT_INVALID", "需要明确对象标识。", "arguments", 2);
    const found = context.objects[kind].filter((object) => object.id.toLowerCase() === id.toLowerCase());
    if (found.length !== 1)
        fail(found.length ? "IDENTITY_AMBIGUOUS" : "OBJECT_NOT_FOUND", "本项目无法唯一定位对象：" + id, "docs/goals", found.length ? 3 : 1);
    return found[0];
}
function reference(ref) {
    if (typeof ref !== "string" || !ref || !isUtf8Text(ref) || /[\\\r\n\0?]/.test(ref) || ref.startsWith("/") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref))
        fail("REFERENCE_INVALID", "依据必须是本项目根相对文件路径，可带 anchor。", "input", 2);
    const hash = ref.indexOf("#");
    let file;
    let fragment;
    try {
        file = decodeURIComponent(hash < 0 ? ref : ref.slice(0, hash));
        fragment = decodeURIComponent(hash < 0 ? "" : ref.slice(hash + 1));
    }
    catch {
        fail("REFERENCE_INVALID", "依据包含无法解析的 URL 编码。", ref, 2);
    }
    if (!file || /[\\\r\n\0?#]/.test(file) || file.startsWith("/") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(file) || path.posix.normalize(file).startsWith("../") || path.posix.normalize(file) === "..")
        fail("REFERENCE_INVALID", "依据不能越出项目或省略文件。", ref, 2);
    return { file: path.posix.normalize(file), fragment };
}
export function validateReferences(context, refs) {
    const basis = new Set();
    for (const ref of refs) {
        const { file, fragment } = reference(ref);
        projectPath(context.root, file);
        if (!projectFileExists(context.root, file))
            fail("REFERENCE_NOT_FOUND", "依据文件不存在。", ref);
        if (fragment && !anchors(readProjectText(context.root, file)).has(fragment))
            fail("REFERENCE_ANCHOR_MISSING", "依据 anchor 不存在。", ref);
        basis.add(file);
    }
    return [...basis];
}
export function referenceLink(ownerPath, ref) {
    const { file, fragment } = reference(ref);
    const relative = path.posix.relative(path.posix.dirname(ownerPath), file) || path.posix.basename(file);
    const target = relative.split("/").map((segment) => encodeURIComponent(segment).replaceAll("(", "%28").replaceAll(")", "%29")).join("/") + (fragment ? "#" + encodeURIComponent(fragment).replaceAll("(", "%28").replaceAll(")", "%29") : "");
    const label = ref.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("`", "\\`");
    return "[" + label + "](" + target + ")";
}
function checkChanges(root, changes) {
    const before = checkRepository(root);
    if (!before.complete)
        fail("VALIDATION_INCOMPLETE", "既有资料未完整读取，不能形成写入计划。", ".", 4);
    const links = new Set(["LOCAL_LINK_MISSING", "LOCAL_ANCHOR_MISSING", "LOCAL_LINK_OUTSIDE_ROOT", "LINK_DEFINITION_MISSING"]);
    const structural = before.diagnostics.find((issue) => !links.has(issue.code));
    if (structural)
        fail("BASIS_INVALID", "既有结构缺口阻断写入：" + structural.message, structural.path);
    const counts = new Map();
    const key = (issue) => JSON.stringify([issue.code, issue.path, issue.message]);
    for (const issue of before.diagnostics)
        counts.set(key(issue), (counts.get(key(issue)) ?? 0) + 1);
    const after = checkRepository(root, new Map(changes.map((change) => [change.path, change.after])));
    if (!after.complete)
        fail("VALIDATION_INCOMPLETE", "拟写入视图未完成检查。", ".", 4);
    for (const issue of after.diagnostics) {
        const remaining = counts.get(key(issue)) ?? 0;
        if (remaining)
            counts.set(key(issue), remaining - 1);
        else
            fail("PLANNED_DOCUMENT_INVALID", "拟写入产生新的文档问题：" + issue.message, issue.path);
    }
    return before.diagnostics;
}
function referencedBasis(root, changes) {
    const targets = new Set();
    for (const change of changes) {
        for (const { target } of markdownLinks(withoutFences(change.after).clean)) {
            if (target === undefined || /^[A-Za-z][\p{L}\p{N}_+.-]*:/u.test(target) || target.startsWith("//"))
                continue;
            const local = unquote(localUrl(target).pathname).replace(/\\([()])/g, "$1");
            const relative = local ? path.relative(root, path.resolve(root, path.dirname(change.path), local)) || "." : change.path;
            try {
                projectPath(root, relative);
                targets.add(relative);
            }
            catch (error) {
                if (!(error instanceof ReadError) || error.diagnostic.code !== "PATH_OUTSIDE_PROJECT")
                    throw error;
            }
        }
    }
    return [...targets];
}
export function finishPlan(context, command, object, request, changes, extraBasis = []) {
    const warnings = checkChanges(context.root, changes);
    const basis = new Set([...context.basis, ...referencedBasis(context.root, changes), ...extraBasis]);
    const guards = [...basis].sort().map((file) => captureGuard(context.root, file, changes));
    for (const [file, raw] of context.ruleSnapshot ?? []) {
        if (readRuleText(context.root, file, "CONTENT_CHANGED", true) !== raw)
            fail("CONTENT_CHANGED", "规则或作者布局在规划中发生变化；重新读取后预览。", file, 3);
    }
    return { schemaVersion: 1, projectRoot: context.root, command, object, request, changes, warnings, guards };
}
