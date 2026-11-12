import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixedSource, isRuleContract, readRuleText, resourcePaths, ruleFailure, ruleJson, ruleObject } from "./format.js";
import { resolveAuthorLayout } from "./author.js";
import { anchors, localUrl, markdownLinks, unquote, withoutFences, withoutFrontmatter } from "../documents/markdown.js";
const digest = (raw) => createHash("sha256").update(raw).digest("hex");
function validateLinks(files) {
    const texts = new Map(files.map((file) => [file.path, file.raw]));
    for (const file of files) {
        const clean = withoutFences(withoutFrontmatter(file.raw));
        if (clean.unclosed)
            ruleFailure("RULE_LINK_INVALID", "资源正文包含未闭合围栏。", file.path);
        for (const { target } of markdownLinks(clean.clean)) {
            if (target === undefined)
                ruleFailure("RULE_LINK_INVALID", "资源引用链接没有定义。", file.path);
            if (/^file:/i.test(target) || /^[A-Za-z]:[/\\]/.test(target))
                ruleFailure("RULE_LINK_INVALID", "资源不能依赖本机文件地址。", file.path);
            if (/^[A-Za-z][\p{L}\p{N}_+.-]*:/u.test(target) || target.startsWith("//"))
                continue;
            const url = localUrl(target), local = unquote(url.pathname).replace(/\\([()])/g, "$1");
            const destination = local ? path.posix.join(path.posix.dirname(file.path), local) : file.path;
            const raw = texts.get(destination);
            if (local.startsWith("/") || local.includes("\\") || raw === undefined || (url.fragment && !anchors(raw).has(unquote(url.fragment))))
                ruleFailure("RULE_LINK_INVALID", "本地引用须指向同包声明的资源及有效锚点。", file.path);
        }
    }
}
function validateFiles(root, paths) {
    const files = new Set(["source.json", ...paths]);
    const directories = new Set(paths.flatMap((file) => file.split("/").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("/"))));
    const walk = (relative = "") => {
        for (const name of readdirSync(path.join(root, relative))) {
            const file = relative ? relative + "/" + name : name, stat = lstatSync(path.join(root, file));
            if (stat.isDirectory() && directories.has(file))
                walk(file);
            else if (!stat.isFile() || !files.has(file))
                ruleFailure("RULE_BUNDLE_INVALID", "规则包包含未声明文件、目录或非普通资源。", file);
        }
    };
    walk();
}
export function readBundle(directory) {
    const invalid = "RULE_BUNDLE_INVALID";
    if (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())
        ruleFailure(invalid, "规范包必须是明确普通目录。", directory);
    const root = realpathSync(directory), file = "source.json";
    const value = ruleJson(readRuleText(root, file, invalid), invalid, file);
    if (value && typeof value === "object" && !Array.isArray(value) && (value.schemaVersion !== 1 || !isRuleContract(value.ruleContract)))
        ruleFailure("RULE_BUNDLE_UNSUPPORTED", "规范包格式或规则契约尚未支持。", file);
    const manifest = ruleObject(value, ["schemaVersion", "ruleContract", "source", "files"], invalid, file);
    const source = fixedSource(manifest.source, invalid, file);
    if (!isRuleContract(manifest.ruleContract))
        ruleFailure("RULE_BUNDLE_UNSUPPORTED", "规则契约尚未支持。", file);
    if (!Array.isArray(manifest.files))
        ruleFailure(invalid, "规范包须包含完整资源清单。", file);
    const entries = manifest.files.map((entry) => ruleObject(entry, ["path", "sha256"], invalid, file));
    const paths = resourcePaths(entries.map((entry) => entry.path), manifest.ruleContract, invalid, file);
    if (entries.some((entry) => typeof entry.sha256 !== "string" || !/^[a-f\d]{64}$/.test(entry.sha256)))
        ruleFailure(invalid, "规范清单含无效摘要。", file);
    const files = paths.map((relative) => {
        const entry = entries.find((entry) => entry.path === relative);
        const raw = readRuleText(root, relative, invalid);
        if (!raw.trim() || raw.includes("\0") || digest(raw) !== entry.sha256)
            ruleFailure(invalid, "规范原文为空、损坏或与固定清单不匹配。", relative);
        return { path: relative, raw, sha256: String(entry.sha256) };
    });
    validateFiles(root, paths);
    if (manifest.ruleContract === 2)
        validateLinks(files);
    return { root, ruleContract: manifest.ruleContract, source, files };
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
    const entries = new Map();
    const entryAt = (relative) => {
        if (!entries.has(relative))
            entries.set(relative, git("ls-tree", source.revision, "--", relative).toString("utf8"));
        return entries.get(relative);
    };
    const read = (relative, optional) => {
        const segments = relative.split("/");
        for (let index = 1; index < segments.length; index++) {
            const parent = entryAt(segments.slice(0, index).join("/"));
            if (parent && !/^040000 tree [a-f\d]+\t/.test(parent))
                ruleFailure("RULE_BUNDLE_INVALID", "固定来源路径不能经过软链接或非目录。", relative);
        }
        const entry = entryAt(relative);
        if (!entry && optional)
            return null;
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
        return raw;
    };
    const layout = resolveAuthorLayout(read);
    const files = layout.files.map(({ source: relative, target }) => {
        const raw = layout.snapshot.get(relative) ?? read(relative, false);
        return { path: target, raw, sha256: digest(raw) };
    });
    const ruleContract = layout.ruleContract ?? 1;
    if (ruleContract === 2)
        validateLinks(files);
    const destination = path.resolve(output);
    // 排他建立最终目录；失败保留具体产物，不覆盖或清理调用者已有路径。
    mkdirSync(destination);
    for (const file of files) {
        mkdirSync(path.dirname(path.join(destination, file.path)), { recursive: true });
        writeFileSync(path.join(destination, file.path), file.raw, { flag: "wx" });
    }
    writeFileSync(path.join(destination, "source.json"), JSON.stringify({ schemaVersion: 1, ruleContract, source, files: files.map(({ raw, ...entry }) => entry) }, null, 2) + "\n", { flag: "wx" });
    return readBundle(destination);
}
