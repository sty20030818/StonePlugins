import { ReadError } from "../documents/files.js";
import { resolveProjectRoot } from "../documents/project.js";
import { OperationError } from "../files/write.js";
import { readBundle } from "../rules/bundle.js";
import { adoptEntry } from "../rules/entries.js";
import { ENTRY_SECTIONS, parseAdoption } from "../rules/format.js";
import { currentAdoptionFile, inventoryAdoption, METADATA, SOP_INDEX_ALIAS } from "./adoption.js";
import { finishPlan } from "./context.js";
function diagnostic(code, message, file) {
    return { code, message, path: file, remedy: "保留当前内容并核对旧固定基线、项目差异与目标规范；先明确解决冲突，再重新生成整组升级预览。" };
}
export class UpgradeConflict extends OperationError {
    comparisons;
    conflicts;
    sources;
    mode;
    constructor(comparisons, conflicts, sources, mode) {
        super(diagnostic("UPGRADE_CONFLICT", "存在 " + conflicts.length + " 项升级冲突，整组不形成可应用计划。", METADATA), 3);
        this.comparisons = comparisons;
        this.conflicts = conflicts;
        this.sources = sources;
        this.mode = mode;
    }
}
function fail(code, message, file, exitCode = 3) { throw new OperationError(diagnostic(code, message, file), exitCode); }
const sameSource = (left, right) => left.repository === right.repository && left.revision === right.revision;
/** 结构问题可以逐项列出；无法完成的 I/O 不能伪装成“本地缺失”。 */
function localFile(root, file) {
    try {
        return { raw: currentAdoptionFile(root, file, "UPGRADE_TARGET_INVALID") };
    }
    catch (error) {
        if (error instanceof OperationError && error.exitCode === 3)
            return { raw: null, problem: error.diagnostic.message };
        if (error instanceof ReadError && error.exitCode !== 4)
            return { raw: null, problem: error.diagnostic.message };
        throw error;
    }
}
/** 规则按整份原文比较；未知交叉修改不做自然语言自动合并。 */
export function planUpgrade(rootInput, oldBundleDirectory, targetBundleDirectory) {
    const root = resolveProjectRoot(rootInput), metadata = currentAdoptionFile(root, METADATA, "UPGRADE_TARGET_INVALID");
    if (metadata === null)
        fail("UPGRADE_ADOPTION_REQUIRED", "项目没有受支持的固定采用记录；不以发行副本覆盖未声明的作者源。", METADATA, 1);
    const adopted = parseAdoption(metadata);
    const old = readBundle(oldBundleDirectory), target = readBundle(targetBundleDirectory);
    if (old.source.repository !== adopted.source.repository || target.source.repository !== adopted.source.repository)
        fail("UPGRADE_REPOSITORY_MISMATCH", "旧包与目标包必须属于本项目已经采用的同一规范仓库。", "source");
    const mode = sameSource(adopted.source, target.source) ? "already-adopted" : "upgrade";
    if (mode === "upgrade" && !sameSource(adopted.source, old.source))
        fail("UPGRADE_BASE_SOURCE_MISMATCH", "旧固定包身份不匹配当前采用记录，不能猜测升级基线。", METADATA);
    const sources = { from: { repository: adopted.source.repository, revision: adopted.source.revision }, to: { ...target.source } };
    const comparisons = [], conflicts = [], changes = [];
    const conflict = (file, base, local, next, code, reason) => {
        comparisons.push({ path: file, disposition: "conflict", base, local, target: next, reason });
        conflicts.push(diagnostic(code, reason, file));
    };
    if (sameSource(old.source, target.source)) {
        if (old.ruleContract !== target.ruleContract || JSON.stringify(old.files.map((file) => file.path)) !== JSON.stringify(target.files.map((file) => file.path)))
            conflict("source.json", null, null, null, "UPGRADE_SOURCE_CONTENT_CONFLICT", "相同来源身份包含不同契约或资源集合。");
        for (const resource of old.files) {
            const next = target.files.find((candidate) => candidate.path === resource.path);
            if (next && resource.sha256 !== next.sha256)
                conflict(resource.path, resource.raw, null, next.raw, "UPGRADE_SOURCE_CONTENT_CONFLICT", "相同来源身份的两份包含有不同原文，不能用同一版本替换规范。");
        }
        if (conflicts.length)
            throw new UpgradeConflict(comparisons, conflicts, sources, mode);
    }
    if (target.ruleContract < adopted.ruleContract || target.ruleContract < old.ruleContract)
        fail("UPGRADE_DOWNGRADE", "不允许隐式降级规则契约。", "source.json");
    const effectiveBase = mode === "already-adopted" ? target : old;
    if (adopted.ruleContract !== effectiveBase.ruleContract || JSON.stringify(adopted.managed.files) !== JSON.stringify(effectiveBase.files.map((file) => file.path)))
        fail("UPGRADE_BASE_RESOURCE_MISMATCH", "固定基线的契约及资源集合不匹配当前采用记录。", METADATA);
    if (old.files.some((file) => !target.files.some((next) => next.path === file.path)))
        fail("UPGRADE_RESOURCE_REMOVAL", "当前升级不删除或移动受管资源；目标必须保留全部旧路径。", "source.json");
    const snapshot = new Map([[METADATA, metadata]]);
    const currentFile = (file) => { const current = localFile(root, file); if (!current.problem)
        snapshot.set(file, current.raw); return current; };
    const basis = new Set([METADATA, SOP_INDEX_ALIAS, ...effectiveBase.files.map((file) => file.path), ...target.files.map((file) => file.path), ...ENTRY_SECTIONS.map((entry) => entry.path)]);
    for (const next of target.files) {
        const resource = effectiveBase.files.find((candidate) => candidate.path === next.path), current = currentFile(next.path);
        if (current.problem) {
            conflict(next.path, resource?.raw ?? null, null, next.raw, "UPGRADE_TARGET_INVALID", current.problem);
            continue;
        }
        if (!resource) {
            if (current.raw === null) {
                changes.push({ path: next.path, before: null, after: next.raw });
                comparisons.push({ path: next.path, disposition: "add", base: null, local: null, target: next.raw });
            }
            else if (current.raw === next.raw)
                comparisons.push({ path: next.path, disposition: "already-current", base: null, local: current.raw, target: next.raw });
            else
                conflict(next.path, null, current.raw, next.raw, "UPGRADE_NEW_PATH_CONFLICT", "新增受管路径已被不同内容占用；不覆盖用户资料。");
            continue;
        }
        if (current.raw === null) {
            conflict(resource.path, resource.raw, null, next.raw, "UPGRADE_LOCAL_MISSING", "必要本地规则缺失；升级不猜测这是删除还是待修复内容。");
            continue;
        }
        if (!current.raw.trim()) {
            conflict(resource.path, resource.raw, current.raw, next.raw, "UPGRADE_LOCAL_EMPTY", "必要本地规则为空或仅含空白，不能作为有效项目差异推进版本。");
            continue;
        }
        const local = current.raw, base = resource.raw;
        let disposition;
        if (base === next.raw)
            disposition = local === base ? "unchanged" : "preserved";
        else if (local === base) {
            disposition = "update";
            changes.push({ path: resource.path, before: local, after: next.raw });
        }
        else if (local === next.raw)
            disposition = "already-current";
        else {
            conflict(resource.path, base, local, next.raw, "UPGRADE_CONTENT_CONFLICT", "项目与目标规范都改变了同一规则，整组暂停，不自动合并或覆盖。");
            continue;
        }
        comparisons.push({ path: resource.path, disposition, base, local, target: next.raw, ...(mode === "already-adopted" ? { reason: "以当前已采用目标规范为实际基线，只报告并保留项目差异。" } : {}) });
    }
    for (const entry of ENTRY_SECTIONS) {
        const current = currentFile(entry.path);
        if (current.problem) {
            conflict(entry.path, null, null, null, "UPGRADE_TARGET_INVALID", current.problem);
            continue;
        }
        if (current.raw === null) {
            conflict(entry.path, null, null, null, "UPGRADE_ENTRY_MISSING", "必要采用入口缺失，升级不替用户重建或猜测受管片段。");
            continue;
        }
        try {
            if (adoptEntry(entry.path, current.raw) !== current.raw) {
                conflict(entry.path, null, current.raw, null, "UPGRADE_ENTRY_MISSING", "必要 v1 采用片段缺失，升级不自动追加入口。");
                continue;
            }
            comparisons.push({ path: entry.path, disposition: "unchanged", base: null, local: current.raw, target: null, reason: "采用片段属于稳定 v1 工具契约，不在旧/新规则包中；原文及片段外正文保持。" });
        }
        catch (error) {
            if (!(error instanceof OperationError))
                throw error;
            conflict(entry.path, null, current.raw, null, "UPGRADE_ENTRY_CONFLICT", "采用片段已改写、版本未知或边界不完整，升级不覆盖项目入口。");
        }
    }
    const index = currentFile(SOP_INDEX_ALIAS);
    if (index.problem || index.raw !== null)
        conflict(SOP_INDEX_ALIAS, null, index.raw, null, "UPGRADE_INDEX_CONFLICT", index.problem ?? "存在第二个 SOP 索引入口；先明确唯一入口，升级不删除或重命名既有资料。");
    if (conflicts.length)
        throw new UpgradeConflict(comparisons, conflicts, sources, mode);
    if (mode === "upgrade") {
        const eol = metadata.match(/\r\n|\n|\r/)?.[0] ?? "\n";
        const record = { ...adopted, ruleContract: target.ruleContract, source: { ...adopted.source, revision: target.source.revision }, managed: { ...adopted.managed, files: target.files.map((file) => file.path) } };
        changes.push({ path: METADATA, before: metadata, after: JSON.stringify(record, null, 2).replaceAll("\n", eol) + eol });
    }
    const context = { root, author: false, objects: inventoryAdoption(root, basis), basis: [...basis], ruleSnapshot: snapshot };
    const describe = (bundle) => ({ source: bundle.source, ruleContract: bundle.ruleContract, files: bundle.files.map(({ path, sha256 }) => ({ path, sha256 })) });
    const request = { mode, source: sources.from, providedOld: describe(old), target: describe(target), ruleContract: adopted.ruleContract };
    const plan = finishPlan(context, "upgrade", { kind: "adoption", id: "fixed-rules", path: METADATA }, request, changes);
    return { plan, comparisons, mode, sources };
}
