import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixedSource, readRuleText, RULE_FILES, ruleFailure, ruleJson, ruleObject } from "./format.js";
const digest = (raw) => createHash("sha256").update(raw).digest("hex");
export function readBundle(directory) {
    const invalid = "RULE_BUNDLE_INVALID";
    if (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())
        ruleFailure(invalid, "规范包必须是明确普通目录。", directory);
    const root = realpathSync(directory), file = "source.json";
    const value = ruleJson(readRuleText(root, file, invalid), invalid, file);
    if (value && typeof value === "object" && !Array.isArray(value) && (value.schemaVersion !== 1 || value.ruleContract !== 1))
        ruleFailure("RULE_BUNDLE_UNSUPPORTED", "规范包格式或规则契约尚未支持。", file);
    const manifest = ruleObject(value, ["schemaVersion", "ruleContract", "source", "files"], invalid, file);
    const source = fixedSource(manifest.source, invalid, file);
    if (!Array.isArray(manifest.files) || manifest.files.length !== RULE_FILES.length)
        ruleFailure(invalid, "规范包须恰好包含十一份必要规则。", file);
    const entries = manifest.files.map((entry) => ruleObject(entry, ["path", "sha256"], invalid, file));
    if (entries.some((entry) => typeof entry.path !== "string" || !RULE_FILES.includes(entry.path) || typeof entry.sha256 !== "string" || !/^[a-f\d]{64}$/.test(entry.sha256)) || new Set(entries.map((entry) => entry.path)).size !== RULE_FILES.length)
        ruleFailure(invalid, "规范清单含未知/重复路径或无效摘要。", file);
    const files = RULE_FILES.map((relative) => {
        const entry = entries.find((entry) => entry.path === relative);
        const raw = readRuleText(root, relative, invalid);
        if (!raw.trim() || raw.includes("\0") || digest(raw) !== entry.sha256)
            ruleFailure(invalid, "规范原文为空、损坏或与固定清单不匹配。", relative);
        return { path: relative, raw, sha256: String(entry.sha256) };
    });
    return { root, source, files };
}
/** 构建取得已提交原文，运行时读取不需要 Git、网络或作者 checkout。 */
export function buildRules(repo, revision, output, repository) {
    const source = fixedSource({ repository, revision }, "RULE_BUNDLE_INVALID", "source");
    const root = realpathSync(repo);
    const git = (...args) => execFileSync("git", ["--no-replace-objects", "-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    if (realpathSync(git("rev-parse", "--show-toplevel").toString("utf8").trim()) !== root)
        ruleFailure("RULE_BUNDLE_INVALID", "构建来源必须明确为 Git 根目录。", repo);
    const actual = git("rev-parse", "--verify", source.revision + "^{commit}").toString("utf8").trim();
    if (actual !== source.revision)
        ruleFailure("RULE_BUNDLE_INVALID", "固定来源必须直接是提交对象。", revision);
    const files = RULE_FILES.map((relative) => {
        const entry = git("ls-tree", source.revision, "--", relative).toString("utf8");
        if (!/^100(?:644|755) blob [a-f\d]+\t/.test(entry))
            ruleFailure("RULE_BUNDLE_INVALID", "固定提交缺少普通规则文件。", relative);
        const bytes = git("show", source.revision + ":" + relative);
        let raw;
        try {
            raw = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
        }
        catch {
            return ruleFailure("RULE_BUNDLE_INVALID", "固定规则不是有效 UTF-8。", relative);
        }
        if (!raw.trim() || raw.includes("\0"))
            ruleFailure("RULE_BUNDLE_INVALID", "固定规则为空或包含非法字符。", relative);
        return { path: relative, raw, sha256: digest(bytes) };
    });
    const destination = path.resolve(output);
    // 排他建立最终目录；失败保留具体产物，不覆盖或清理调用者已有路径。
    mkdirSync(destination);
    for (const file of files) {
        mkdirSync(path.dirname(path.join(destination, file.path)), { recursive: true });
        writeFileSync(path.join(destination, file.path), file.raw, { flag: "wx" });
    }
    writeFileSync(path.join(destination, "source.json"), JSON.stringify({ schemaVersion: 1, ruleContract: 1, source, files: files.map(({ raw, ...entry }) => entry) }, null, 2) + "\n", { flag: "wx" });
    return readBundle(destination);
}
