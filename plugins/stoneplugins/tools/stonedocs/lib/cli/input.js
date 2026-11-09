import { readFileSync } from "node:fs";
import { UsageError } from "./commands.js";
import { parseJsonInput } from "../workflow/json.js";
function readInput(file) {
    if (file === "-" && process.stdin.isTTY)
        throw new UsageError("--input - 需要通过标准输入传入完整 JSON，不交互猜字段。");
    const bytes = readFileSync(file === "-" ? 0 : file);
    try {
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    }
    catch (error) {
        if (error instanceof TypeError)
            throw new UsageError("输入不是有效 UTF-8。");
        throw error;
    }
}
/** 文件在每次重建时重读；stdin 只消费一次并保留本次原输入。 */
export function inputLoader(file) {
    const stdin = file === "-" ? readInput(file) : undefined;
    return () => parseJsonInput(stdin ?? readInput(file));
}
