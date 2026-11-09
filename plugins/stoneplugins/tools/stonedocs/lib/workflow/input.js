import { invalidInput as invalid, inputObject, inputText as text, inputStrings as strings } from "./json.js";
export const CREATE_INPUTS = {
    goal: {
        required: ["schemaVersion", "id", "title", "scope", "criteria"],
        properties: { schemaVersion: "固定整数 1", id: "Goal 英文标识，与小写目录一致", title: "非空单行成果名", scope: "非空 Markdown 范围及成果说明", criteria: "非空单行字符串数组，整体完成条件" },
        example: { schemaVersion: 1, id: "V2", title: "下一产品目标", scope: "希望交付的成果与范围。", criteria: ["整体结果可实际验收。"] },
    },
    phase: {
        required: ["schemaVersion", "slug", "title", "scope", "criteria", "contribution"],
        properties: { schemaVersion: "固定整数 1", id: "可选 P 加数字，省略按项目全局分配", slug: "英文小写、数字及连字符组成的成果路径", title: "非空单行阶段成果名", scope: "非空 Markdown 阶段范围", criteria: "非空单行字符串数组，阶段退出条件", contribution: "非空单行，对所属 Goal 的贡献" },
        example: { schemaVersion: 1, slug: "usable-result", title: "可使用成果", scope: "本阶段交付范围。", criteria: ["成果可独立验收。"], contribution: "对整体目标提供可用成果" },
    },
    task: {
        required: ["schemaVersion", "title", "deliverable", "criteria"],
        properties: { schemaVersion: "固定整数 1", id: "可选 T 加数字，省略按项目全局分配", title: "非空单行可验收成果名", deliverable: "非空单行交付物", criteria: "非空单行字符串数组，写为唯一完成条件", materials: "可选非空单行材料字符串数组，引用按任务文件位置解释", dependencies: "可选非空单行实际依赖" },
        example: { schemaVersion: 1, title: "交付一个结果", deliverable: "明确的可审查产物。", criteria: ["取得必要行为结果。"] },
    },
};
export function validateCreateInput(kind, value) {
    const definition = CREATE_INPUTS[kind];
    const input = inputObject(value, Object.keys(definition.properties), definition.required);
    const checked = { schemaVersion: 1, title: text(input.title, "title"), criteria: strings(input.criteria, "criteria") };
    if (kind === "goal" || Object.hasOwn(input, "id")) {
        checked.id = text(input.id, "id");
        const pattern = kind === "goal" ? /^[A-Za-z][A-Za-z0-9._-]*$/ : kind === "phase" ? /^P\d+$/ : /^T\d+$/;
        if (!pattern.test(checked.id))
            invalid("id 格式不符合对象类型。");
    }
    if (kind !== "task")
        checked.scope = text(input.scope, "scope", true);
    if (kind === "phase") {
        checked.slug = text(input.slug, "slug");
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(checked.slug))
            invalid("slug 需要英文小写、数字及连字符。");
        checked.contribution = text(input.contribution, "contribution");
    }
    if (kind === "task") {
        checked.deliverable = text(input.deliverable, "deliverable");
        if (input.materials !== undefined)
            checked.materials = strings(input.materials, "materials");
        if (input.dependencies !== undefined)
            checked.dependencies = text(input.dependencies, "dependencies");
    }
    return checked;
}
