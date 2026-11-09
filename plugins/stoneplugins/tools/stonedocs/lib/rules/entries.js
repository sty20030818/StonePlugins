import { withoutFences } from "../documents/markdown.js";
import { OperationError } from "../files/write.js";
const OPEN = "<!-- stonedocs:adoption:v1 -->", CLOSE = "<!-- /stonedocs:adoption:v1 -->";
function fail(code, message, file) {
    throw new OperationError({ code, message, path: file, remedy: "保留当前正文，核对采用片段及项目差异；init 不覆盖已改写内容，规范变更须另行明确升级方案。" }, 3);
}
function body(file) {
    switch (file) {
        case "AGENTS.md": return ["## 文档工作流", "", "规范来源与管理范围见[采用记录](docs/.stonedocs.json)；本项目额外约束由本文件其它章节维护。", "", "先读[共同约定](docs/conventions.md)与[对应 SOP](docs/sop/README.md)，按[文档导航](docs/README.md)和[使用路线](docs/guide.md)定位当前资料。已有目标、阶段或任务时，直接读取其唯一计划、任务及相关材料接续。"];
        case "docs/README.md": return ["## 文档工作流入口", "", "[采用记录](.stonedocs.json)说明固定来源和管理范围；项目约束见 [AGENTS.md](../AGENTS.md)。", "", "- [使用路线](guide.md)：选择当前问题的入口和接续路径。", "- [共同约定](conventions.md)：共用模型与文档责任。", "- [SOP](sop/README.md)：各流程的操作和填写结构。", "", "项目业务资料按实际需要建立；本页只提供导航，不另存目标、阶段或任务状态。"];
        case "docs/guide.md": return ["## 使用文档工作流", "", "适用来源见[采用记录](.stonedocs.json)，本项目约束与例外见 [AGENTS.md](../AGENTS.md)。共用规则由[共同约定](conventions.md)维护，具体操作和填写结构从 [SOP](sop/README.md)选择。", "", "方向或行为尚未明确时，按需进入 idea、compare、decide、story；目标或阶段已明确时进入 plan、design。已有任务直接读取所属 Goal/Phase 的计划、唯一任务条目和相关材料，通过 task、verify、review 接续实际交付。流程按问题选择，不要求补演前序调用。", "", "工具可用时先读对应 help，再在已有授权内执行；手工 Markdown + Git 路径继续成立。产品方向、计划、实现和验收资料按真实内容建立，本次规范采用不代替项目业务规划。"];
    }
}
/** 入口只拥有本标记中的导航，既有项目正文与换行留给原所有者。 */
export function adoptEntry(file, before) {
    const eol = before?.match(/\r\n|\n|\r/)?.[0] ?? "\n";
    const expected = [OPEN, ...body(file), CLOSE].join(eol);
    if (before === null)
        return "# " + ({ "AGENTS.md": "项目协作入口", "docs/README.md": "文档导航", "docs/guide.md": "文档使用路线" }[file]) + eol + eol + expected + eol;
    const clean = withoutFences(before).clean;
    const candidates = [...clean.matchAll(/^ {0,3}<!--[ \t]*\/?[ \t]*stonedocs:adoption\b[^\r\n]*$/gm)];
    if (!candidates.length)
        return before + (before.endsWith(eol + eol) ? "" : before.endsWith(eol) ? eol : eol + eol) + expected + eol;
    if (candidates.length !== 2 || candidates[0][0] !== OPEN || candidates[1][0] !== CLOSE)
        fail("INIT_ENTRY_INVALID", "采用片段重复、损坏或版本未知，不能猜测覆盖范围。", file);
    const raw = before.slice(candidates[0].index, candidates[1].index + CLOSE.length);
    const blockEol = raw.match(/\r\n|\n|\r/)?.[0] ?? eol;
    if (raw !== [OPEN, ...body(file), CLOSE].join(blockEol))
        fail("INIT_CONTENT_CONFLICT", "已有采用片段内容已改写，init 不替换项目差异。", file);
    return before;
}
