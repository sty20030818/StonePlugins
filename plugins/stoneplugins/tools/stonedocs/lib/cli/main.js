#!/usr/bin/env node
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDirectEntry } from "./entry.js";
import { COMMANDS, OPTIONS, parseCommand, UsageError } from "./commands.js";
import { checkRepository, CHECK_SCOPE } from "../documents/check.js";
import { ProjectError, ProjectLocationError, locateProject } from "../documents/project.js";
import { ReadError } from "../documents/files.js";
import { readObjects } from "../documents/read.js";
import { readRuleSource, readSop } from "../documents/sop.js";
import { executeRules, validateRulesOptions } from "./rules.js";
import { UpgradeConflict } from "../workflow/upgrade.js";
import { executeCreate, validateCreateOptions } from "./create.js";
import { CREATE_INPUTS } from "../workflow/input.js";
import { executeProgress, validateProgressOptions } from "./progress.js";
import { readRelease } from "../workflow/releases.js";
import { RELEASE_INPUTS } from "../workflow/release-format.js";
import { LIFECYCLE_INPUTS } from "../workflow/lifecycle.js";
import { readResults, RESULT_INPUT } from "../workflow/results.js";
import { OperationError } from "../files/write.js";
const toolRoot = fileURLToPath(new URL("../../", import.meta.url));
const ACTION_INPUTS = { ...LIFECYCLE_INPUTS, result: RESULT_INPUT, releasePlan: RELEASE_INPUTS.plan, releaseRecord: RELEASE_INPUTS.record };
function toolInfo() {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    const version = typeof manifest.version === "string" && manifest.version.trim() ? manifest.version : null;
    return { name: typeof manifest.name === "string" ? manifest.name : "stonedocs", version, versionKind: version ? "package" : "unversioned-source" };
}
function execute(args) {
    const result = { schemaVersion: 1, command: args[0] ?? "", projectRoot: null, outcome: "rejected", data: null, changes: [], errors: [], warnings: [] };
    try {
        const call = parseCommand(args);
        result.command = call.definition.path;
        if (call.definition.path === "check")
            result.data = { summary: null, complete: false, scope: CHECK_SCOPE };
        if (call.definition.path === "version") {
            result.data = toolInfo();
        }
        else if (call.definition.path === "help") {
            const commands = COMMANDS.filter((command) => !call.helpTarget || command.path === call.helpTarget || command.path.startsWith(call.helpTarget + " "));
            const optionNames = new Set([...commands.flatMap((command) => command.options), ...(!call.helpTarget ? ["version"] : [])]);
            result.data = {
                tool: toolInfo(), usage: "stonedocs <对象> <动作> [选项]", options: Object.fromEntries(Object.entries(OPTIONS).filter(([name]) => optionNames.has(name))),
                commands,
                inputs: Object.fromEntries(commands.flatMap((command) => command.inputKind ? [[command.inputKind, CREATE_INPUTS[command.inputKind]]] : command.inputSchema ? [[command.inputSchema, ACTION_INPUTS[command.inputSchema]]] : [])),
                projectRule: "显式 --project 优先；自动定位只认 Git 边界内唯一采用入口。作者/安装目录须显式指定，无可靠边界时不向上猜项目。写入要求显式 --project；固定采用项目按受支持记录执行，无记录作者项目另需 --author，不以读取成功替代写入资格。",
                outputRule: "文本与 JSON 表达同一结果；JSON stdout 为单个对象，npm 调用加 --silent。读取与默认创建预览不写项目；new/init/upgrade 显式 --apply，状态/结果/归档默认直接执行，可用 --dry-run 预览；恢复会写明确目标。--apply 和 --author 都不代替用户授权，工具不操作 Git、安装或外部发布。",
                exits: { "0": "读取/检查/预览/应用完成", "1": "对象、结构或检查前提失败", "2": "参数或目录用法错误", "3": "身份/项目定位歧义或相关内容冲突", "4": "I/O 或操作未完成，先核对恢复信息" },
            };
        }
        else {
            if (["init", "upgrade"].includes(call.definition.path))
                validateRulesOptions(call);
            if (call.definition.inputKind)
                validateCreateOptions(call);
            if (call.definition.action)
                validateProgressOptions(call);
            const project = typeof call.options.project === "string" ? call.options.project : undefined;
            if (call.definition.path.startsWith("sop ") && call.options.author && !project)
                throw new UsageError("SOP 作者读取需要显式 --project。");
            if (project)
                result.projectRoot = path.resolve(project);
            result.projectRoot = locateProject(project, toolRoot);
            const root = result.projectRoot;
            if (["init", "upgrade"].includes(call.definition.path)) {
                const initialized = executeRules(root, call);
                result.outcome = initialized.outcome;
                result.data = initialized.data;
                result.changes = initialized.changes;
                result.warnings = initialized.warnings;
                return { exitCode: 0, result };
            }
            if (call.definition.inputKind) {
                const created = executeCreate(root, call);
                result.outcome = created.outcome;
                result.data = created.data;
                result.changes = created.changes;
                result.warnings = created.warnings;
                return { exitCode: 0, result };
            }
            if (call.definition.action) {
                const written = executeProgress(root, call);
                result.outcome = written.outcome;
                result.data = written.data;
                result.changes = written.changes;
                result.warnings = written.warnings;
                return { exitCode: 0, result };
            }
            if (call.definition.path === "release show") {
                const { warnings, conflicts, ...data } = readRelease(root, { version: call.argument, goal: typeof call.options.goal === "string" ? call.options.goal : undefined, phase: typeof call.options.phase === "string" ? call.options.phase : undefined });
                const declared = readRuleSource(root);
                result.data = { ...data, source: declared.source };
                result.errors = conflicts;
                result.warnings = [...warnings, ...declared.warnings];
                result.outcome = conflicts.length ? "rejected" : "read";
                return { exitCode: conflicts.length ? 3 : 0, result };
            }
            if (call.definition.path === "result show") {
                const shown = readResults(root, call.options.kind, call.argument, typeof call.options.batch === "string" ? call.options.batch : undefined);
                const { warnings, ...data } = shown;
                const declared = readRuleSource(root);
                result.data = { ...data, source: declared.source };
                result.warnings = [...warnings, ...declared.warnings];
                result.outcome = "read";
                return { exitCode: 0, result };
            }
            if (call.definition.path === "check") {
                const checked = checkRepository(root);
                const { markdown, links, goals, phases, tasks } = checked;
                result.data = { summary: { markdown, links, goals, phases, tasks }, complete: checked.complete, scope: CHECK_SCOPE };
                result.errors = checked.diagnostics;
                result.outcome = !checked.complete ? "incomplete" : checked.diagnostics.length ? "rejected" : "read";
                return { exitCode: !checked.complete ? 4 : checked.diagnostics.length ? 1 : 0, result };
            }
            if (call.definition.path.startsWith("sop ")) {
                const { warnings, ...data } = readSop(root, call.argument, call.options.author === true);
                result.data = data;
                result.warnings = warnings;
            }
            else {
                const kind = call.definition.path.split(" ")[0];
                const query = Object.fromEntries(Object.entries({ id: call.argument, goal: call.options.goal, phase: call.options.phase, status: call.options.status }).filter((entry) => typeof entry[1] === "string"));
                const { objects, warnings } = readObjects(root, kind, query);
                const declared = readRuleSource(root);
                result.data = { objects: call.argument ? objects : objects.map(({ raw, ...summary }) => summary), source: declared.source };
                result.warnings = [...warnings, ...declared.warnings];
            }
        }
        result.outcome = "read";
        return { exitCode: 0, result };
    }
    catch (error) {
        if (error instanceof UpgradeConflict) {
            result.errors = error.conflicts;
            result.data = { comparisons: error.comparisons, sources: error.sources, mode: error.mode };
            result.outcome = "rejected";
            return { exitCode: 3, result };
        }
        if (error instanceof OperationError) {
            result.errors.push(error.diagnostic);
            result.outcome = error.exitCode === 4 ? "incomplete" : "rejected";
            if (error.recovery)
                result.data = { recovery: error.recovery };
            result.changes = error.changes ?? [];
            return { exitCode: error.exitCode, result };
        }
        if (error instanceof UsageError) {
            result.errors.push(error.diagnostic);
            return { exitCode: 2, result };
        }
        if (error instanceof ProjectError) {
            result.errors.push(error.diagnostic);
            return { exitCode: 2, result };
        }
        if (error instanceof ProjectLocationError) {
            result.errors.push(error.diagnostic);
            return { exitCode: error.exitCode, result };
        }
        if (error instanceof ReadError) {
            result.errors.push(error.diagnostic);
            result.outcome = error.exitCode === 4 ? "incomplete" : "rejected";
            return { exitCode: error.exitCode, result };
        }
        const failure = error;
        result.errors.push({ code: "IO_ERROR", message: "操作未完成" + (failure.code ? "（" + failure.code + "）" : "") + "。", path: typeof failure.path === "string" ? failure.path : result.projectRoot ?? "tool", remedy: "核对目录、文件和读取权限，不改写原资料后重试。" });
        result.outcome = "incomplete";
        return { exitCode: 4, result };
    }
}
function printText(result, exitCode) {
    const data = result.data;
    if (result.projectRoot)
        console.log("项目：" + result.projectRoot);
    if (data?.summary) {
        const s = data.summary;
        console.log("检查 " + s.markdown + " Markdown、" + s.links + " 本地链接、" + s.goals + " Goal、" + s.phases + " Phase、" + s.tasks + " Task。");
        console.log("范围：" + String(data.scope));
    }
    else if (result.command === "help" && data) {
        const tool = data.tool;
        console.log(tool.name + " " + (tool.version ?? "unversioned-source"));
        console.log(data.usage);
        for (const command of data.commands)
            console.log("\n" + command.usage + "\n" + command.summary + "\n示例：stonedocs " + command.example);
        for (const [name, option] of Object.entries(data.options))
            console.log("--" + name + (option.value ? " <" + option.value + ">" : "") + "：" + option.description);
        if (data.inputs && Object.keys(data.inputs).length)
            console.log("操作输入：" + JSON.stringify(data.inputs, null, 2));
        console.log("\n" + data.projectRule + "\n" + data.outputRule + "\n退出码：" + JSON.stringify(data.exits));
    }
    else if (result.command === "version" && data)
        console.log(data.name + " " + (data.version ?? "unversioned-source（源码未标版本）"));
    else if (result.command === "release show" && data)
        console.log("发布意图、实际记录与原文：\n" + JSON.stringify(data, null, 2));
    else if (result.command === "result show" && data)
        console.log(String(data.path) + "\n" + String(data.raw) + "\n结果批次与未识别原文：\n" + JSON.stringify({ records: data.records, legacy: data.legacy }, null, 2));
    else if (typeof data?.raw === "string")
        console.log(String(data.path) + "\n" + data.raw);
    else if (Array.isArray(data?.procedures))
        for (const p of data.procedures)
            console.log(p.name + " · " + p.title + " · " + p.path);
    else if (Array.isArray(data?.objects))
        for (const object of data.objects) {
            console.log(object.id + " · " + object.title + " · " + object.status + " · " + object.path + ":" + object.lineStart + "-" + object.lineEnd);
            console.log("归属：Goal=" + (object.goalId ?? "自身") + " Phase=" + (object.phaseId ?? "无") + " archived=" + object.archived);
            if ("raw" in object)
                console.log(object.raw);
            for (const related of object.related)
                console.log("材料：" + related.kind + " " + related.path);
        }
    if (["preview", "applied", "unchanged"].includes(result.outcome)) {
        console.log("结果：" + result.outcome + "\n" + JSON.stringify(data, null, 2));
        for (const change of result.changes)
            console.log("\n文件：" + change.path + "\n原文：\n" + (change.before ?? "（不存在）") + "\n拟写入/实际结果：\n" + (change.after ?? "（删除）"));
    }
    if (result.outcome === "rejected" && Array.isArray(data?.comparisons))
        console.log("升级比较：" + JSON.stringify({ sources: data.sources, mode: data.mode, comparisons: data.comparisons }, null, 2));
    if (data?.recovery)
        console.log("恢复信息：" + JSON.stringify(data.recovery, null, 2));
    if (data?.source)
        console.log("规范来源：" + JSON.stringify(data.source));
    for (const issue of result.warnings)
        console.error("WARN [" + issue.code + "] " + issue.path + ": " + issue.message + "\n" + issue.remedy);
    for (const issue of result.errors)
        console.log("FAIL [" + issue.code + "] " + issue.path + ": " + issue.message + "\n" + issue.remedy);
    if (result.command === "check" || exitCode)
        console.log(exitCode === 0 ? "PASS" : result.outcome === "incomplete" ? "INCOMPLETE" : "FAIL");
}
export function main(args = process.argv.slice(2)) {
    const { exitCode, result } = execute(args);
    if (args.includes("--json"))
        console.log(JSON.stringify(result));
    else
        printText(result, exitCode);
    return exitCode;
}
if (isDirectEntry(import.meta.url))
    process.exitCode = main();
