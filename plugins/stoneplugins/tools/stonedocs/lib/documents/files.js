import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
export class ReadError extends Error {
    diagnostic;
    exitCode;
    constructor(diagnostic, exitCode = 1) {
        super(diagnostic.message);
        this.diagnostic = diagnostic;
        this.exitCode = exitCode;
    }
}
/** JS 文本必须可无损写为 UTF-8，独立代理码点不能静默替换。 */
export function isUtf8Text(text) {
    return Buffer.from(text, "utf8").toString("utf8") === text;
}
export function isMissing(error) {
    return ["ENOENT", "ENOTDIR"].includes(error.code ?? "");
}
export function inside(root, file) {
    const relative = path.relative(root, file);
    return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
export function exists(file) {
    try {
        statSync(file);
        return true;
    }
    catch (error) {
        if (!isMissing(error))
            throw error;
        return false;
    }
}
/** 缺失末级也解析真实祖先，避免悬空软链接遮蔽越界位置。 */
export function resolvedPath(file, seen = new Set()) {
    const absolute = path.resolve(file);
    if (seen.has(absolute))
        return absolute;
    seen.add(absolute);
    try {
        return realpathSync(absolute);
    }
    catch (error) {
        if (!isMissing(error))
            throw error;
        try {
            if (lstatSync(absolute).isSymbolicLink())
                return resolvedPath(path.resolve(path.dirname(absolute), readlinkSync(absolute)), seen);
        }
        catch (error) {
            if (!isMissing(error))
                throw error;
        }
        const parent = path.dirname(absolute);
        return parent === absolute ? absolute : path.join(resolvedPath(parent, seen), path.basename(absolute));
    }
}
function ioError(file, error) {
    if (error instanceof ReadError)
        return error;
    const code = error.code;
    return new ReadError({ code: "IO_ERROR", message: "资料读取未完成" + (code ? "（" + code + "）" : "") + "。", path: file, remedy: "核对文件、目录和当前读取权限后重试；不要用缺失对象代替读取失败。" }, 4);
}
export function projectPath(root, relative) {
    try {
        const actualRoot = realpathSync(root);
        const file = path.resolve(actualRoot, relative);
        if (!inside(actualRoot, file) || !inside(actualRoot, resolvedPath(file))) {
            throw new ReadError({ code: "PATH_OUTSIDE_PROJECT", message: "资料路径或软链接越出明确项目根。", path: relative, remedy: "使用该项目内的真实资料，跨项目来源须另行明确指定。" });
        }
        return file;
    }
    catch (error) {
        throw ioError(relative, error);
    }
}
export function projectFileExists(root, relative) {
    const file = projectPath(root, relative);
    try {
        return statSync(file).isFile();
    }
    catch (error) {
        if (isMissing(error))
            return false;
        throw ioError(relative, error);
    }
}
export function projectDirectories(root, relative) {
    const directory = projectPath(root, relative);
    try {
        if (!statSync(directory).isDirectory())
            throw new ReadError({ code: "DIRECTORY_EXPECTED", message: "对象容器应为目录。", path: relative, remedy: "核对标准目录结构，不将资料文件当作对象目录。" });
    }
    catch (error) {
        if (isMissing(error))
            return [];
        throw ioError(relative, error);
    }
    try {
        return readdirSync(directory, { withFileTypes: true }).filter((entry) => {
            if (!entry.isDirectory() && !entry.isSymbolicLink())
                return false;
            return statSync(projectPath(root, path.join(relative, entry.name))).isDirectory();
        }).map((entry) => path.join(relative, entry.name)).sort();
    }
    catch (error) {
        throw ioError(relative, error);
    }
}
export function readProjectText(root, relative) {
    const file = projectPath(root, relative);
    try {
        if (!statSync(file).isFile())
            throw new ReadError({ code: "FILE_EXPECTED", message: "资料应为普通文件。", path: relative, remedy: "核对文件位置，不能以目录代替正文。" });
        const bytes = readFileSync(file);
        try {
            return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
        }
        catch (error) {
            if (!(error instanceof TypeError))
                throw error;
            throw new ReadError({ code: "INVALID_UTF8", message: "资料不是有效 UTF-8，无法无损返回原文。", path: relative, remedy: "修正文件编码后重试，不使用替代字符掩盖损坏内容。" });
        }
    }
    catch (error) {
        if (isMissing(error))
            throw new ReadError({ code: "FILE_NOT_FOUND", message: "资料文件不存在。", path: relative, remedy: "核对对象归属和文件位置，补齐实际资料后重试。" });
        throw ioError(relative, error);
    }
}
