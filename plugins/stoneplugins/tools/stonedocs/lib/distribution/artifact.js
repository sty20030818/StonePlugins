import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { readBundle } from "../rules/bundle.js";
import { fixedSource, isRuleContract, readRuleText, ruleFailure, ruleJson, ruleObject } from "../rules/format.js";
import { isSemVer } from "../version.js";
export const BUILD_INPUTS = ["package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json", "scripts/build-cli.ts"];
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const invalid = "CLI_ARTIFACT_INVALID";
function fail(message, file = "artifact.json") { return ruleFailure(invalid, message, file); }
const validSourcePath = (file) => typeof file === "string" && (BUILD_INPUTS.includes(file) || /^src\/(?:[a-z][a-z\d-]*\/)*[a-z][a-z\d-]*\.ts$/.test(file));
export function validateCliVersion(value) {
    if (typeof value === "string" && isSemVer(value))
        return value;
    return fail("CLI 版本必须是明确 SemVer，不从产品目标或插件版本推导。");
}
/** 整个分发单元封闭核对；摘要证明字节一致，不代替发布者身份认证。 */
export function readArtifact(directory, options = {}) {
    const stat = lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory())
        fail("CLI 包必须是普通目录。", directory);
    const root = realpathSync(directory);
    const record = ruleObject(ruleJson(readRuleText(root, "artifact.json", invalid), invalid, "artifact.json"), ["schemaVersion", "cliContract", "ruleContract", "version", "source", "rules", "files"], invalid, "artifact.json");
    if (record.schemaVersion !== 1 || record.cliContract !== 1 || !isRuleContract(record.ruleContract))
        fail("CLI 包或配套契约尚未支持。");
    const version = validateCliVersion(record.version);
    const declaredSource = ruleObject(record.source, ["repository", "revision", "state", "files"], invalid, "artifact.json");
    const source = fixedSource({ repository: declaredSource.repository, revision: declaredSource.revision }, invalid, "artifact.json");
    if (declaredSource.state !== "working-tree" && declaredSource.state !== "commit")
        fail("CLI 来源状态无效。");
    if (options.release && declaredSource.state !== "commit")
        fail("工作树 CLI 候选不能作为正式分发产物。");
    if (!Array.isArray(declaredSource.files))
        fail("缺少 CLI 构建输入摘要。");
    const sourceFiles = declaredSource.files.map((entry) => {
        const item = ruleObject(entry, ["path", "sha256"], invalid, "artifact.json");
        if (!validSourcePath(item.path) || typeof item.sha256 !== "string" || !/^[a-f\d]{64}$/.test(item.sha256))
            fail("CLI 构建输入路径或摘要无效。");
        return { path: item.path, sha256: item.sha256 };
    });
    if (new Set(sourceFiles.map((file) => file.path)).size !== sourceFiles.length || BUILD_INPUTS.some((file) => !sourceFiles.some((entry) => entry.path === file)) || !["src/cli/main.ts", "src/distribution/artifact.ts", "src/rules/bundle.ts"].every((file) => sourceFiles.some((entry) => entry.path === file)))
        fail("CLI 构建输入缺失或重复。");
    const rules = fixedSource(record.rules, invalid, "artifact.json");
    const bundle = readBundle(path.join(root, "rules"));
    if (bundle.ruleContract !== record.ruleContract || JSON.stringify(bundle.source) !== JSON.stringify(rules))
        fail("CLI 清单与固定规范来源或契约不一致。", "rules/source.json");
    const expected = ["package.json", "rules/source.json", ...bundle.files.map((file) => "rules/" + file.path), ...sourceFiles.filter((file) => file.path.startsWith("src/")).map((file) => "lib/" + file.path.slice(4, -3) + ".js")].sort();
    if (!Array.isArray(record.files))
        fail("缺少 CLI 运行文件清单。");
    const files = record.files.map((entry) => {
        const item = ruleObject(entry, ["path", "sha256", "executable"], invalid, "artifact.json");
        if (typeof item.path !== "string" || !expected.includes(item.path) || typeof item.sha256 !== "string" || !/^[a-f\d]{64}$/.test(item.sha256) || typeof item.executable !== "boolean" || item.executable !== (item.path === "lib/cli/main.js"))
            fail("CLI 运行文件路径、摘要或执行属性无效。");
        return { path: item.path, sha256: item.sha256, executable: item.executable };
    });
    if (JSON.stringify(files.map((file) => file.path).sort()) !== JSON.stringify(expected))
        fail("CLI 运行文件清单缺失或重复。");
    const actual = [];
    const expectedDirectories = new Set(expected.flatMap((file) => file.split("/").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("/"))));
    const walk = (relative = "") => {
        for (const name of readdirSync(path.join(root, relative))) {
            const file = relative ? relative + "/" + name : name;
            const entry = lstatSync(path.join(root, file));
            if (entry.isSymbolicLink())
                fail("CLI 包不能包含软链接。", file);
            if (entry.isDirectory()) {
                if (!expectedDirectories.has(file))
                    fail("CLI 包包含未声明目录。", file);
                walk(file);
            }
            else if (entry.isFile())
                actual.push(file);
            else
                fail("CLI 包只能包含普通文件和目录。", file);
        }
    };
    walk();
    if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected, "artifact.json"].sort()))
        fail("CLI 包包含未声明文件或缺少运行文件。");
    for (const file of files) {
        const target = path.join(root, file.path);
        if (sha256(readFileSync(target)) !== file.sha256 || Boolean(lstatSync(target).mode & 0o111) !== file.executable)
            fail("CLI 运行文件被改写或执行属性不匹配。", file.path);
    }
    const pkg = ruleObject(ruleJson(readRuleText(root, "package.json", invalid), invalid, "package.json"), ["name", "version", "private", "type", "engines", "bin", "exports", "files"], invalid, "package.json");
    const engines = ruleObject(pkg.engines, ["node"], invalid, "package.json");
    const bin = ruleObject(pkg.bin, ["stonedocs"], invalid, "package.json");
    const exports = ruleObject(pkg.exports, [".", "./artifact"], invalid, "package.json");
    if (pkg.name !== "stonedocs" || pkg.version !== version || pkg.private !== true || pkg.type !== "module" || engines.node !== ">=22.18.0" || bin.stonedocs !== "lib/cli/main.js" || exports["."] !== "./lib/cli/main.js" || exports["./artifact"] !== "./lib/distribution/artifact.js" || JSON.stringify(pkg.files) !== JSON.stringify(["lib/", "rules/", "artifact.json"]))
        fail("CLI 包声明不符合独立、无安装脚本的运行契约。", "package.json");
    return { root, manifest: { schemaVersion: 1, cliContract: 1, ruleContract: bundle.ruleContract, version, source: { ...source, state: declaredSource.state, files: sourceFiles }, rules, files }, rules: bundle };
}
