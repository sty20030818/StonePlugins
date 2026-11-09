import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fchmodSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isUtf8Text } from "../documents/files.js";
export class OperationError extends Error {
    diagnostic;
    exitCode;
    recovery;
    changes;
    constructor(diagnostic, exitCode) { super(diagnostic.message); this.diagnostic = diagnostic; this.exitCode = exitCode; }
}
const DIRECTORY = ".stonedocs-operation";
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const sha = (value) => createHash("sha256").update(value).digest("hex");
const missing = (error) => ["ENOENT", "ENOTDIR"].includes(error?.code ?? "");
function fail(code, message, file, exitCode = 3, remedy = "保留当前内容，重新核对目标和相关输入后再预览。 ") {
    throw new OperationError({ code, message, path: file, remedy: remedy.trim() }, exitCode);
}
function normalized(relative, rootAllowed = false) {
    return typeof relative === "string" && !!relative && !path.isAbsolute(relative) && path.normalize(relative) === relative && (rootAllowed || relative !== ".") && relative !== ".." && !relative.startsWith(".." + path.sep) && ![".git", DIRECTORY].includes(relative.split(path.sep)[0]);
}
/** 写者只处理普通路径；不通过项目内软链接间接修改另一位置。 */
function target(root, relative, rootAllowed = false) {
    if (!normalized(relative, rootAllowed))
        fail("PLAN_INVALID", "变更路径必须是项目内规范相对路径。", relative, 2);
    const actualRoot = realpathSync(root);
    let current = actualRoot;
    for (const part of relative === "." ? [] : relative.split(path.sep)) {
        current = path.join(current, part);
        try {
            if (lstatSync(current).isSymbolicLink())
                fail("WRITE_SYMLINK", "写入依据或目标不能通过软链接定位。", relative);
        }
        catch (error) {
            if (missing(error))
                continue;
            throw error;
        }
    }
    return path.join(actualRoot, relative);
}
function fileBytes(root, relative) {
    const file = target(root, relative);
    try {
        const stat = lstatSync(file);
        if (!stat.isFile())
            fail("CONTENT_CHANGED", "预期的普通文件变成了其它对象。", relative);
        return { bytes: readFileSync(file), mode: stat.mode & 0o7777 };
    }
    catch (error) {
        if (missing(error))
            return null;
        throw error;
    }
}
function childIgnored(directory, child, paths) {
    const prefix = directory === "." ? "" : directory + path.sep;
    return paths.some((file) => file.startsWith(prefix) && file.slice(prefix.length).split(path.sep)[0] === child);
}
function capturePathGuard(root, relative, ignoredPaths) {
    const file = target(root, relative, true);
    try {
        const stat = lstatSync(file);
        if (stat.isFile())
            return { path: relative, kind: "file", hash: sha(Buffer.concat([Buffer.from(String(stat.mode & 0o7777) + "\0"), readFileSync(file)])) };
        if (!stat.isDirectory())
            fail("GUARD_INVALID", "写入依据必须为普通文件或目录。", relative);
        const children = readdirSync(file, { withFileTypes: true }).filter((entry) => !(relative === "." && entry.name === DIRECTORY) && !childIgnored(relative, entry.name, ignoredPaths)).map((entry) => [entry.name, entry.isDirectory() ? "directory" : entry.isFile() ? "file" : entry.isSymbolicLink() ? "symlink" : "other"]).sort((a, b) => a[0].localeCompare(b[0]));
        return { path: relative, kind: "directory", hash: sha(JSON.stringify(children)) };
    }
    catch (error) {
        if (missing(error))
            return { path: relative, kind: "missing", hash: null };
        throw error;
    }
}
export function captureGuard(root, relative, changes = []) {
    return capturePathGuard(root, relative, changes.map((change) => change.path));
}
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
    if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || (typeof value === "number" && !Number.isFinite(value)))
        fail("PLAN_INVALID", "计划必须能无损表达为 JSON。", "plan", 2);
    return value;
}
function validatePlan(plan) {
    if (!plan || plan.schemaVersion !== 1 || typeof plan.projectRoot !== "string" || !plan.command || !plan.object?.id || !Array.isArray(plan.changes) || !Array.isArray(plan.guards))
        fail("PLAN_INVALID", "变更计划结构不完整。", "plan", 2);
    const seen = new Set();
    for (const change of plan.changes) {
        if (!normalized(change.path) || seen.has(change.path) || (change.before !== null && typeof change.before !== "string") || typeof change.after !== "string" || !isUtf8Text(change.after) || (change.before !== null && !isUtf8Text(change.before)))
            fail("PLAN_INVALID", "变更路径重复或正文不能无损保存。", change.path, 2);
        seen.add(change.path);
    }
    for (const guard of plan.guards)
        if (!normalized(guard.path, true) || !["file", "directory", "missing"].includes(guard.kind) || (guard.kind === "missing" ? guard.hash !== null : typeof guard.hash !== "string"))
            fail("PLAN_INVALID", "写入依据无效。", guard.path, 2);
}
export function planToken(plan) {
    validatePlan(plan);
    return sha(JSON.stringify(canonical(plan)));
}
function ensurePlanRoot(root, plan) {
    validatePlan(plan);
    if (realpathSync(root) !== plan.projectRoot)
        fail("OPERATION_MISMATCH", "计划属于另一项目。", root);
    for (const change of plan.changes)
        target(root, change.path);
}
function assertBefore(root, change) {
    const current = fileBytes(root, change.path);
    if (change.before === null ? current !== null : !current?.bytes.equals(Buffer.from(change.before)))
        fail("CONTENT_CHANGED", "目标内容已变化或新目标被抢占。", change.path);
}
function checkGuards(root, plan, recovery) {
    const ignoredPaths = [...plan.changes.map((change) => change.path), ...(recovery ? validatedTemporaryFiles(root, recovery) : [])];
    for (const guard of plan.guards) {
        if (recovery && (plan.changes.some((c) => c.path === guard.path) || (guard.kind === "missing" && recovery.createdDirectories.some((directory) => directory.path === guard.path))))
            continue;
        const actual = capturePathGuard(root, guard.path, ignoredPaths);
        if (actual.kind !== guard.kind || actual.hash !== guard.hash)
            fail("CONTENT_CHANGED", "相关写入依据已经变化。", guard.path);
    }
}
function operationPath(root) {
    const directory = path.join(realpathSync(root), DIRECTORY);
    try {
        const stat = lstatSync(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            fail("OPERATION_PENDING", "操作位置已有非普通目录，不能接管。", DIRECTORY);
    }
    catch (error) {
        if (!missing(error))
            throw error;
    }
    return directory;
}
/** 普通无变更重试也须先处理旧中断；此只读检查不替代实际写入时的排他锁。 */
export function assertOperationReady(root) {
    const directory = operationPath(root);
    if (existsSync(directory))
        fail("OPERATION_PENDING", "项目存在在途或中断操作，请核对后显式恢复。", DIRECTORY, 3, "使用原命令和操作 ID 执行 --resume 或 --rollback；不自动接管或删除记录。");
}
function jsonFile(directory, name) {
    const file = path.join(directory, name);
    if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())
        fail("OPERATION_CORRUPT", "操作记录不是普通文件。", file, 4);
    try {
        return JSON.parse(UTF8.decode(readFileSync(file)));
    }
    catch {
        return fail("OPERATION_CORRUPT", "操作记录损坏，不能猜测恢复。", file, 4);
    }
}
function writeJournal(directory, journal) {
    const location = lstatSync(directory);
    if (!location.isDirectory() || location.isSymbolicLink())
        fail("OPERATION_CORRUPT", "操作目录已变化，不能写恢复材料。", directory, 4);
    const temporary = path.join(directory, "journal-" + journal.operationId + ".tmp");
    const fd = openSync(temporary, "wx", 0o600);
    try {
        writeFileSync(fd, JSON.stringify(journal));
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    renameSync(temporary, path.join(directory, "journal.json"));
}
function ownerActive(pid) {
    if (!Number.isInteger(pid) || pid <= 0)
        fail("OPERATION_CORRUPT", "操作记录中的进程身份无效。", DIRECTORY, 4);
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        const code = error.code;
        if (code === "ESRCH")
            return false;
        if (code === "EPERM")
            return true;
        throw error;
    }
}
function directoryRecord(root, relative) {
    const stat = lstatSync(target(root, relative), { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink())
        fail("CONTENT_CHANGED", "本操作目录已被替换为其它对象。", relative);
    return { path: relative, dev: stat.dev.toString(), ino: stat.ino.toString(), removed: false };
}
function checkDirectory(root, directory) {
    let current;
    try {
        current = directoryRecord(root, directory.path);
    }
    catch (error) {
        if (missing(error) && directory.removed)
            return;
        if (missing(error))
            fail("CONTENT_CHANGED", "已创建的目录不再存在，无法确认本操作所有权。", directory.path);
        throw error;
    }
    if (directory.removed || current.dev !== directory.dev || current.ino !== directory.ino)
        fail("CONTENT_CHANGED", "同路径目录的实际身份已变化，不能继续写入或删除。", directory.path);
}
function checkDirectories(root, journal) { for (const directory of journal.createdDirectories)
    checkDirectory(root, directory); }
function parentsToCreate(root, changes) {
    const directories = new Set();
    for (const change of changes)
        for (let directory = path.dirname(change.path); directory !== "."; directory = path.dirname(directory)) {
            const file = target(root, directory);
            try {
                if (!lstatSync(file).isDirectory())
                    fail("CONTENT_CHANGED", "目标父路径不是目录。", directory);
            }
            catch (error) {
                if (!missing(error))
                    throw error;
                directories.add(directory);
            }
        }
    return [...directories].sort((a, b) => a.split(path.sep).length - b.split(path.sep).length || a.localeCompare(b));
}
function temporaryPath(root, change, operationId, index) {
    return target(root, path.join(path.dirname(change.path), "." + path.basename(change.path) + ".stonedocs-" + operationId + "-" + index + ".tmp"));
}
function replace(root, change, content, expected, mode, operationId, index) {
    const file = target(root, change.path), temporary = temporaryPath(root, change, operationId, index);
    if (existsSync(temporary)) {
        const stat = lstatSync(temporary);
        if (!stat.isFile() || stat.isSymbolicLink() || !readFileSync(temporary).equals(Buffer.from(content)))
            fail("CONTENT_CHANGED", "操作临时文件已变化，不能覆盖。", temporary);
        unlinkSync(temporary);
    }
    const fd = openSync(temporary, "wx", mode);
    try {
        writeFileSync(fd, content);
        fchmodSync(fd, mode);
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    const latest = fileBytes(root, change.path);
    if (expected === null ? latest !== null : !latest?.bytes.equals(Buffer.from(expected)))
        fail("CONTENT_CHANGED", "写入前目标已被另一执行者改变。", change.path);
    if (expected === null) {
        linkSync(temporary, file);
        unlinkSync(temporary);
    }
    else
        renameSync(temporary, file);
}
function fileState(root, journal, index) {
    const change = journal.plan.changes[index], current = fileBytes(root, change.path), mode = journal.modes[index];
    if (change.before === null && current === null)
        return "before";
    if (current && current.bytes.equals(Buffer.from(change.after)) && (current.mode === (mode ?? (0o666 & ~process.umask()))))
        return "after";
    if (current && change.before !== null && current.bytes.equals(Buffer.from(change.before)) && current.mode === mode)
        return "before";
    return fail("CONTENT_CHANGED", "相关文件已不是本操作前后内容，停止恢复。", change.path);
}
/** 顺序写入只能越过已核对的前缀；最后一项也不能掩盖前序的新改动。 */
function assertAppliedPrefix(root, journal, end) {
    for (let index = 0; index < end; index++)
        if (fileState(root, journal, index) !== "after")
            fail("CONTENT_CHANGED", "已完成的前序文件不再匹配本次结果，停止后续写入。", journal.plan.changes[index].path);
}
/** 只认 journal 指定操作和索引的精确临时名；未知或后改材料不被目录 guard 忽略。 */
function validatedTemporaryFiles(root, journal) {
    const files = [];
    for (let index = 0; index < journal.plan.changes.length; index++) {
        const change = journal.plan.changes[index], temporary = temporaryPath(root, change, journal.operationId, index);
        let stat;
        try {
            stat = lstatSync(temporary);
        }
        catch (error) {
            if (missing(error))
                continue;
            throw error;
        }
        if (!stat.isFile() || stat.isSymbolicLink())
            fail("CONTENT_CHANGED", "临时材料不再是本操作普通文件，保留现场。", temporary, 4);
        const bytes = readFileSync(temporary);
        if (!bytes.equals(Buffer.from(change.after)) && (change.before === null || !bytes.equals(Buffer.from(change.before))))
            fail("CONTENT_CHANGED", "临时材料包含后续改动，保留现场。", temporary, 4);
        files.push(path.relative(root, temporary));
    }
    return files;
}
function cleanupTemporaryFiles(root, journal) {
    for (const relative of validatedTemporaryFiles(root, journal))
        unlinkSync(target(root, relative));
}
function cleanup(root, directory, journal, ownClaim) {
    cleanupTemporaryFiles(root, journal);
    const names = readdirSync(directory);
    for (const name of names) {
        if (["owner.json", "journal.json", "journal-" + journal.operationId + ".tmp"].includes(name)) {
            if (!lstatSync(path.join(directory, name)).isFile() || lstatSync(path.join(directory, name)).isSymbolicLink())
                fail("OPERATION_CORRUPT", "恢复材料变成非普通文件，保留现场。", name, 4);
            continue;
        }
        if (/^claim-[a-f\d-]+\.json$/.test(name)) {
            const claim = jsonFile(directory, name);
            validOwner(claim);
            if (claim.operationId === journal.operationId && claim.projectRoot === journal.projectRoot) {
                if (name !== ownClaim && ownerActive(claim.ownerPID))
                    fail("OPERATION_ACTIVE", "另一个恢复请求仍活跃，保留操作材料。", name);
                continue;
            }
        }
        fail("OPERATION_CORRUPT", "操作目录包含未知材料，不能自动删除。", path.join(DIRECTORY, name), 4);
    }
    const recorded = jsonFile(directory, "journal.json");
    const owner = jsonFile(directory, "owner.json");
    validJournal(recorded);
    validOwner(owner);
    if (JSON.stringify(canonical(recorded)) !== JSON.stringify(canonical(journal)) || recorded.operationId !== journal.operationId || recorded.digest !== journal.digest || owner.operationId !== journal.operationId || owner.projectRoot !== journal.projectRoot)
        fail("OPERATION_CORRUPT", "操作材料身份已变化，保留现场。", DIRECTORY, 4);
    // journal 先移除、活跃 claim 最后移除，迟到恢复必须重新读取 journal 才能继续。
    const ordered = names.filter((name) => name !== ownClaim).sort((a, b) => a === "journal.json" ? -1 : b === "journal.json" ? 1 : a.localeCompare(b));
    if (ownClaim && names.includes(ownClaim))
        ordered.push(ownClaim);
    for (const name of ordered)
        unlinkSync(path.join(directory, name));
    rmdirSync(directory);
}
function recoveryInfo(root, journal) {
    const info = { operationId: journal.operationId, journalPath: path.join(DIRECTORY, "journal.json"), applied: [], pending: [], conflicted: [] };
    for (let index = 0; index < journal.plan.changes.length; index++) {
        const file = journal.plan.changes[index].path;
        try {
            info[fileState(root, journal, index) === "after" ? "applied" : "pending"].push(file);
        }
        catch {
            info.conflicted.push(file);
        }
    }
    return info;
}
function interrupted(error, journal, directory) {
    try {
        const location = lstatSync(directory);
        if (!location.isDirectory() || location.isSymbolicLink())
            fail("OPERATION_CORRUPT", "操作目录已变化，不能重建材料。", directory, 4);
        if (!existsSync(path.join(directory, "owner.json")))
            writeFileSync(path.join(directory, "owner.json"), JSON.stringify({ schemaVersion: 1, operationId: journal.operationId, projectRoot: journal.projectRoot, ownerPID: journal.ownerPID }), { flag: "wx", mode: 0o600 });
        journal.ownerReleased = true;
        writeJournal(directory, journal);
    }
    catch { /* 不能核对的材料保持原样，进程结束后仍须显式核对现场。 */ }
    const cause = error instanceof OperationError ? error.diagnostic.code : error?.code ?? "IO_ERROR";
    const failure = new OperationError({ code: "OPERATION_INCOMPLETE", message: "操作未完整完成（" + cause + "），保留当前现场并核对本次恢复材料。", path: DIRECTORY, remedy: "操作 ID：" + journal.operationId + "。核对当前文件后，对同一 " + journal.command + " 显式使用 --resume 或 --rollback；不要删除用户改动或盲目重试新建。" }, 4);
    failure.recovery = recoveryInfo(journal.projectRoot, journal);
    throw failure;
}
export function applyPlan(rootInput, expect, rebuild) {
    const root = realpathSync(rootInput), directory = operationPath(root), operationId = randomUUID();
    try {
        mkdirSync(directory, { mode: 0o700 });
    }
    catch (error) {
        if (error.code === "EEXIST")
            fail("OPERATION_PENDING", "项目已有操作材料；不并发接管或自动窃锁。", DIRECTORY, 3, "先核对已有 owner.json/journal.json 和操作 ID；活跃操作结束前不要恢复。");
        throw error;
    }
    let journal;
    let journalCommitted = false;
    try {
        const owner = { schemaVersion: 1, operationId, projectRoot: root, ownerPID: process.pid };
        writeFileSync(path.join(directory, "owner.json"), JSON.stringify(owner), { flag: "wx", mode: 0o600 });
        const plan = rebuild();
        ensurePlanRoot(root, plan);
        if (planToken(plan) !== expect)
            fail("PREVIEW_CHANGED", "输入或相关资料已变化，旧预览不能应用。", "preview");
        checkGuards(root, plan);
        for (const change of plan.changes)
            assertBefore(root, change);
        const modes = plan.changes.map((change) => fileBytes(root, change.path)?.mode ?? (0o666 & ~process.umask()));
        journal = { ...owner, command: plan.command, ownerReleased: false, plan, digest: planToken(plan), modes, plannedDirectories: parentsToCreate(root, plan.changes), createdDirectories: [] };
        writeJournal(directory, journal);
        journalCommitted = true;
        for (const relative of journal.plannedDirectories) {
            const file = target(root, relative);
            mkdirSync(file);
            journal.createdDirectories.push(directoryRecord(root, relative));
            writeJournal(directory, journal);
        }
        for (let index = 0; index < plan.changes.length; index++) {
            const change = plan.changes[index];
            checkDirectories(root, journal);
            assertAppliedPrefix(root, journal, index);
            if (change.before !== change.after)
                replace(root, change, change.after, change.before, modes[index] ?? (0o666 & ~process.umask()), operationId, index);
            assertAppliedPrefix(root, journal, index + 1);
        }
        assertAppliedPrefix(root, journal, plan.changes.length);
        cleanup(root, directory, journal);
        return { outcome: plan.changes.some((c) => c.before !== c.after) ? "applied" : "unchanged", plan, operationId, changes: plan.changes.filter((c) => c.before !== c.after) };
    }
    catch (error) {
        if (journal && journalCommitted)
            return interrupted(error, journal, directory);
        try {
            const entries = readdirSync(directory);
            if (entries.every((name) => name === "owner.json" || name === "journal-" + operationId + ".tmp")) {
                for (const name of entries)
                    unlinkSync(path.join(directory, name));
                rmdirSync(directory);
            }
        }
        catch { /* 未完整记录的未知材料必须保留供人工核对。 */ }
        throw error;
    }
}
function validOwner(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        fail("OPERATION_CORRUPT", "所有者记录结构无效。", DIRECTORY, 4);
    const record = value;
    if (record.schemaVersion !== 1 || typeof record.operationId !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/.test(record.operationId) || typeof record.projectRoot !== "string" || !record.projectRoot || !Number.isInteger(record.ownerPID) || Number(record.ownerPID) <= 0 || Number(record.ownerPID) > 2147483647)
        fail("OPERATION_CORRUPT", "操作标识、所有者身份或进程类型无效。", DIRECTORY, 4);
}
function validJournal(value) {
    validOwner(value);
    const journal = value;
    if (typeof journal.command !== "string" || !journal.command || typeof journal.ownerReleased !== "boolean" || typeof journal.digest !== "string" || !Array.isArray(journal.modes) || !Array.isArray(journal.createdDirectories) || !Array.isArray(journal.plannedDirectories))
        fail("OPERATION_CORRUPT", "恢复记录字段类型无效。", DIRECTORY, 4);
    try {
        validatePlan(journal.plan);
        if (planToken(journal.plan) !== journal.digest)
            throw new Error("digest");
    }
    catch {
        fail("OPERATION_CORRUPT", "恢复计划或摘要已变化。", DIRECTORY, 4);
    }
    if (journal.modes.length !== journal.plan.changes.length || journal.modes.some((mode) => !Number.isInteger(mode) || mode < 0 || mode > 0o7777))
        fail("OPERATION_CORRUPT", "文件权限记录无效。", DIRECTORY, 4);
    const planned = new Set();
    for (const relative of journal.plannedDirectories) {
        if (typeof relative !== "string" || !normalized(relative) || planned.has(relative) || !journal.plan.changes.some((change) => change.path.startsWith(relative + path.sep)))
            fail("OPERATION_CORRUPT", "操作目录不属于唯一变更父级。", DIRECTORY, 4);
        planned.add(relative);
    }
    const created = new Set();
    for (const directory of journal.createdDirectories) {
        if (!directory || typeof directory !== "object" || typeof directory.path !== "string" || !planned.has(directory.path) || created.has(directory.path) || typeof directory.dev !== "string" || !/^\d+$/.test(directory.dev) || typeof directory.ino !== "string" || !/^\d+$/.test(directory.ino) || typeof directory.removed !== "boolean")
            fail("OPERATION_CORRUPT", "目录所有权记录无效。", DIRECTORY, 4);
        created.add(directory.path);
    }
}
function loadJournal(root, operationId, command) {
    const directory = operationPath(root);
    const journal = jsonFile(directory, "journal.json");
    validJournal(journal);
    if (journal.operationId !== operationId || journal.projectRoot !== root || journal.command !== command || journal.plan.command !== command)
        fail("OPERATION_MISMATCH", "操作 ID、命令或项目不匹配。", DIRECTORY);
    const owner = jsonFile(directory, "owner.json");
    validOwner(owner);
    if (owner.operationId !== journal.operationId || owner.projectRoot !== journal.projectRoot || owner.ownerPID !== journal.ownerPID)
        fail("OPERATION_CORRUPT", "owner 与 journal 的所有权不一致。", DIRECTORY, 4);
    ensurePlanRoot(root, journal.plan);
    if (!journal.ownerReleased && ownerActive(journal.ownerPID))
        fail("OPERATION_ACTIVE", "原操作仍在活跃进程中，不能恢复或撤销。", DIRECTORY);
    return { directory, journal };
}
function claimRecovery(directory, journal) {
    const name = "claim-" + randomUUID() + ".json";
    writeFileSync(path.join(directory, name), JSON.stringify({ schemaVersion: 1, operationId: journal.operationId, projectRoot: journal.projectRoot, ownerPID: process.pid }), { flag: "wx", mode: 0o600 });
    try {
        for (const other of readdirSync(directory).filter((item) => item !== name && /^claim-[a-f\d-]+\.json$/.test(item))) {
            const claim = jsonFile(directory, other);
            validOwner(claim);
            if (claim.operationId !== journal.operationId || claim.projectRoot !== journal.projectRoot)
                fail("OPERATION_CORRUPT", "恢复 claim 不属于本操作。", other, 4);
            if (ownerActive(claim.ownerPID))
                fail("OPERATION_ACTIVE", "另一恢复操作仍活跃，不能并行处理。", DIRECTORY);
        }
        const current = jsonFile(directory, "journal.json");
        validJournal(current);
        if (current.operationId !== journal.operationId || current.digest !== journal.digest || current.projectRoot !== journal.projectRoot || current.command !== journal.command)
            fail("OPERATION_MISMATCH", "恢复认领期间操作已变化。", DIRECTORY);
        if (!current.ownerReleased && ownerActive(current.ownerPID))
            fail("OPERATION_ACTIVE", "操作仍由活跃进程拥有。", DIRECTORY);
        const own = jsonFile(directory, name);
        validOwner(own);
        if (own.projectRoot !== journal.projectRoot || own.operationId !== journal.operationId || own.ownerPID !== process.pid)
            fail("OPERATION_MISMATCH", "恢复认领已被改变。", DIRECTORY);
        return name;
    }
    catch (error) {
        try {
            unlinkSync(path.join(directory, name));
        }
        catch { }
        throw error;
    }
}
export function recoverPlan(rootInput, operationId, action, command) {
    const root = realpathSync(rootInput);
    if (!["continue", "rollback"].includes(action))
        fail("PLAN_INVALID", "未知恢复动作。", "recovery", 2);
    const { directory, journal } = loadJournal(root, operationId, command);
    const claim = claimRecovery(directory, journal);
    let writing = false;
    try {
        checkGuards(root, journal.plan, journal);
        checkDirectories(root, journal);
        for (const relative of journal.plannedDirectories)
            if (existsSync(target(root, relative)) && !journal.createdDirectories.some((entry) => entry.path === relative))
                fail("CONTENT_CHANGED", "目标目录已出现但无法证明由本操作创建，保留现场。", relative);
        const states = journal.plan.changes.map((_c, index) => fileState(root, journal, index));
        const actual = [];
        writing = true;
        if (action === "continue") {
            for (const relative of journal.plannedDirectories) {
                const file = target(root, relative);
                if (!existsSync(file)) {
                    mkdirSync(file);
                    const index = journal.createdDirectories.findIndex((entry) => entry.path === relative);
                    if (index < 0)
                        journal.createdDirectories.push(directoryRecord(root, relative));
                    else
                        journal.createdDirectories[index] = directoryRecord(root, relative);
                    writeJournal(directory, journal);
                }
                const recorded = journal.createdDirectories.find((entry) => entry.path === relative);
                if (recorded)
                    checkDirectory(root, recorded);
            }
            for (let index = 0; index < journal.plan.changes.length; index++)
                if (states[index] === "before") {
                    const change = journal.plan.changes[index];
                    checkDirectories(root, journal);
                    assertAppliedPrefix(root, journal, index);
                    replace(root, change, change.after, change.before, journal.modes[index], operationId, index);
                    assertAppliedPrefix(root, journal, index + 1);
                    if (change.before !== change.after)
                        actual.push(change);
                }
            assertAppliedPrefix(root, journal, journal.plan.changes.length);
        }
        else {
            for (let index = journal.plan.changes.length - 1; index >= 0; index--)
                if (states[index] === "after") {
                    const change = journal.plan.changes[index];
                    checkDirectories(root, journal);
                    if (change.before === null) {
                        if (fileState(root, journal, index) !== "after")
                            fail("CONTENT_CHANGED", "回滚前目标已变化。", change.path);
                        unlinkSync(target(root, change.path));
                    }
                    else
                        replace(root, change, change.before, change.after, journal.modes[index], operationId, index);
                    if (change.before !== change.after)
                        actual.push({ path: change.path, before: change.after, after: change.before });
                }
            cleanupTemporaryFiles(root, journal);
            for (const recorded of [...journal.createdDirectories].reverse()) {
                checkDirectory(root, recorded);
                const file = target(root, recorded.path);
                if (!recorded.removed && readdirSync(file).length === 0) {
                    rmdirSync(file);
                    recorded.removed = true;
                    writeJournal(directory, journal);
                }
            }
        }
        cleanup(root, directory, journal, claim);
        return { outcome: actual.length ? "applied" : "unchanged", plan: journal.plan, operationId, changes: actual };
    }
    catch (error) {
        if (writing)
            return interrupted(error, journal, directory);
        if (error instanceof OperationError)
            error.recovery = recoveryInfo(root, journal);
        throw error;
    }
    finally {
        try {
            const file = path.join(directory, claim);
            if (existsSync(file))
                unlinkSync(file);
        }
        catch { /* 仅本 claim 清理失败时保留，不删除其它恢复材料。 */ }
    }
}
