import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs, { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { importStoneDocs, main } from "../scripts/import-stonedocs.ts";
import { readPairedArtifact } from "../scripts/validate-document-workflow.ts";

const PACKAGE_ROOT = fileURLToPath(new URL("../plugins/stoneplugins/tools/stonedocs", import.meta.url));
function fixture(t: TestContext) {
  const temporary = mkdtempSync(path.join(tmpdir(), "stoneplugins-import-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, "source package");
  cpSync(PACKAGE_ROOT, source, { recursive: true });
  const plugin = path.join(temporary, "installed plugin");
  mkdirSync(plugin);
  return { temporary, source: realpathSync(source), plugin: realpathSync(plugin), target: path.join(realpathSync(plugin), "tools/stonedocs") };
}
function reseal(root: string) {
  const file = path.join(root, "artifact.json");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  for (const entry of manifest.files) entry.sha256 = createHash("sha256").update(readFileSync(path.join(root, entry.path))).digest("hex");
  writeFileSync(file, JSON.stringify(manifest));
}
function allFiles(root: string): Record<string, string> {
  const entries: Record<string, string> = {};
  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else entries[path.relative(root, file)] = createHash("sha256").update(readFileSync(file)).digest("hex");
    }
  }
  walk(root);
  return entries;
}

test("完整生成包复制到独立安装位置后 CLI 可运行，输入包逐字不变", (t) => {
  const { source, plugin, target, temporary } = fixture(t);
  const before = allFiles(source);
  importStoneDocs(source, plugin);
  assert.deepEqual(allFiles(source), before);
  assert.deepEqual(allFiles(target), before);
  const output = JSON.parse(execFileSync(process.execPath, [path.join(target, "lib/cli/main.js"), "--version", "--json"], { cwd: temporary, encoding: "utf8" }));
  assert.equal(output.outcome, "read");
  assert.equal(output.data.version, JSON.parse(readFileSync(path.join(source, "package.json"), "utf8")).version);
});

test("拒绝未明确替换、损坏来源和将自身作为来源，既有包逐字保留", (t) => {
  const { source, plugin, target } = fixture(t);
  importStoneDocs(source, plugin);
  const before = allFiles(target);
  assert.throws(() => importStoneDocs(source, plugin), /--replace/);
  assert.throws(() => importStoneDocs(target, plugin, { replace: true }), /自身/);
  writeFileSync(path.join(source, "lib/cli/main.js"), "corrupted\n");
  assert.throws(() => importStoneDocs(source, plugin, { replace: true }));
  assert.deepEqual(allFiles(target), before);
});

test("失效软链接也属于既有占用，默认导入不覆盖", (t) => {
  const { source, plugin, target, temporary } = fixture(t);
  mkdirSync(path.dirname(target), { recursive: true });
  symlinkSync(path.join(temporary, "absent"), target);
  assert.throws(() => importStoneDocs(source, plugin), /--replace/);
  assert.equal(fs.lstatSync(target).isSymbolicLink(), true);
});

test("显式替换完整同源候选，只更新生成包，不触碰旁边资料", (t) => {
  const { source, plugin, target } = fixture(t);
  importStoneDocs(source, plugin);
  const note = path.join(plugin, "notes.md");
  writeFileSync(note, "human-owned\n");
  const manifest = JSON.parse(readFileSync(path.join(source, "artifact.json"), "utf8"));
  const pack = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
  manifest.version = "0.1.1";
  pack.version = "0.1.1";
  writeFileSync(path.join(source, "artifact.json"), JSON.stringify(manifest));
  writeFileSync(path.join(source, "package.json"), JSON.stringify(pack));
  reseal(source);
  importStoneDocs(source, plugin, { replace: true });
  assert.deepEqual(allFiles(target), allFiles(source));
  assert.equal(readFileSync(note, "utf8"), "human-owned\n");
  assert.deepEqual(readdirSync(path.dirname(target)), ["stonedocs"]);
});

test("候选程序来源不能以正式模式导入，参数不完整或重复时不执行导入", (t) => {
  const { source, plugin, target } = fixture(t);
  const file = path.join(source, "artifact.json");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  manifest.source.state = "working-tree";
  writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => importStoneDocs(source, plugin, { release: true }), /working-tree|候选|提交/);
  assert.equal(existsSync(target), false);
  assert.equal(main(["--package"]), 2);
  assert.equal(main(["--replace", "--replace"]), 2);
});

test("复制期间旧包被外部改写时停止替换并保留改写与本轮材料", (t) => {
  const { source, plugin, target } = fixture(t);
  importStoneDocs(source, plugin);
  const edited = path.join(target, "lib/cli/main.js");
  const originalCopy = fs.cpSync;
  let injected = false;
  Object.defineProperty(fs, "cpSync", { value: (...args: Parameters<typeof fs.cpSync>) => {
    const [from] = args;
    originalCopy(...args);
    if (String(from) === source) {
      writeFileSync(edited, readFileSync(edited, "utf8") + "\n// concurrent-user-edit\n");
      injected = true;
    }
  } });
  syncBuiltinESMExports();
  try { assert.throws(() => importStoneDocs(source, plugin, { replace: true }), /保留/); }
  finally { Object.defineProperty(fs, "cpSync", { value: originalCopy }); syncBuiltinESMExports(); }
  assert.equal(injected, true);
  assert.match(readFileSync(edited, "utf8"), /concurrent-user-edit/);
  assert.equal(readdirSync(path.dirname(target)).some((name) => name.startsWith(".stonedocs-import-")), true);
});

test("同绝对路径的配套模块替换后读取新实现，不继承 ESM 缓存", (t) => {
  const { temporary } = fixture(t);
  const root = path.join(temporary, "reader package");
  mkdirSync(path.join(root, "lib/distribution"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
  const module = path.join(root, "lib/distribution/artifact.js");
  const set = (version: string) => writeFileSync(module, `export function readArtifact(root) { return {root,manifest:{cliContract:1,ruleContract:1,version:${JSON.stringify(version)}}}; }\n`);
  set("first");
  assert.equal((readPairedArtifact(root).manifest as unknown as { version: string }).version, "first");
  set("second");
  assert.equal((readPairedArtifact(root).manifest as unknown as { version: string }).version, "second");
});


test("消费者独立拒绝其不支持的契约，即使新产物验证器自称通过", (t) => {
  const { temporary } = fixture(t);
  const root = path.join(temporary, "future reader package");
  mkdirSync(path.join(root, "lib/distribution"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
  const module = path.join(root, "lib/distribution/artifact.js");
  for (const [contract, unsupported] of [["cliContract", 2], ["ruleContract", 3]] as const) {
    writeFileSync(module, `export function readArtifact(root) { return {root,manifest:{cliContract:1,ruleContract:1,${contract}:${unsupported}},validated:true}; }\n`);
    assert.throws(() => readPairedArtifact(root), /不支持.*契约/);
  }
});


test("消费者显式支持 v1/v2 规则而不自动采纳未知契约", (t) => {
  const { temporary } = fixture(t);
  const root = path.join(temporary, "supported reader package");
  mkdirSync(path.join(root, "lib/distribution"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
  for (const ruleContract of [1, 2]) {
    writeFileSync(path.join(root, "lib/distribution/artifact.js"), `export function readArtifact(root) { return {root,manifest:{cliContract:1,ruleContract:${ruleContract}}}; }\n`);
    assert.equal(readPairedArtifact(root).manifest.ruleContract, ruleContract);
  }
});
