import { realpathSync, statSync } from "node:fs";
import path from "node:path";
export class ProjectError extends Error {
    diagnostic;
    constructor(project) {
        super("项目根目录必须存在且为目录");
        this.diagnostic = {
            code: "PROJECT_NOT_DIRECTORY",
            message: this.message,
            path: project,
            remedy: "通过 --project 指定实际项目根目录，不要传入文档文件或不存在的路径。",
        };
    }
}
export function resolveProjectRoot(input) {
    const project = path.resolve(input);
    let directory;
    try {
        directory = statSync(project).isDirectory();
    }
    catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes(error.code ?? ""))
            throw error;
        throw new ProjectError(project);
    }
    if (!directory)
        throw new ProjectError(project);
    return realpathSync(project);
}
export class ProjectLocationError extends Error {
    diagnostic;
    exitCode;
    constructor(message, directory, ambiguous = false) {
        super(message);
        this.exitCode = ambiguous ? 3 : 2;
        this.diagnostic = { code: ambiguous ? "PROJECT_AMBIGUOUS" : "USAGE_ERROR", message, path: directory, remedy: "使用 --project 显式选择实际项目根；不从工具源码位置或同号对象猜目标。" };
    }
}
function hasEntry(directory, relative, fileOnly = false) {
    try {
        const entry = statSync(path.join(directory, relative));
        return fileOnly ? entry.isFile() : true;
    }
    catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes(error.code ?? ""))
            throw error;
        return false;
    }
}
export function locateProject(input, toolRoot, cwd = process.cwd()) {
    if (input !== undefined)
        return resolveProjectRoot(input);
    const current = resolveProjectRoot(cwd);
    const relative = path.relative(realpathSync(toolRoot), current);
    if (relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)))
        throw new ProjectLocationError("在工具作者或安装目录中必须显式指定项目。", current);
    let boundary;
    for (let directory = current;; directory = path.dirname(directory)) {
        if (hasEntry(directory, ".git")) {
            boundary = directory;
            break;
        }
        if (path.dirname(directory) === directory)
            break;
    }
    if (!boundary) {
        if (hasEntry(current, "docs/.stonedocs.json", true))
            return current;
        throw new ProjectLocationError("没有可靠的 Git 边界或当前目录采用入口。", current);
    }
    const candidates = [];
    for (let directory = current;; directory = path.dirname(directory)) {
        if (hasEntry(directory, "docs/.stonedocs.json", true))
            candidates.push(directory);
        if (directory === boundary)
            break;
    }
    if (candidates.length !== 1)
        throw new ProjectLocationError(candidates.length ? "Git 边界内存在多个采用入口。" : "Git 边界内没有明确采用入口。", current, candidates.length > 1);
    return candidates[0];
}
