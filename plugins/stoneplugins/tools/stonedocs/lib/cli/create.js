import { UsageError } from "./commands.js";
import { planCreate } from "../workflow/create.js";
import { inputLoader } from "./input.js";
import { applyPlan, recoverPlan, planToken } from "../files/write.js";
export function validateCreateOptions(call) {
    const o = call.options;
    if (typeof o.project !== "string")
        throw new UsageError("写入需要显式 --project；未采用作者项目另需 --author，不猜来源。");
    if (o.resume || o.rollback) {
        if (o.resume && o.rollback)
            throw new UsageError("--resume 与 --rollback 不能同时使用。");
        if (["input", "goal", "phase", "apply", "expect", "dry-run"].some((key) => Object.hasOwn(o, key)))
            throw new UsageError("恢复只使用 --resume 或 --rollback、--project、原作者模式及可选 --json，不混用创建输入。");
        return;
    }
    if (typeof o.input !== "string")
        throw new UsageError("new 需要 --input <JSON 文件或 ->。");
    if (call.definition.inputKind === "phase" && typeof o.goal !== "string")
        throw new UsageError("phase new 需要 --goal <ID>。");
    if (call.definition.inputKind === "task" && typeof o.phase !== "string")
        throw new UsageError("task new 需要 --phase <ID>。");
    if (o.apply && o["dry-run"])
        throw new UsageError("--apply 与 --dry-run 不能同时使用。");
    if (Boolean(o.apply) !== Boolean(o.expect))
        throw new UsageError("应用需同时提供 --apply 与对应 --expect，预览不接受 --expect。");
}
export function executeCreate(root, call) {
    validateCreateOptions(call);
    const o = call.options;
    if (o.resume || o.rollback) {
        const outcome = recoverPlan(root, String(o.resume ?? o.rollback), o.resume ? "continue" : "rollback", call.definition.path);
        return { outcome: outcome.outcome, data: { object: outcome.plan.object, operationId: outcome.operationId, recovery: o.resume ? "continue" : "rollback" }, changes: outcome.changes, warnings: outcome.plan.warnings ?? [] };
    }
    const kind = call.definition.inputKind;
    const parent = typeof o.goal === "string" ? o.goal : typeof o.phase === "string" ? o.phase : undefined;
    const inputFile = String(o.input);
    const load = inputLoader(inputFile);
    const rebuild = () => planCreate(root, kind, parent, load(), o.author === true);
    if (o.apply) {
        const applied = applyPlan(root, String(o.expect), rebuild);
        return { outcome: applied.outcome, data: { object: applied.plan.object, expect: planToken(applied.plan), operationId: applied.operationId }, changes: applied.changes, warnings: applied.plan.warnings ?? [] };
    }
    const plan = rebuild();
    return { outcome: "preview", data: { object: plan.object, expect: planToken(plan), author: o.author === true, notice: "预览没有写文件；--apply 只选择应用，不替代用户授权。" }, changes: plan.changes, warnings: plan.warnings ?? [] };
}
