import { lstatSync } from "node:fs";
import path from "node:path";
import { isMissing, projectDirectories, readProjectText } from "../documents/files.js";
import { readObjects } from "../documents/read.js";
import { OperationError } from "../files/write.js";
export const METADATA = "docs/.stonedocs.json", SOP_INDEX_ALIAS = "docs/sop/index.md";
/** 采用与升级只处理真实项目内的普通文件；缺失与 I/O 不能混作同一种结果。 */
export function currentAdoptionFile(root, relative, invalidCode = "ADOPTION_TARGET_INVALID") {
    const invalid = () => { throw new OperationError({ code: invalidCode, message: "管理目标须为真实项目内普通文件及目录，不能使用链接或其它对象。", path: relative, remedy: "保留当前资料，核对明确管理路径及项目内容后重新预览。" }, 3); };
    if (!relative || relative.includes("\\") || relative.includes("\0") || path.posix.isAbsolute(relative) || path.posix.normalize(relative) !== relative || relative === ".." || relative.startsWith("../"))
        invalid();
    let file = root;
    const parts = relative.split("/");
    for (let index = 0; index < parts.length; index++) {
        file = path.join(file, parts[index]);
        let stat;
        try {
            stat = lstatSync(file);
        }
        catch (error) {
            if (isMissing(error))
                return null;
            throw error;
        }
        if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory()))
            invalid();
    }
    return readProjectText(root, relative);
}
export function inventoryAdoption(root, basis) {
    const objects = { goal: [], phase: [], task: [] };
    for (const kind of ["goal", "phase", "task"]) {
        objects[kind] = readObjects(root, kind).objects;
        for (const object of objects[kind])
            basis.add(object.path);
    }
    for (const directory of [".", "docs", "docs/sop", "docs/goals", ...projectDirectories(root, "docs/goals")])
        basis.add(directory);
    for (const goal of objects.goal)
        basis.add(path.posix.join(path.posix.dirname(goal.path), "phases"));
    for (const phase of objects.phase)
        basis.add(path.posix.dirname(phase.path));
    return objects;
}
