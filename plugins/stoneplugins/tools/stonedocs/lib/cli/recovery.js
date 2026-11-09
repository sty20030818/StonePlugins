import { OperationError } from "../files/write.js";
/** 恢复沿用原操作资格，不以当前 flag 为缺失或损坏的历史请求猜默认值。 */
export function validateRecoveryAuthor(request, author) {
    const prior = request && typeof request === "object" && !Array.isArray(request) ? request : null;
    if (!prior || !Object.hasOwn(prior, "author") || typeof prior.author !== "boolean") {
        throw new OperationError({ code: "OPERATION_CORRUPT", message: "原操作请求的作者模式缺失或类型无效，不能猜测恢复。", path: ".stonedocs-operation/journal.json", remedy: "保留操作材料，核对原请求和来源；不以当前参数补造历史模式。" }, 4);
    }
    if (prior.author !== author) {
        throw new OperationError({ code: "OPERATION_MISMATCH", message: "恢复调用与原操作的作者模式不匹配。", path: ".stonedocs-operation/journal.json", remedy: "沿用原作者或采用模式重新调用同一恢复操作，不改写原操作材料。" }, 3);
    }
}
