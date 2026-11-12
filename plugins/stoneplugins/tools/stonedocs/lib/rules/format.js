import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { isMissing, isUtf8Text } from "../documents/files.js";
import { OperationError } from "../files/write.js";
import { parseJsonInput } from "../workflow/json.js";
export const RULE_FILES = ["docs/conventions.md", "docs/sop/README.md", ...["idea", "compare", "decide", "story", "plan", "design", "task", "verify", "review"].map((name) => "docs/sop/" + name + ".md")];
export const isRuleContract = (value) => value === 1 || value === 2;
/** 资源集合在作者描述、固定包与采用记录间保持同一边界。 */
export function resourcePaths(value, contract, code, file) {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string") || new Set(value).size !== value.length || RULE_FILES.some((entry) => !value.includes(entry)))
        ruleFailure(code, "资源集合须唯一并包含全部十一份核心规则。", file);
    const knowledge = value.filter((entry) => !RULE_FILES.includes(entry));
    if (contract === 1 ? knowledge.length !== 0 : !knowledge.includes("docs/knowledge/technical-design.md") || knowledge.some((entry) => !/^docs\/knowledge\/(?:[a-z\d][a-z\d._-]*\/)*[a-z\d][a-z\d._-]*\.md$/.test(entry)))
        ruleFailure(code, "v1 只含核心资源；v2 须含技术设计手册，且额外资源仅限规范小写 knowledge Markdown 路径。", file);
    return [...RULE_FILES, ...knowledge.sort()];
}
export const ENTRY_SECTIONS = [{ path: "AGENTS.md", id: "adoption" }, { path: "docs/README.md", id: "adoption" }, { path: "docs/guide.md", id: "adoption" }];
export function ruleFailure(code, message, file, exitCode = 1) {
    throw new OperationError({ code, message, path: file, remedy: "核对固定来源、支持的规则契约和实际管理范围；保留原文件，不从 latest 或作者工作树猜测。" }, exitCode);
}
export function ruleObject(value, keys, code, file) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        ruleFailure(code, "记录必须是对象。", file);
    const object = value;
    if (Object.keys(object).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(object, key)))
        ruleFailure(code, "记录存在未知字段或缺少必要字段。", file);
    return object;
}
export function ruleJson(raw, code, file) {
    try {
        return parseJsonInput(raw);
    }
    catch {
        return ruleFailure(code, "记录不是严格且无重复字段的 JSON。", file);
    }
}
export function fixedSource(value, code, file) {
    const source = ruleObject(value, ["repository", "revision"], code, file);
    if (typeof source.repository !== "string" || source.repository !== source.repository.trim() || !isUtf8Text(source.repository) || /[\s\0]/.test(source.repository))
        ruleFailure(code, "规范仓库必须是无凭据的明确 HTTPS URL。", file);
    let url;
    try {
        url = new URL(source.repository);
    }
    catch {
        return ruleFailure(code, "规范仓库 URL 无效。", file);
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname === "/")
        ruleFailure(code, "规范仓库必须是无凭据、无查询参数的 HTTPS 仓库 URL。", file);
    if (typeof source.revision !== "string" || !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(source.revision))
        ruleFailure(code, "revision 必须是完整固定 Git 提交，不接受标签、HEAD 或缩写。", file);
    return { repository: source.repository, revision: source.revision.toLowerCase() };
}
/** 固定规则及采用记录只从普通文件读取；中间链接也不能成为隐式来源。 */
export function readRuleText(rootInput, relative, code, allowMissing = false) {
    if (!relative || relative.includes("\\") || relative.includes("\0") || path.posix.isAbsolute(relative) || path.posix.normalize(relative) !== relative || relative === ".." || relative.startsWith("../"))
        ruleFailure(code, "规则或记录必须使用根内规范相对路径。", relative);
    try {
        const root = realpathSync(rootInput);
        let current = root;
        const parts = relative.split("/");
        for (let index = 0; index < parts.length; index++) {
            current = path.join(current, parts[index]);
            let stat;
            try {
                stat = lstatSync(current);
            }
            catch (error) {
                if (isMissing(error)) {
                    if (allowMissing)
                        return null;
                    return ruleFailure(code, "必要记录或规则文件缺失。", relative);
                }
                throw error;
            }
            if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))
                ruleFailure(code, "规则或记录路径必须为普通文件，不能经过软链接。", relative);
        }
        const bytes = readFileSync(current);
        try {
            return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
        }
        catch {
            return ruleFailure(code, "规则或记录不是有效 UTF-8。", relative);
        }
    }
    catch (error) {
        if (error instanceof OperationError)
            throw error;
        const cause = error.code;
        return ruleFailure("IO_ERROR", "规范读取未完成" + (cause ? "（" + cause + "）" : "") + "。", relative, 4);
    }
}
function validateAdoption(value) {
    const file = "docs/.stonedocs.json", invalid = "ADOPTION_INVALID";
    if (value && typeof value === "object" && !Array.isArray(value) && (value.schemaVersion !== 1 || !isRuleContract(value.ruleContract)))
        ruleFailure("ADOPTION_UNSUPPORTED", "采用格式或规则契约尚未支持。", file);
    const record = ruleObject(value, ["schemaVersion", "ruleContract", "source", "managed"], invalid, file);
    const declared = ruleObject(record.source, ["kind", "repository", "revision"], invalid, file);
    if (declared.kind !== "fixed")
        ruleFailure("ADOPTION_UNSUPPORTED", "采用来源类型尚未支持。", file);
    const source = fixedSource({ repository: declared.repository, revision: declared.revision }, invalid, file);
    const managed = ruleObject(record.managed, ["files", "sections"], invalid, file);
    if (!isRuleContract(record.ruleContract))
        ruleFailure("ADOPTION_UNSUPPORTED", "规则契约尚未支持。", file);
    const files = resourcePaths(managed.files, record.ruleContract, invalid, file);
    if (!Array.isArray(managed.sections) || managed.sections.length !== ENTRY_SECTIONS.length)
        ruleFailure(invalid, "采用入口范围不完整。", file);
    const entries = managed.sections.map((entry) => ruleObject(entry, ["path", "id"], invalid, file));
    if (ENTRY_SECTIONS.some((standard) => entries.filter((entry) => entry.path === standard.path && entry.id === standard.id).length !== 1))
        ruleFailure(invalid, "采用入口重复或超出本契约范围。", file);
    return { schemaVersion: 1, ruleContract: record.ruleContract, source: { kind: "fixed", ...source }, managed: { files, sections: ENTRY_SECTIONS.map((section) => ({ ...section })) } };
}
export function parseAdoption(raw) {
    return validateAdoption(ruleJson(raw, "ADOPTION_INVALID", "docs/.stonedocs.json"));
}
export function readAdoption(root) {
    const raw = readRuleText(root, "docs/.stonedocs.json", "ADOPTION_INVALID", true);
    return raw === null ? null : parseAdoption(raw);
}
export function adoptionFor(bundle) {
    return validateAdoption({ schemaVersion: 1, ruleContract: bundle.ruleContract, source: { kind: "fixed", ...bundle.source }, managed: { files: bundle.files.map((file) => file.path), sections: ENTRY_SECTIONS.map((section) => ({ ...section })) } });
}
