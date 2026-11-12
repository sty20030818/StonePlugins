import path from "node:path";
import { documentTitle } from "./markdown.js";
import { projectFileExists, projectPath, readProjectText, ReadError } from "./files.js";
import { readdirSync, statSync } from "node:fs";
import { readAdoption } from "../rules/format.js";
import { OperationError } from "../files/write.js";
import { readAuthorLayout } from "../rules/author.js";
function authorSource(root, layout) {
    const context = ["AGENTS.md", ...(layout.metadataPath ? [layout.metadataPath] : []), ...layout.files.map((entry) => entry.source)].filter((file) => projectFileExists(root, file));
    return { source: { status: "author", state: "working-tree", metadataPath: layout.metadataPath, revision: null, repository: null, ruleContract: layout.ruleContract, context }, warnings: [] };
}
export function readRuleSource(root) {
    const context = ["AGENTS.md", "docs/guide.md", "docs/conventions.md"].filter((p) => projectFileExists(root, p));
    const source = { status: "undeclared", metadataPath: null, revision: null, repository: null, ruleContract: null, context };
    try {
        const adopted = readAdoption(root);
        if (adopted)
            return { source: { ...source, status: "recognized", metadataPath: "docs/.stonedocs.json", revision: adopted.source.revision, repository: adopted.source.repository, ruleContract: adopted.ruleContract }, warnings: [] };
    }
    catch (error) {
        if (!(error instanceof OperationError) || !["ADOPTION_UNSUPPORTED", "ADOPTION_INVALID"].includes(error.diagnostic.code))
            throw error;
        source.metadataPath = "docs/.stonedocs.json";
        source.status = error.diagnostic.code === "ADOPTION_UNSUPPORTED" ? "unrecognized" : "invalid";
        return { source, warnings: [{ code: source.status === "invalid" ? "SOURCE_METADATA_INVALID" : "SOURCE_METADATA_UNRECOGNIZED", message: source.status === "invalid" ? "采用记录损坏或管理范围无效，规范版本未知；本地正文读取继续。" : "采用格式或规则契约尚未支持，规范版本未知；不从自由文本猜版本。", path: source.metadataPath, remedy: "按项目入口核对固定来源和项目差异，不为读取自动初始化或覆盖记录。" }] };
    }
    return { source, warnings: [{ code: "SOURCE_UNDECLARED", message: "项目没有机器可识别的规范采用记录；当前只读取本地原文，不推断采用版本。", path: "docs/.stonedocs.json", remedy: "按项目入口核对来源与差异；使用明确固定规范包 init，不为读取自动创建。" }] };
}
export function readSop(root, name, author = false) {
    const layout = author ? readAuthorLayout(root) : undefined;
    if (layout?.metadataPath) {
        const declared = authorSource(root, layout);
        const entries = layout.files.filter((entry) => entry.target.startsWith("docs/sop/")).map((entry) => ({ name: path.posix.basename(entry.target) === "README.md" ? "index" : path.posix.basename(entry.target, ".md"), path: entry.source, raw: layout.snapshot.get(entry.source) }));
        if (name !== undefined) {
            const entry = entries.find((entry) => entry.name === name);
            if (!entry)
                throw new ReadError({ code: "SOP_NOT_FOUND", message: "作者描述未声明该 SOP：" + name, path: layout.metadataPath, remedy: "使用 sop list --author 查看实际作者入口，不回退其它正文。" });
            return { ...entry, title: documentTitle(entry.raw) || name, ...declared };
        }
        return { procedures: entries.map(({ name, path: relative, raw }) => ({ name, path: relative, title: documentTitle(raw) || name })), ...declared };
    }
    const directory = projectPath(root, "docs/sop");
    let exists = false;
    try {
        exists = statSync(directory).isDirectory();
    }
    catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes(error.code ?? ""))
            throw error;
    }
    if (!exists)
        throw new ReadError({ code: "SOP_DIRECTORY_MISSING", message: "项目缺少本地 SOP 目录。", path: "docs/sop", remedy: "核对项目入口与规范采用范围，不从作者仓或远端静默回退。" });
    if ((name === undefined || name === "index") && projectFileExists(root, "docs/sop/README.md") && projectFileExists(root, "docs/sop/index.md"))
        throw new ReadError({ code: "SOP_NAME_AMBIGUOUS", message: "README.md 与 index.md 同时占用 index 入口。", path: "docs/sop", remedy: "明确唯一 SOP 索引，修正同名资料后再读取；不任选一份原文。" }, 3);
    const declared = layout ? authorSource(root, layout) : readRuleSource(root);
    if (name !== undefined) {
        const relative = "docs/sop/" + (name === "index" && projectFileExists(root, "docs/sop/README.md") ? "README.md" : name + ".md");
        if (!projectFileExists(root, relative))
            throw new ReadError({ code: "SOP_NOT_FOUND", message: "本地 SOP 不存在：" + name, path: relative, remedy: "先执行 sop list 查看本项目实际入口。" });
        const raw = readProjectText(root, relative);
        return { name, path: relative, title: documentTitle(raw) || name, raw, ...declared };
    }
    const procedures = readdirSync(directory).filter((file) => file.endsWith(".md")).sort().map((file) => {
        const relative = path.posix.join("docs/sop", file);
        const raw = readProjectText(root, relative);
        return { name: file === "README.md" ? "index" : file.slice(0, -3), path: relative, title: documentTitle(raw) || file };
    });
    return { procedures, ...declared };
}
