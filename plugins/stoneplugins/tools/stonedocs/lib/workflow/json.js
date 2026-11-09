import { OperationError } from "../files/write.js";
import { isUtf8Text } from "../documents/files.js";
export function invalidInput(message) {
    throw new OperationError({ code: "INPUT_INVALID", message, path: "input", remedy: "按当前命令 help 的 schemaVersion 与字段说明提供完整 JSON，不传状态或归属副本。" }, 2);
}
export function parseJsonInput(raw) {
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        invalidInput("输入不是有效 JSON。");
    }
    const objects = [];
    for (const token of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}]/g)) {
        if (token[0] === "{")
            objects.push(new Set());
        else if (token[0] === "}")
            objects.pop();
        else if (raw.slice(token.index + token[0].length).trimStart().startsWith(":")) {
            const key = JSON.parse(token[0]), current = objects.at(-1);
            if (current.has(key))
                invalidInput("JSON 存在重复字段：" + key);
            current.add(key);
        }
    }
    return value;
}
export function inputObject(value, allowed, required) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        invalidInput("输入需要 JSON 对象。");
    const input = value;
    for (const field of Object.keys(input)) {
        if (!allowed.includes(field))
            invalidInput("未知字段：" + field);
        if (input[field] === undefined)
            invalidInput("字段不能为 undefined：" + field);
    }
    for (const field of required)
        if (!Object.hasOwn(input, field))
            invalidInput("缺少字段：" + field);
    if (input.schemaVersion !== 1)
        invalidInput("schemaVersion 必须为整数 1。");
    return input;
}
export function inputText(value, name, multiline = false) {
    if (typeof value !== "string" || !value.trim() || !isUtf8Text(value) || value.includes("\0") || (!multiline && /[\r\n]/.test(value)))
        invalidInput(name + " 需要非空" + (multiline ? "文本。" : "单行文本。"));
    return value.trim();
}
export function inputStrings(value, name, allowEmpty = false) {
    if (!Array.isArray(value) || (!allowEmpty && !value.length))
        invalidInput(name + " 需要" + (allowEmpty ? "" : "非空") + "字符串数组。");
    return Array.from(value, (entry) => inputText(entry, name));
}
