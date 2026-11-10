import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs, { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { importLinearGuide } from "../scripts/import-linear-guide.ts";
import { encodeLinearGuide, LINEAR_GUIDE_PATH, LINEAR_GUIDE_REPOSITORY, readLinearGuide } from "../scripts/linear-guide.ts";

function fixture(t: TestContext) {
  const temporary = mkdtempSync(path.join(tmpdir(), "stoneplugins-linear-guide-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, "source with spaces");
  mkdirSync(path.join(source, "docs"), { recursive: true });
  const body = Buffer.from("# Linear 操作\r\n\r\n[Official](https://linear.app/docs/documents)\r\n", "utf8");
  const sourceFile = path.join(source, LINEAR_GUIDE_PATH);
  writeFileSync(sourceFile, body);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: source, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  git("config", "core.autocrlf", "false");
  const commit = () => {
    git("add", "--", LINEAR_GUIDE_PATH);
    git("-c", "user.name=Linear fixture", "-c", "user.email=fixture@example.invalid", "commit", "--no-gpg-sign", "-qm", "fixture");
    return git("rev-parse", "HEAD").trim();
  };
  const revision = commit();
  const target = path.join(temporary, "installed plugin", "references", "linear.md");
  return { temporary, source, sourceFile, body, revision, commit, target };
}

test("固定提交的单文件导入保留原字节，独立安装后无需作者目录", (t) => {
  const { source, sourceFile, body, revision, target } = fixture(t);
  writeFileSync(sourceFile, "# 尚未提交的新内容\n");
  const imported = importLinearGuide(source, revision, target);
  assert.equal(imported.source.state, "commit");
  assert.deepEqual(imported.body, body);
  assert.equal(imported.source.revision, revision);
  assert.equal(readFileSync(sourceFile, "utf8"), "# 尚未提交的新内容\n");
  rmSync(source, { recursive: true });
  assert.deepEqual(readLinearGuide(target, { release: true }).body, body);
});

test("工作树来源锚定真实 HEAD，候选可消费但不能作为正式来源发布", (t) => {
  const { source, sourceFile, revision, target } = fixture(t);
  const edited = Buffer.from("# 工作树候选\n\n新内容。\n");
  writeFileSync(sourceFile, edited);
  const guide = importLinearGuide(source, revision, target, { workingTree: true });
  assert.equal(guide.source.state, "working-tree");
  assert.deepEqual(guide.body, edited);
  assert.throws(() => readLinearGuide(target, { release: true }), /候选|working-tree/);
});

test("工作树 HEAD 不匹配和不存在提交均不能覆盖既有副本", (t) => {
  const { source, sourceFile, revision, commit, target } = fixture(t);
  importLinearGuide(source, revision, target);
  const original = readFileSync(target);
  writeFileSync(sourceFile, "# 下一版本\n");
  commit();
  assert.throws(() => importLinearGuide(source, revision, target, { workingTree: true, replace: true }), /HEAD/);
  assert.throws(() => importLinearGuide(source, "0".repeat(40), target, { replace: true }));
  assert.deepEqual(readFileSync(target), original);
});

test("来源、格式或正文损坏均拒绝；不能将未知内容当作可覆盖固定副本", (t) => {
  const { source, revision, target } = fixture(t);
  importLinearGuide(source, revision, target);
  const original = readFileSync(target, "utf8");
  for (const damaged of [
    original.replace("<!-- stonedocs:linear-guide:v1 ", "<!-- stonedocs:linear-guide:v9 "),
    original.replace('"schemaVersion":1', '"schemaVersion":2'),
    original.replace(LINEAR_GUIDE_REPOSITORY, "https://example.com/other"),
    original.replace('"path":"docs/linear.md"', '"path":"docs/other.md"'),
    original.replace(`"revision":"${revision}"`, '"revision":"main"'),
    original.replace('"state":"commit"', '"state":"latest"'),
    original.replace('"schemaVersion":1', '"schemaVersion":1,"unknown":true'),
    original + "\n人工补充，尚未回作者源。\n",
    "# 未声明来源\n",
  ]) {
    writeFileSync(target, damaged);
    assert.throws(() => readLinearGuide(target));
    assert.throws(() => importLinearGuide(source, revision, target, { replace: true }));
    assert.equal(readFileSync(target, "utf8"), damaged);
  }
});

test("只有显式 replace 能更新已校验副本，正文与采用版本由读回确认", (t) => {
  const { source, sourceFile, revision, commit, target } = fixture(t);
  importLinearGuide(source, revision, target);
  const before = readFileSync(target);
  writeFileSync(sourceFile, "# 已提交的新指南\n");
  const next = commit();
  assert.throws(() => importLinearGuide(source, next, target), /--replace/);
  assert.deepEqual(readFileSync(target), before);
  const updated = importLinearGuide(source, next, target, { replace: true });
  assert.equal(updated.source.revision, next);
  assert.equal(readLinearGuide(target).body.toString("utf8"), "# 已提交的新指南\n");
});

test("目标和工作树来源软链接均被拒绝，未知路径内容保留", (t) => {
  const { source, sourceFile, body, revision, target, temporary } = fixture(t);
  const elsewhere = path.join(temporary, "manual.md");
  writeFileSync(elsewhere, "不能覆盖\n");
  mkdirSync(path.dirname(target), { recursive: true });
  symlinkSync(elsewhere, target);
  assert.throws(() => importLinearGuide(source, revision, target, { replace: true }), /普通文件/);
  assert.equal(readFileSync(elsewhere, "utf8"), "不能覆盖\n");
  rmSync(target);
  rmSync(sourceFile);
  writeFileSync(elsewhere, body);
  symlinkSync(elsewhere, sourceFile);
  assert.throws(() => importLinearGuide(source, revision, target, { workingTree: true }), /普通文件/);
  assert.equal(existsSync(target), false);
});

test("替换准备期间的后续人工修改保持，不被候选覆盖", (t) => {
  const { source, sourceFile, revision, commit, target } = fixture(t);
  importLinearGuide(source, revision, target);
  writeFileSync(sourceFile, "# 新指南\n");
  const next = commit();
  const originalWrite = fs.writeFileSync;
  let injected = false;
  Object.defineProperty(fs, "writeFileSync", { value: (...args: Parameters<typeof fs.writeFileSync>) => {
    originalWrite(...args);
    if (String(args[0]).includes(`${path.sep}.linear-guide-import-`)) {
      originalWrite(target, "# concurrent-user-edit\n");
      injected = true;
    }
  } });
  syncBuiltinESMExports();
  try { assert.throws(() => importLinearGuide(source, next, target, { replace: true }), /后续修改/); }
  finally { Object.defineProperty(fs, "writeFileSync", { value: originalWrite }); syncBuiltinESMExports(); }
  assert.equal(injected, true);
  assert.equal(readFileSync(target, "utf8"), "# concurrent-user-edit\n");
  assert.equal(readdirSync(path.dirname(target)).some((name) => name.startsWith(".linear-guide-import-")), false);
});

test("正文必须是有效非空 UTF-8，不将二进制或空文件封为指南", () => {
  const source = { repository: LINEAR_GUIDE_REPOSITORY, revision: "a".repeat(40), state: "commit", path: LINEAR_GUIDE_PATH } as const;
  for (const invalid of [Buffer.alloc(0), Buffer.from(" \n"), Buffer.from([0xff]), Buffer.from("abc\0def")]) {
    assert.throws(() => encodeLinearGuide(invalid, source));
  }
});


test("工作树指南不得经过软链接 docs 目录，未知外部正文不被打包", (t) => {
  const { source, sourceFile, revision, target, temporary } = fixture(t);
  const elsewhere = path.join(temporary, "external docs");
  mkdirSync(elsewhere);
  writeFileSync(path.join(elsewhere, "linear.md"), "# 外部内容\n");
  rmSync(path.dirname(sourceFile), { recursive: true });
  symlinkSync(elsewhere, path.join(source, "docs"));
  assert.throws(() => importLinearGuide(source, revision, target, { workingTree: true }), /普通目录/);
  assert.equal(existsSync(target), false);
  assert.equal(readFileSync(path.join(elsewhere, "linear.md"), "utf8"), "# 外部内容\n");
});
