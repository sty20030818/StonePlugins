import { UsageError } from "./commands.js";
import { inputLoader } from "./input.js";
import { planLifecycle } from "../workflow/lifecycle.js";
import { planResult } from "../workflow/results.js";
import { planRelease, planReleaseRecord } from "../workflow/releases.js";
import { applyPlan, assertOperationReady, OperationError, planToken, recoverPlan } from "../files/write.js";
export function validateProgressOptions(call) {
    const o = call.options;
    if (typeof o.project !== "string")
        throw new UsageError("写入需要显式 --project；未采用作者项目另需 --author，不猜来源。");
    if (o.resume || o.rollback) {
        if (o.resume && o.rollback)
            throw new UsageError("--resume 与 --rollback 不能同时使用。");
        if (call.argument || ["input", "kind", "goal", "phase", "expect", "dry-run"].some((key) => Object.hasOwn(o, key)))
            throw new UsageError("恢复只使用命令、--resume 或 --rollback、--project、原作者模式及可选 --json，不带 ID、输入或筛选条件。");
        return;
    }
    if (call.definition.inputSchema && typeof o.input !== "string")
        throw new UsageError(call.definition.path + " 需要 --input <JSON 文件或 ->。");
    if (call.definition.action === "result" && typeof o.kind !== "string")
        throw new UsageError("result add 需要 --kind <goal|phase|task>。");
    if (call.definition.action === "release-plan" && Number(Boolean(o.goal)) + Number(Boolean(o.phase)) !== 1)
        throw new UsageError("release plan 需要 --goal 或 --phase 中唯一一项，版本和发布内容通过 --input 提供。");
    if (o.expect && o["dry-run"])
        throw new UsageError("--expect 用于应用指定预览，不能与 --dry-run 同用。");
}
export function executeProgress(root, call) {
    validateProgressOptions(call);
    const o = call.options;
    if (o.resume || o.rollback) {
        const result = recoverPlan(root, String(o.resume ?? o.rollback), o.resume ? "continue" : "rollback", call.definition.path);
        return { outcome: result.outcome, data: { object: result.plan.object, operationId: result.operationId, recovery: o.resume ? "continue" : "rollback" }, changes: result.changes, warnings: result.plan.warnings ?? [] };
    }
    // dry-run 允许只读观察；普通执行即使已成为终态，也不能绕过上次未清理的中断。
    if (!o["dry-run"])
        assertOperationReady(root);
    const load = typeof o.input === "string" ? inputLoader(o.input) : () => undefined;
    const rebuild = () => {
        if (call.definition.action === "release-plan")
            return planRelease(root, typeof o.goal === "string" ? "goal" : "phase", String(o.goal ?? o.phase), load(), o.author === true);
        if (call.definition.action === "release-record")
            return planReleaseRecord(root, load(), o.author === true);
        if (call.definition.action === "result")
            return planResult(root, o.kind, call.argument, load(), o.author === true);
        return planLifecycle(root, call.definition.objectKind, call.argument, call.definition.action, load(), o.author === true);
    };
    const plan = rebuild(), expect = planToken(plan);
    if (o["dry-run"])
        return { outcome: "preview", data: { object: plan.object, expect, author: o.author === true, notice: "只读预览；该动作普通执行会写回事实源，不代替用户授权。" }, changes: plan.changes, warnings: plan.warnings ?? [] };
    if (o.expect && o.expect !== expect)
        throw new OperationError({ code: "CONTENT_CHANGED", message: "当前输入或写入依据已不匹配指定预览。", path: plan.object.path, remedy: "保留现有内容，重新读取并生成预览。" }, 3);
    if (!plan.changes.length)
        return { outcome: "unchanged", data: { object: plan.object, expect }, changes: [], warnings: plan.warnings ?? [] };
    const result = applyPlan(root, String(o.expect ?? expect), rebuild);
    return { outcome: result.outcome, data: { object: result.plan.object, expect: planToken(result.plan), operationId: result.operationId }, changes: result.changes, warnings: result.plan.warnings ?? [] };
}
