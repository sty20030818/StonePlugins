#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
// npm run build 生成无依赖的 JavaScript Hook；正文只由包内 Skill 持有。
const CONTEXT_BYTE_LIMIT = 8_000;
const FAILURE_CONTEXT = "暂停工程决定并报告加载失败，不自动安装，也不回退旧缓存。";
const EVENTS = ["SessionStart", "SubagentStart", "UserPromptSubmit"];
const PROMPT_CONTEXT = "工程任务沿用本次完整送达的石头鱼工程核心，按新事实读取细则；核心缺失时通过 $stoneplugins:engineering 完整加载，失败则暂停工程决定。非工程任务遵循个人常驻约定。";
class SafeHookError extends Error {
}
function parseHookInput(rawInput) {
    let input;
    try {
        input = JSON.parse(rawInput.replace(/^\uFEFF/, ""));
    }
    catch {
        throw new SafeHookError("输入不是有效 JSON");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new SafeHookError("输入必须是 JSON 对象");
    }
    const record = input;
    const event = record.hook_event_name;
    if (typeof event !== "string" || !EVENTS.includes(event)) {
        throw new SafeHookError("Hook 事件不受支持");
    }
    return event;
}
function loadCoreContext() {
    // 从实际执行文件定位同包资源；不信任 cwd 或用户提供的 PLUGIN_ROOT。
    const skillUrl = new URL("../skills/engineering/SKILL.md", import.meta.url);
    let source;
    try {
        const pluginRoot = `${realpathSync(new URL("../", import.meta.url))}${sep}`;
        if (!realpathSync(skillUrl).startsWith(pluginRoot)) {
            throw new SafeHookError("包内 Skill 路径越界");
        }
        source = readFileSync(skillUrl, "utf8").replace(/^\uFEFF/, "");
    }
    catch (error) {
        if (error instanceof SafeHookError)
            throw error;
        throw new SafeHookError("包内 Skill 无法读取");
    }
    const parts = /^---\r?\n([\s\S]*?)\r?\n---\r?\n(?:\r?\n)?([\s\S]*)$/.exec(source);
    const metadata = parts?.[1]?.replace(/\r\n/g, "\n");
    // ponytail: 仅校验本包两个单行字段；新增 YAML 形态时再扩展。
    if (!parts || !metadata || metadata.split("\n").length !== 2 ||
        !/^name: (?:engineering|"engineering"|'engineering')$/m.test(metadata) ||
        !/^description: "[^"\r\n]+"$/m.test(metadata)) {
        throw new SafeHookError("包内 Skill frontmatter 无效");
    }
    const body = parts[2];
    if (!body.trim()) {
        throw new SafeHookError("包内 Skill 正文为空");
    }
    const context = [
        "石头鱼的工程核心已通过本次上下文完整送达，仅适用于工程任务；恢复、压缩或子 Agent 以本次正文为准。已完整收到时不为展示调用重复读取核心，细则仍按需读取。",
        `Skill 入口：$stoneplugins:engineering；文件：${fileURLToPath(skillUrl)}`,
        `相对路径基准：${fileURLToPath(new URL("./", skillUrl))}；细则目录：${fileURLToPath(new URL("./references/", skillUrl))}`,
        "下文是该 Skill 去除 frontmatter 的完整正文：",
        "",
        body,
    ].join("\n");
    if (Buffer.byteLength(context, "utf8") > CONTEXT_BYTE_LIMIT) {
        throw new SafeHookError("工程上下文超过 8000-byte 预算");
    }
    return context;
}
let event;
let output;
try {
    event = parseHookInput(readFileSync(0, "utf8"));
    output = {
        hookSpecificOutput: {
            hookEventName: event,
            additionalContext: event === "UserPromptSubmit" ? PROMPT_CONTEXT : loadCoreContext(),
        },
    };
}
catch (error) {
    const reason = error instanceof SafeHookError ? error.message : "未知错误";
    const message = `未能加载石头鱼的工程规则：${reason}。${FAILURE_CONTEXT}`;
    output = {
        systemMessage: message,
        ...(event ? { hookSpecificOutput: { hookEventName: event, additionalContext: message } } : {}),
    };
}
process.stdout.write(JSON.stringify(output));
