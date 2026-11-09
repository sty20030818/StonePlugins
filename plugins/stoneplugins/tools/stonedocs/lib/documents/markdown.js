export const STATES = new Set(["todo", "doing", "done", "cancelled"]);
const INLINE_LINK = /(!?)\[[^\]\n]*\]\(\s*(?:<([^>\n]*)>|((?:\\.|[^\s()\\]|\([^()]*\))*))(?:\s+["'][^\n]*?["'])?\s*\)/g;
const TASK_HEADING = /^(#{1,6})[ \t]+(T\d+)[ \t]*·[ \t]*(.*?)[ \t]*$/gm;
export function withoutFences(text) {
    let opening;
    const pieces = [];
    for (const match of text.matchAll(/([^\r\n]*)(\r\n|\n|\r|$)/g)) {
        const line = match[1];
        const ending = match[2] === "\r" ? "\n" : match[2];
        let masked = false;
        if (opening) {
            if (new RegExp("^ {0,3}" + opening.marker + "{" + opening.length + ",}\\s*$").test(line))
                opening = undefined;
            masked = true;
        }
        else {
            const fence = line.match(/^ {0,3}(\x60{3,}|~{3,})(.*)$/);
            if (fence && !(fence[1][0] === "\x60" && fence[2].includes("\x60"))) {
                opening = { marker: fence[1][0], length: fence[1].length };
                masked = true;
            }
        }
        pieces.push((masked ? " ".repeat(line.length) : line) + ending);
    }
    return { clean: pieces.join(""), unclosed: opening !== undefined };
}
export function anchors(text) {
    const { clean } = withoutFences(withoutFrontmatter(text));
    const found = new Set([...clean.matchAll(/<a\s+[^>]*(?:id|name)=["']([^"']+)/g)].map((match) => match[1]));
    const counts = new Map();
    for (const match of clean.matchAll(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)) {
        const title = match[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]*>/g, "").trim().toLowerCase();
        const slug = [...title].filter((character) => " -_".includes(character) || !/[\p{P}\p{S}\p{C}]/u.test(character)).join("").replace(/\s/g, "-");
        const count = counts.get(slug) ?? 0;
        found.add(slug + (count ? "-" + count : ""));
        counts.set(slug, count + 1);
    }
    return found;
}
function label(text) {
    return text.toLowerCase().trim().split(/\s+/).join(" ");
}
function maskRanges(text, ranges) {
    const characters = text.split("");
    for (const [start, end] of ranges)
        characters.fill(" ", start, end);
    return characters.join("");
}
export function markdownLinks(content) {
    const definitions = new Map();
    const clean = content.replace(/(\x60+)(.*?)\1/g, "").split("\n").map((line) => {
        const match = line.match(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/);
        if (match && !match[1].startsWith("^")) {
            definitions.set(label(match[1]), match[2] ?? match[3]);
            return "";
        }
        return line;
    }).join("\n");
    const links = [];
    const covered = [];
    for (const match of clean.matchAll(INLINE_LINK)) {
        links.push({ target: match[2] ?? match[3], image: !!match[1] });
        covered.push([match.index, match.index + match[0].length]);
    }
    const remaining = maskRanges(clean, covered);
    const references = [];
    for (const match of remaining.matchAll(/(!?)\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
        links.push({ target: definitions.get(label(match[3] || match[2])), image: !!match[1] });
        references.push([match.index, match.index + match[0].length]);
    }
    for (const match of maskRanges(remaining, references).matchAll(/(!?)\[([^\]\n]+)\]/g)) {
        const target = definitions.get(label(match[2]));
        if (target !== undefined)
            links.push({ target, image: !!match[1] });
    }
    return links;
}
/** 与 URL unquote 一样保留无效百分号，非法 UTF-8 字节以替代字符解码。 */
export function unquote(text) {
    return text.replace(/(?:%[a-f\d]{2})+/gi, (encoded) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(Uint8Array.from(encoded.match(/%([a-f\d]{2})/gi), (byte) => Number.parseInt(byte.slice(1), 16))));
}
export function localUrl(target) {
    const stripped = target.replace(/^[\u0000-\u0020]+/, "").replace(/[\r\n\t]/g, "");
    const hash = stripped.indexOf("#");
    const beforeHash = hash < 0 ? stripped : stripped.slice(0, hash);
    const fragment = hash < 0 ? "" : stripped.slice(hash + 1);
    const query = beforeHash.indexOf("?");
    return { pathname: query < 0 ? beforeHash : beforeHash.slice(0, query), fragment };
}
function frontmatter(text) {
    const lines = [...text.matchAll(/([^\r\n]*)(\r\n|\n|\r|$)/g)];
    if (lines[0]?.[1]?.replace(/^\uFEFF+/, "").trim() !== "---")
        return null;
    const closing = lines.findIndex((line, index) => index > 0 && line[1].trim() === "---");
    if (closing < 0)
        return null;
    const last = lines[closing];
    return { lines: lines.slice(1, closing).map((line) => line[1]), end: last.index + last[0].length };
}
/** 元数据不属于正文结构；等长遮罩保留原文区间和换行位置。 */
export function withoutFrontmatter(text) {
    const header = frontmatter(text);
    return header ? text.slice(0, header.end).replace(/[^\r\n]/g, " ") + text.slice(header.end) : text;
}
export function documentTitle(text) {
    const header = frontmatter(text);
    const body = (header ? text.slice(header.end) : text).replace(/^\uFEFF+/, "");
    const clean = withoutFences(body).clean;
    for (const match of clean.matchAll(/^ {0,3}#[ \t]+([^\r\n]*?)(?:[ \t]+#+)?[ \t]*$/gm)) {
        const title = match[1].trim();
        if (title)
            return title;
    }
    return "";
}
export function metadata(text) {
    const header = frontmatter(text);
    if (!header)
        return null;
    const values = new Map();
    for (const line of header.lines) {
        const match = line.match(/^([A-Za-z_][\p{L}\p{N}_-]*):\s*(.*?)\s*$/u);
        if (!match)
            continue;
        let value = match[2].replace(/\s+#.*$/, "").trim();
        if (value.length >= 2 && value[0] === value.at(-1) && "\"'".includes(value[0]))
            value = value.slice(1, -1);
        values.set(match[1], [...values.get(match[1]) ?? [], value]);
    }
    return values;
}
export function lineAt(text, offset) {
    const position = offset > 0 && text[offset] === "\n" && text[offset - 1] === "\r" ? offset - 1 : offset;
    return (text.slice(0, Math.max(0, position)).match(/\r\n|[\n\r]/g)?.length ?? 0) + 1;
}
export function parseTaskSections(text) {
    const { clean } = withoutFences(text);
    const headings = [...clean.matchAll(/^#{1,6}[ \t]+.*$/gm)];
    return [...clean.matchAll(TASK_HEADING)].map((match) => {
        const end = headings.find((heading) => heading.index > match.index && heading[0].split(/\s+/)[0].length <= 2)?.index ?? text.length;
        const section = clean.slice(match.index + match[0].length, end);
        return {
            id: match[2], title: match[3].trim(), level: match[1].length,
            start: match.index, end, lineStart: lineAt(text, match.index), lineEnd: lineAt(text, Math.max(match.index, end - 1)),
            raw: text.slice(match.index, end),
            statuses: [...section.matchAll(/^-[ \t]+状态[ \t]*[：:][ \t]*(.*?)[ \t]*$/gm)].map((entry) => entry[1]),
            criteria: [...section.matchAll(/^-[ \t]+完成条件[ \t]*[：:][ \t]*(.*?)[ \t]*$/gm)].map((entry) => entry[1]),
        };
    });
}
