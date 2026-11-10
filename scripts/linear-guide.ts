import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";

export const LINEAR_GUIDE_REPOSITORY = "https://github.com/sty20030818/StoneDocs";
export const LINEAR_GUIDE_PATH = "docs/linear.md";
const PREFIX = "<!-- stonedocs:linear-guide:v1 ";
const SUFFIX = " -->";

export interface LinearGuideSource {
  repository: typeof LINEAR_GUIDE_REPOSITORY;
  revision: string;
  state: "commit" | "working-tree";
  path: typeof LINEAR_GUIDE_PATH;
}

export interface LinearGuide {
  source: LinearGuideSource;
  sha256: string;
  body: Buffer;
  raw: Buffer;
}

function exactObject(value: unknown, fields: string[], label: string): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label}必须是对象`);
  assert.deepEqual(Object.keys(value).sort(), [...fields].sort(), `${label}字段不符合固定格式`);
  return value as Record<string, unknown>;
}

function sourceRecord(value: unknown): LinearGuideSource {
  const source = exactObject(value, ["repository", "revision", "state", "path"], "Linear 指南来源");
  assert.equal(source.repository, LINEAR_GUIDE_REPOSITORY, "Linear 指南必须来自 StoneDocs 作者源");
  assert.equal(source.path, LINEAR_GUIDE_PATH, "Linear 指南来源路径不符合约定");
  assert.ok(typeof source.revision === "string" && /^[a-f\d]{40}$/.test(source.revision), "Linear 指南须记录完整提交身份");
  assert.ok(source.state === "commit" || source.state === "working-tree", "Linear 指南来源状态无效");
  return source as unknown as LinearGuideSource;
}

function bodyHash(body: Buffer): string {
  assert.ok(body.length && body.toString("utf8").trim(), "Linear 指南正文不得为空");
  assert.ok(Buffer.from(body.toString("utf8"), "utf8").equals(body) && !body.includes(0), "Linear 指南须为 UTF-8 文本");
  return createHash("sha256").update(body).digest("hex");
}

/** 来源头在正文之外，摘要覆盖原正文的全部字节，不改写换行或链接。 */
export function encodeLinearGuide(body: Buffer, source: LinearGuideSource): Buffer {
  const metadata = { schemaVersion: 1, source: sourceRecord(source), sha256: bodyHash(body) };
  return Buffer.concat([Buffer.from(`${PREFIX}${JSON.stringify(metadata)}${SUFFIX}\n`, "utf8"), body]);
}

/** 单文件固定快照校验；摘要不代替发布、来源认证或实际连接器验证。 */
export function readLinearGuide(file: string, options: { release?: boolean } = {}): LinearGuide {
  const stat = lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), "Linear 指南必须为普通文件，不能是软链接或目录");
  const raw = readFileSync(file);
  const newline = raw.indexOf(10);
  assert.ok(newline >= 0, "Linear 指南缺少单行来源头");
  const header = raw.subarray(0, newline).toString("utf8");
  assert.ok(header.startsWith(PREFIX) && header.endsWith(SUFFIX), "Linear 指南缺少受支持的来源头");
  let parsed: unknown;
  try { parsed = JSON.parse(header.slice(PREFIX.length, -SUFFIX.length)); }
  catch { assert.fail("Linear 指南来源头不是有效 JSON"); }
  const metadata = exactObject(parsed, ["schemaVersion", "source", "sha256"], "Linear 指南来源头");
  assert.equal(metadata.schemaVersion, 1, "不支持此 Linear 指南格式");
  const source = sourceRecord(metadata.source);
  assert.ok(typeof metadata.sha256 === "string" && /^[a-f\d]{64}$/.test(metadata.sha256), "Linear 指南摘要格式无效");
  const body = raw.subarray(newline + 1);
  assert.equal(bodyHash(body), metadata.sha256, "Linear 指南正文摘要不匹配，保留本地修改并重新核对来源");
  assert.ok(!options.release || source.state === "commit", "Linear 指南仍为 working-tree 候选，不能作为正式来源发布");
  return { source, sha256: metadata.sha256, body, raw };
}
