import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeLinearGuide, LINEAR_GUIDE_PATHS, LINEAR_GUIDE_REPOSITORY, readLinearGuide } from "./linear-guide.ts";

const DESTINATION = fileURLToPath(new URL("../plugins/stoneplugins/references/linear.md", import.meta.url));
const USAGE = "npm run import:linear -- --source <StoneDocs Git根> --revision <完整提交> [--working-tree] [--replace]";

function occupied(file: string): boolean {
  try { lstatSync(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

/** 与 CLI 包分开发行的单文件指南；固定来源读取提交正文，候选必须锚定实际 HEAD。 */
export function importLinearGuide(source: string, revision: string, destination = DESTINATION, options: { workingTree?: boolean; replace?: boolean } = {}) {
  assert.match(revision, /^[a-f\d]{40}$/, "Linear 指南来源须使用完整提交");
  const sourceRoot = realpathSync(source);
  const git = (...args: string[]) => execFileSync("git", ["--no-replace-objects", ...args], { cwd: sourceRoot, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(realpathSync(git("rev-parse", "--show-toplevel").toString("utf8").trim()), sourceRoot, "来源必须为明确的 Git 根");
  assert.equal(git("rev-parse", "--verify", `${revision}^{commit}`).toString("utf8").trim(), revision, "来源提交身份无法核对");
  const readWorkingSource = () => {
    const candidates = LINEAR_GUIDE_PATHS.filter((file) => occupied(path.join(sourceRoot, file)));
    assert.equal(candidates.length, 1, "工作树须有唯一 Linear 指南来源；缺少或双份来源均停止");
    const sourcePath = candidates[0]!;
    const parts = sourcePath.split("/");
    for (let index = 1; index < parts.length; index++) {
      const stat = lstatSync(path.join(sourceRoot, ...parts.slice(0, index)));
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), "工作树指南的路径须经过普通目录");
    }
    const sourceFile = path.join(sourceRoot, sourcePath);
    const stat = lstatSync(sourceFile);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), "工作树 Linear 指南必须为普通文件");
    return { path: sourcePath, body: readFileSync(sourceFile) };
  };
  const readCommittedSource = () => {
    const entries = git("ls-tree", revision, "--", ...LINEAR_GUIDE_PATHS).toString("utf8").trim().split("\n").filter(Boolean);
    assert.equal(entries.length, 1, "固定提交须有唯一 Linear 指南来源；缺少或双份来源均停止");
    const entry = entries[0]!.match(/^100(?:644|755) blob [a-f\d]{40}\t(.+)$/);
    assert.ok(entry, "固定提交的 Linear 指南须为普通文件，文件类型不符则停止");
    const sourcePath = LINEAR_GUIDE_PATHS.find((file) => file === entry[1]);
    assert.ok(sourcePath, "固定提交的 Linear 指南来源路径不符合约定");
    return { path: sourcePath, body: git("show", `${revision}:${sourcePath}`) };
  };
  if (options.workingTree) assert.equal(git("rev-parse", "HEAD").toString("utf8").trim(), revision, "working-tree 来源须锚定当前真实 HEAD");
  const snapshot = options.workingTree ? readWorkingSource() : readCommittedSource();
  const bytes = encodeLinearGuide(snapshot.body, { repository: LINEAR_GUIDE_REPOSITORY, revision, state: options.workingTree ? "working-tree" : "commit", path: snapshot.path });

  const target = path.resolve(destination);
  const previous = occupied(target) ? (() => {
    assert.ok(options.replace, "Linear 指南已存在；确认替换固定副本后显式提供 --replace");
    const guide = readLinearGuide(target);
    const stat = lstatSync(target);
    return { raw: guide.raw, dev: stat.dev, ino: stat.ino, mode: stat.mode & 0o777 };
  })() : undefined;
  const assertPrevious = () => {
    const stat = lstatSync(target);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.dev === previous!.dev && stat.ino === previous!.ino && readFileSync(target).equals(previous!.raw), "Linear 指南出现后续修改，保留当前内容并停止替换");
  };
  const assertSource = () => {
    if (options.workingTree) {
      assert.equal(git("rev-parse", "HEAD").toString("utf8").trim(), revision, "导入期间来源 HEAD 已变化");
      const current = readWorkingSource();
      assert.equal(current.path, snapshot.path, "导入期间来源路径已变化，请重新核对");
      assert.ok(current.body.equals(snapshot.body), "导入期间来源正文已变化，请重新核对");
    }
  };
  assertSource();
  const parent = path.dirname(target);
  mkdirSync(parent, { recursive: true });
  assert.ok(lstatSync(parent).isDirectory() && !lstatSync(parent).isSymbolicLink(), "Linear 指南目标父级必须为普通目录");
  if (!previous) {
    writeFileSync(target, bytes, { flag: "wx" });
  } else if (!previous.raw.equals(bytes)) {
    const temporary = mkdtempSync(path.join(parent, ".linear-guide-import-"));
    const candidate = path.join(temporary, "linear.md");
    try {
      writeFileSync(candidate, bytes, { flag: "wx", mode: previous.mode });
      readLinearGuide(candidate);
      assertSource();
      assertPrevious();
      renameSync(candidate, target);
    } finally {
      rmSync(temporary, { recursive: true });
    }
  } else assertPrevious();
  const imported = readLinearGuide(target);
  assert.ok(imported.raw.equals(bytes), "Linear 指南导入后读回不一致，停止后续操作");
  return imported;
}

export function main(args = process.argv.slice(2)): number {
  if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) { console.log(USAGE); return 0; }
  let source: string | undefined;
  let revision: string | undefined;
  const options: { workingTree?: boolean; replace?: boolean } = {};
  for (let index = 0; index < args.length; index++) {
    const option = args[index]!;
    if (option === "--source" && !source && args[index + 1] && !args[index + 1]!.startsWith("--")) source = args[++index];
    else if (option === "--revision" && !revision && args[index + 1] && !args[index + 1]!.startsWith("--")) revision = args[++index];
    else if (option === "--working-tree" && !options.workingTree) options.workingTree = true;
    else if (option === "--replace" && !options.replace) options.replace = true;
    else { console.error(USAGE); return 2; }
  }
  if (!source || !revision) { console.error(USAGE); return 2; }
  try {
    const guide = importLinearGuide(source, revision, DESTINATION, options);
    console.log(JSON.stringify({ outcome: "imported", path: "references/linear.md", source: guide.source, sha256: guide.sha256 }));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Linear 指南导入未完成。");
    return 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main();
