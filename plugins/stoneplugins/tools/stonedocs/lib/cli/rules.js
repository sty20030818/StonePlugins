import path from "node:path";
import { UsageError } from "./commands.js";
import { planInit } from "../workflow/init.js";
import { planUpgrade } from "../workflow/upgrade.js";
import { applyPlan, assertOperationReady, OperationError, planToken, recoverPlan } from "../files/write.js";
export function validateRulesOptions(call) {
    const o = call.options, command = call.definition.path;
    if (typeof o.project !== "string")
        throw new UsageError(command + " 需要显式 --project，目标目录须已存在。");
    if (o.resume || o.rollback) {
        if (o.resume && o.rollback)
            throw new UsageError("--resume 与 --rollback 不能同时使用。");
        if (["from", "rules", "apply", "expect", "dry-run"].some((key) => Object.hasOwn(o, key)))
            throw new UsageError(command + " 恢复只带 --project、--resume 或 --rollback 和可选 --json，不重新提供规范包或采用参数。");
        return;
    }
    if (typeof o.rules !== "string")
        throw new UsageError(command + " 需要 --rules <固定规范包目录>；不从作者目录或 latest 猜来源。");
    if (command === "upgrade" && typeof o.from !== "string")
        throw new UsageError("upgrade 需要 --from <旧固定规范包目录>；不从当前文件或 latest 猜旧基线。");
    if (o.apply && o["dry-run"])
        throw new UsageError("--apply 与 --dry-run 不能同时使用。");
    if (Boolean(o.apply) !== Boolean(o.expect))
        throw new UsageError("应用需同时提供 --apply 与对应 --expect，预览不接受 --expect。");
}
export function executeRules(root, call) {
    validateRulesOptions(call);
    const o = call.options;
    if (o.resume || o.rollback) {
        const result = recoverPlan(root, String(o.resume ?? o.rollback), o.resume ? "continue" : "rollback", call.definition.path);
        return { outcome: result.outcome, data: { object: result.plan.object, operationId: result.operationId, recovery: o.resume ? "continue" : "rollback" }, changes: result.changes, warnings: result.plan.warnings ?? [] };
    }
    assertOperationReady(root);
    const bundle = path.resolve(String(o.rules));
    const old = typeof o.from === "string" ? path.resolve(o.from) : undefined;
    const proposal = () => call.definition.path === "upgrade"
        ? planUpgrade(root, old, bundle)
        : { plan: planInit(root, bundle) };
    const initial = proposal(), plan = initial.plan, expect = planToken(plan);
    const context = "comparisons" in initial ? { comparisons: initial.comparisons, mode: initial.mode, sources: initial.sources } : {};
    const rebuild = () => proposal().plan;
    if (o.apply && String(o.expect) !== expect)
        throw new OperationError({ code: "PREVIEW_CHANGED", message: "输入或项目内容已变化，旧规范预览不能应用。", path: "preview", remedy: "保留当前内容，重新盘点并生成预览。" }, 3);
    if (!plan.changes.length)
        return { outcome: "unchanged", data: { object: plan.object, expect, request: plan.request, ...context }, changes: [], warnings: plan.warnings ?? [] };
    if (!o.apply)
        return { outcome: "preview", data: { object: plan.object, expect, request: plan.request, ...context, notice: "预览未写文件；采用应用需 --apply --expect，不能替代用户授权。" }, changes: plan.changes, warnings: plan.warnings ?? [] };
    const result = applyPlan(root, String(o.expect), rebuild);
    return { outcome: result.outcome, data: { object: result.plan.object, expect: planToken(result.plan), operationId: result.operationId, request: result.plan.request, ...context }, changes: result.changes, warnings: result.plan.warnings ?? [] };
}
