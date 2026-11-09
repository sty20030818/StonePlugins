import { isSemVer } from "../version.js";
import { lineAt, withoutFences, withoutFrontmatter } from "../documents/markdown.js";
import { referenceLink } from "./context.js";
import { inputObject, inputStrings, inputText, invalidInput } from "./json.js";
export const RELEASE_INPUTS = {
    plan: {
        required: ["schemaVersion", "version", "includes", "criteria"],
        properties: { schemaVersion: "固定整数1", version: "显式SemVer；可选v/V前缀，保留预发布和build标识大小写", includes: "非空项目根相对成果引用数组，可带anchor", criteria: "非空单行放行条件数组，引用已有标准并仅补组合要求" },
        example: { schemaVersion: 1, version: "0.1.0-beta.1", includes: ["docs/goals/v1/phases/p001-base/plan.md"], criteria: ["核对所选成果的有效验收结果。"] },
    },
    record: {
        required: ["schemaVersion", "version", "date", "scope", "artifacts", "evidence", "limits"],
        properties: { schemaVersion: "固定整数1", version: "显式实际发布SemVer，不由Goal或Phase推断", date: "明确实际日期YYYY-MM-DD", scope: "非空实际范围的项目根相对引用数组", artifacts: "非空实际产物引用，本地文件或无凭据HTTPS链接", evidence: "适用证据引用数组，本地或HTTPS；没有附加材料时明确[]", limits: "已知限制字符串数组，没有补充时明确[]" },
        example: { schemaVersion: 1, version: "0.1.0-beta.1", date: "2026-11-09", scope: ["docs/goals/v1/phases/p001-base/plan.md"], artifacts: ["https://example.com/releases/0.1.0-beta.1"], evidence: [], limits: ["仅已验证的平台。"] },
    },
};
export function canonicalReleaseVersion(value) {
    const version = inputText(value, "version");
    if (version !== value)
        invalidInput("version 不接受首尾空白。");
    const canonical = version.replace(/^[vV]/, "");
    if (!isSemVer(canonical))
        invalidInput("version 需要严格SemVer，不接受Goal标识、路径或数字前导零。");
    return canonical;
}
function externalUrl(ref) {
    if (!/^https:\/\//i.test(ref) || /[\u0000-\u0020\u007f\\]/.test(ref))
        invalidInput("发布外链必须是无凭据的完整HTTPS URL。");
    let url;
    try {
        url = new URL(ref);
    }
    catch {
        return invalidInput("发布外链不是有效HTTPS URL。");
    }
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname)
        invalidInput("发布外链不接受凭据或其它协议。");
    const credential = /^(?:access[_-]?token|token|authorization|api[_-]?key|password|passwd|secret|signature|sig|x-amz-(?:credential|signature|security-token)|x-goog-(?:credential|signature)|key-pair-id|policy)$/i;
    const fragment = url.hash.slice(1), routeQuery = fragment.includes("?") ? fragment.slice(fragment.indexOf("?") + 1) : "";
    const keys = [...url.searchParams.keys(), ...new URLSearchParams(fragment).keys(), ...new URLSearchParams(routeQuery).keys()];
    if (keys.some((key) => credential.test(key)))
        invalidInput("发布外链不接受令牌、签名或凭据查询/片段，请使用可公开分享的稳定地址。");
    return url.href.replaceAll("<", "%3C").replaceAll(">", "%3E");
}
export function releaseReferenceKind(ref) {
    const value = inputText(ref, "发布引用");
    if (value !== ref)
        invalidInput("发布引用不接受首尾空白。");
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) {
        externalUrl(ref);
        return "https";
    }
    referenceLink("docs/releases.md", ref);
    return "local";
}
function references(value, name, allowEmpty = false, allowHttps = false) {
    return inputStrings(value, name, allowEmpty).map((ref) => {
        const kind = releaseReferenceKind(ref);
        if (kind === "https" && !allowHttps)
            invalidInput(name + " 必须引用本项目成果，不接受外部链接。");
        return kind === "https" ? externalUrl(ref) : ref;
    });
}
export function validateReleasePlan(value) {
    const fields = RELEASE_INPUTS.plan.required, input = inputObject(value, fields, fields);
    return { schemaVersion: 1, version: canonicalReleaseVersion(input.version), includes: references(input.includes, "includes"), criteria: inputStrings(input.criteria, "criteria") };
}
export function validateReleaseRecord(value) {
    const fields = RELEASE_INPUTS.record.required, input = inputObject(value, fields, fields), date = inputText(input.date, "date");
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + "T00:00:00Z") : null;
    if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
        invalidInput("date 必须是真实日历日期YYYY-MM-DD。");
    return { schemaVersion: 1, version: canonicalReleaseVersion(input.version), date, scope: references(input.scope, "scope"), artifacts: references(input.artifacts, "artifacts", false, true), evidence: references(input.evidence, "evidence", true, true), limits: inputStrings(input.limits, "limits", true) };
}
export function releaseAnchor(kind, version) { return "release-" + kind + "-" + canonicalReleaseVersion(version); }
const normalize = (raw) => raw.replace(/\r\n|\r/g, "\n");
function literal(values) {
    const text = values.join("\n"), maximum = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length)), fence = "`".repeat(maximum + 1);
    return "  " + fence + "text\n" + (text ? text.split("\n").map((line) => "  " + line).join("\n") + "\n" : "") + "  " + fence;
}
function linked(file, refs) { return refs.length ? refs.map((ref) => "  - " + (releaseReferenceKind(ref) === "https" ? "<" + externalUrl(ref) + ">" : referenceLink(file, ref))).join("\n") : "  无。"; }
const close = (kind) => "<!-- /stonedocs:release-" + kind + ":v1 -->";
function opening(kind, version) { return ["<!-- stonedocs:release-" + kind + ":v1 " + version + " -->", '<a id="' + releaseAnchor(kind, version) + '"></a>']; }
export function renderReleasePlan(file, value) {
    const input = validateReleasePlan(value);
    return [...opening("plan", input.version), "### " + input.version + " 发布意图", "", "- 选入成果：", "", linked(file, input.includes), "", "- 放行条件：", "", literal(input.criteria), close("plan")].join("\n");
}
export function renderReleaseRecord(file, value) {
    const input = validateReleaseRecord(value);
    return [...opening("record", input.version), "## " + input.version + " · " + input.date, "", "- 实际范围：", "", linked(file, input.scope), "", "- 实际产物：", "", linked(file, input.artifacts), "", "- 适用证据：", "", linked(file, input.evidence), "", "- 已知限制：", "", literal(input.limits), close("record")].join("\n");
}
function parseLiteral(lines, cursor) {
    const opening = /^  (`{3,})text$/.exec(lines[cursor.index++] ?? "");
    if (!opening)
        throw new Error("文字围栏缺失");
    const values = [];
    while (cursor.index < lines.length && lines[cursor.index] !== "  " + opening[1]) {
        const line = lines[cursor.index++];
        if (!line.startsWith("  "))
            throw new Error("文字围栏内容未隔离");
        values.push(line.slice(2));
    }
    if (lines[cursor.index++] !== "  " + opening[1])
        throw new Error("文字围栏不完整");
    return values;
}
function parseLinks(lines, cursor) {
    if (lines[cursor.index] === "  无。") {
        cursor.index++;
        return [];
    }
    const values = [];
    while (lines[cursor.index]?.startsWith("  - ")) {
        const line = lines[cursor.index++], external = /^  - <(https:\/\/[^>]*)>$/.exec(line);
        if (external) {
            values.push(external[1]);
            continue;
        }
        const local = /^  - \[((?:\\.|[^\]])*)\]\([^)]+\)$/.exec(line);
        if (!local)
            throw new Error("引用格式无效");
        values.push(local[1].replace(/\\([\\\[\]`])/g, "$1").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"));
    }
    if (!values.length)
        throw new Error("引用数组缺失");
    return values;
}
function parseBlock(kind, file, raw) {
    const lines = normalize(raw).split("\n"), versionLine = lines[0], header = lines[2];
    const version = canonicalReleaseVersion(/^<!-- stonedocs:release-(?:plan|record):v1 (\S+) -->$/.exec(versionLine)?.[1]);
    const cursor = { index: 4 };
    const field = (label, read) => { if (lines[cursor.index++] !== "- " + label + "：" || lines[cursor.index++] !== "")
        throw new Error("字段缺失或顺序不同"); return read(lines, cursor); };
    const next = () => { if (lines[cursor.index++] !== "")
        throw new Error("字段间隔不同"); };
    if (kind === "plan") {
        if (header !== "### " + version + " 发布意图")
            throw new Error("计划标题不符");
        const includes = field("选入成果", parseLinks);
        next();
        const criteria = field("放行条件", parseLiteral);
        const input = validateReleasePlan({ schemaVersion: 1, version, includes, criteria });
        if (renderReleasePlan(file, input) !== normalize(raw))
            throw new Error("计划原文与v1格式不符");
        return input;
    }
    const date = /^## \S+ · (\d{4}-\d{2}-\d{2})$/.exec(header)?.[1];
    if (header !== "## " + version + " · " + date)
        throw new Error("实际标题不符");
    const scope = field("实际范围", parseLinks);
    next();
    const artifacts = field("实际产物", parseLinks);
    next();
    const evidence = field("适用证据", parseLinks);
    next();
    const limits = field("已知限制", parseLiteral);
    const input = validateReleaseRecord({ schemaVersion: 1, version, date, scope, artifacts, evidence, limits });
    if (renderReleaseRecord(file, input) !== normalize(raw))
        throw new Error("实际原文与v1格式不符");
    return input;
}
function issue(code, message, file) { return { code, message, path: file, remedy: "保留原始发布资料，核对版本、唯一所有者与原生格式；未识别内容不代表没有计划或没有发布。" }; }
export function inspectReleaseBlocks(raw, file) {
    const result = { path: file, raw, legacy: raw, plans: [], records: [], warnings: [] }, clean = withoutFences(withoutFrontmatter(raw)).clean;
    const markers = [...clean.matchAll(/^ {0,3}<!--[ \t]*\/?[ \t]*stonedocs:release[^\r\n]*$/gm)], ranges = [], seen = new Set();
    for (let index = 0; index < markers.length; index++) {
        const start = markers[index], match = /^<!-- stonedocs:release-(plan|record):v1 (\S+) -->$/.exec(start[0]), end = markers[index + 1];
        if (!match || !end || end[0] !== close(match[1])) {
            result.warnings.push(issue("RELEASE_FORMAT_INVALID", "原生发布边界缺失、版本未知、交叉或重复；保留原文。", file));
            continue;
        }
        index++;
        const kind = match[1], finish = end.index + end[0].length, original = raw.slice(start.index, finish);
        try {
            const input = parseBlock(kind, file, original), key = kind + ":" + input.version;
            if (seen.has(key))
                result.warnings.push(issue("RELEASE_VERSION_DUPLICATE", "同类发布资料的版本重复：" + input.version, file));
            seen.add(key);
            const position = { path: file, raw: original, anchor: releaseAnchor(kind, input.version), start: start.index, end: finish, lineStart: lineAt(raw, start.index), lineEnd: lineAt(raw, finish - 1) };
            if (kind === "plan")
                result.plans.push({ ...input, ...position, kind });
            else
                result.records.push({ ...input, ...position, kind });
            ranges.push([start.index, finish]);
        }
        catch {
            result.warnings.push(issue("RELEASE_FORMAT_INVALID", "原生发布正文无法按v1识别；保留原文。", file));
        }
    }
    for (const [start, end] of ranges.reverse())
        result.legacy = result.legacy.slice(0, start) + result.legacy.slice(end);
    const anchors = [...clean.matchAll(/<a\s+[^>]*(?:id|name)=["'](release-(?:plan|record)-[^"']+)["']/g)].map((match) => match[1]);
    if (new Set(anchors).size !== anchors.length)
        result.warnings.push(issue("RELEASE_ANCHOR_DUPLICATE", "发布稳定anchor重复，不能保证唯一定位。", file));
    if (result.legacy.trim())
        result.warnings.push(issue("RELEASE_LEGACY_CONTENT", "存在未结构化原文，不能据此认定未计划或未发布。", file));
    return result;
}
export function containsReleaseVersion(raw, version) {
    const canonical = canonicalReleaseVersion(version).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^0-9A-Za-z.+-])[vV]?" + canonical + "(?=$|[^0-9A-Za-z.+-])").test(withoutFences(withoutFrontmatter(raw)).clean);
}
