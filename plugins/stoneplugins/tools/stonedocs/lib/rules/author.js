import path from "node:path";
import { isUtf8Text } from "../documents/files.js";
import { isRuleContract, parseAdoption, readRuleText, resourcePaths, RULE_FILES, ruleFailure, ruleJson, ruleObject } from "./format.js";
export const AUTHOR_RESOURCES = "handbook/resources.json";
const invalid = "AUTHOR_RESOURCES_INVALID";
function mappings(raw) {
    const record = ruleObject(ruleJson(raw, invalid, AUTHOR_RESOURCES), ["schemaVersion", "ruleContract", "files"], invalid, AUTHOR_RESOURCES);
    if (!Number.isInteger(record.schemaVersion) || !Number.isInteger(record.ruleContract))
        ruleFailure(invalid, "作者描述版本须为整数。", AUTHOR_RESOURCES);
    if (record.schemaVersion !== 1 || !isRuleContract(record.ruleContract))
        ruleFailure("AUTHOR_RESOURCES_UNSUPPORTED", "作者描述或规则资源契约尚未支持。", AUTHOR_RESOURCES);
    if (!Array.isArray(record.files))
        ruleFailure(invalid, "作者描述须提供完整资源映射。", AUTHOR_RESOURCES);
    const sources = new Set(), targets = new Map();
    for (const value of record.files) {
        const entry = ruleObject(value, ["source", "target"], invalid, AUTHOR_RESOURCES);
        const source = entry.source, target = entry.target;
        if (typeof source !== "string" || !source.endsWith(".md") || /[:\\\x00-\x1f\x7f]/.test(source) || !isUtf8Text(source) || path.posix.isAbsolute(source) || path.posix.normalize(source) !== source || source.startsWith("../"))
            ruleFailure(invalid, "作者 source 须为 handbook 内的规范相对 Markdown 路径。", AUTHOR_RESOURCES);
        if (typeof target !== "string" || targets.has(target) || sources.has(source.toLowerCase()))
            ruleFailure(invalid, "作者映射含无效目标或重复来源/目标。", AUTHOR_RESOURCES);
        sources.add(source.toLowerCase());
        targets.set(target, "handbook/" + source);
    }
    return { ruleContract: record.ruleContract, files: resourcePaths([...targets.keys()], record.ruleContract, invalid, AUTHOR_RESOURCES).map((target) => ({ source: targets.get(target), target })) };
}
/** 文件系统和固定 Git 提交共用同一选择规则，不用工作树替固定来源补缺。 */
export function resolveAuthorLayout(readText) {
    const snapshot = new Map();
    const read = (file, optional = false) => {
        if (!snapshot.has(file))
            snapshot.set(file, readText(file, optional));
        return snapshot.get(file);
    };
    const descriptor = read(AUTHOR_RESOURCES, true);
    const { files, ruleContract } = descriptor === null ? { files: RULE_FILES.map((target) => ({ source: target, target })), ruleContract: null } : mappings(descriptor);
    if (descriptor !== null) {
        for (const file of [...files.map((entry) => entry.target), "docs/sop/index.md"]) {
            if (read(file, true) !== null)
                ruleFailure("AUTHOR_SOURCE_CONFLICT", "描述指定的作者源与旧 docs 规则同时存在；先明确唯一来源。", file, 3);
        }
    }
    for (const file of descriptor === null ? files.filter((entry) => entry.target === "docs/conventions.md") : files) {
        const raw = read(file.source);
        if (raw === null || !raw.trim() || raw.includes("\0") || !isUtf8Text(raw))
            ruleFailure(invalid, "必要作者正文缺失、为空或包含非法文本。", file.source);
    }
    return { metadataPath: descriptor === null ? null : AUTHOR_RESOURCES, ruleContract, files, snapshot };
}
export function readAuthorLayout(root) {
    const adopted = readRuleText(root, "docs/.stonedocs.json", "ADOPTION_INVALID", true);
    if (adopted !== null) {
        parseAdoption(adopted);
        ruleFailure("AUTHOR_MODE_CONFLICT", "项目已有固定采用记录，不能用作者模式替代其来源。", "docs/.stonedocs.json");
    }
    const layout = resolveAuthorLayout((file, optional) => readRuleText(root, file, invalid, optional));
    layout.snapshot.set("docs/.stonedocs.json", null);
    return layout;
}
