import { resolveProjectRoot } from "../documents/project.js";
import { OperationError } from "../files/write.js";
import { readBundle } from "../rules/bundle.js";
import { adoptionFor, ENTRY_SECTIONS, parseAdoption, RULE_FILES } from "../rules/format.js";
import { adoptEntry } from "../rules/entries.js";
import { finishPlan } from "./context.js";
import { currentAdoptionFile, inventoryAdoption, METADATA, SOP_INDEX_ALIAS } from "./adoption.js";
function fail(code, message, file) {
    throw new OperationError({ code, message, path: file, remedy: "保留当前项目资料，核对固定来源与具体差异；不同采用版本或已修改内容交由明确的 upgrade/采用方案处理。" }, 3);
}
/** 只有明确资源包参与计划；运行时不寻找作者工作树、Git 原文或远端 latest。 */
export function planInit(rootInput, bundleDirectory) {
    const root = resolveProjectRoot(rootInput), bundle = readBundle(bundleDirectory);
    const metadata = currentAdoptionFile(root, METADATA, "INIT_TARGET_INVALID");
    const adopted = metadata === null ? null : parseAdoption(metadata), record = adoptionFor(bundle);
    if (adopted && (adopted.source.repository !== record.source.repository || adopted.source.revision !== record.source.revision))
        fail("ADOPTION_VERSION_CONFLICT", "项目已采用不同固定来源；需要明确规范升级方案，init 不执行升级。", METADATA);
    if (currentAdoptionFile(root, SOP_INDEX_ALIAS, "INIT_TARGET_INVALID") !== null)
        fail("INIT_CONTENT_CONFLICT", "项目已有 SOP index.md 入口；本契约使用 README.md，须先明确采用方案，init 不删除或重命名既有索引。", SOP_INDEX_ALIAS);
    const changes = [], basis = new Set([METADATA, SOP_INDEX_ALIAS, ...RULE_FILES, ...ENTRY_SECTIONS.map((entry) => entry.path)]);
    for (const resource of bundle.files) {
        const before = currentAdoptionFile(root, resource.path, "INIT_TARGET_INVALID");
        if (before !== null && before !== resource.raw)
            fail("INIT_CONTENT_CONFLICT", "已有规范与固定来源不同，init 不覆盖项目差异。", resource.path);
        if (before === null)
            changes.push({ path: resource.path, before, after: resource.raw });
    }
    for (const entry of ENTRY_SECTIONS) {
        const before = currentAdoptionFile(root, entry.path, "INIT_TARGET_INVALID"), after = adoptEntry(entry.path, before);
        if (before !== after)
            changes.push({ path: entry.path, before, after });
    }
    if (!adopted)
        changes.push({ path: METADATA, before: metadata, after: JSON.stringify(record, null, 2) + "\n" });
    const context = { root, author: false, objects: inventoryAdoption(root, basis), basis: [...basis] };
    const request = { source: record.source, ruleContract: record.ruleContract, files: bundle.files.map(({ path, sha256 }) => ({ path, sha256 })) };
    return finishPlan(context, "init", { kind: "adoption", id: "fixed-rules", path: METADATA }, request, changes);
}
