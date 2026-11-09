import assert from "node:assert/strict";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPairedArtifact } from "./validate-document-workflow.ts";

const PLUGIN_ROOT = fileURLToPath(new URL("../plugins/stoneplugins", import.meta.url));
function occupied(file: string): boolean {
  try { lstatSync(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}
const USAGE = "npm run import:stonedocs -- --package <已构建包目录> [--replace] [--release]";

/** 只导入一个完整生成包；不存在的目标直接建立，替换仅限已验证的同源产物。 */
export function importStoneDocs(source: string, pluginRoot = PLUGIN_ROOT, options: { replace?: boolean; release?: boolean } = {}) {
  const snapshot = (directory: string) => {
    const stat = lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), "配套包必须是普通目录");
    const manifestFile = path.join(directory, "artifact.json");
    const manifestStat = lstatSync(manifestFile);
    assert.ok(manifestStat.isFile() && !manifestStat.isSymbolicLink(), "配套清单必须是普通文件");
    return { manifest: readFileSync(manifestFile), dev: stat.dev, ino: stat.ino };
  };
  const matches = (directory: string, expected: { manifest: Buffer; dev: number; ino: number }): boolean => {
    const current = snapshot(directory);
    return current.dev === expected.dev && current.ino === expected.ino && expected.manifest.equals(current.manifest);
  };
  const sourcePath = path.resolve(source);
  const sourceSnapshot = snapshot(sourcePath);
  const artifact = readPairedArtifact(sourcePath, options);
  assert.ok(matches(sourcePath, sourceSnapshot), "校验期间来源产物身份或清单发生变化，停止导入");
  assert.equal(artifact.manifest.source.repository, "https://github.com/sty20030818/StoneDocs", "只能导入 StoneDocs 作者源产物");
  const sourceManifest = sourceSnapshot.manifest;
  const toolsRoot = path.join(realpathSync(pluginRoot), "tools");
  if (occupied(toolsRoot)) assert.ok(lstatSync(toolsRoot).isDirectory() && !lstatSync(toolsRoot).isSymbolicLink(), "tools 必须是普通目录");
  const destination = path.join(toolsRoot, "stonedocs");
  assert.notEqual(artifact.root, destination, "来源不能是导入目标自身");
  const replacing = occupied(destination);
  let previous: { manifest: Buffer; dev: number; ino: number } | undefined;
  if (replacing) {
    assert.ok(options.replace, "配套产物已存在；确认替换生成包后显式提供 --replace");
    previous = snapshot(destination);
    readPairedArtifact(destination);
    assert.ok(matches(destination, previous), "校验期间既有产物发生变化，保留后续改动并停止");
  }
  mkdirSync(toolsRoot, { recursive: true });
  const temporary = mkdtempSync(path.join(toolsRoot, ".stonedocs-import-"));
  const candidate = path.join(temporary, "candidate");
  const backup = path.join(temporary, "previous");
  const assertPrevious = (directory: string): void => {
    assert.ok(previous && matches(directory, previous), "既有产物身份或清单已变化；保留后续改动并停止");
    readPairedArtifact(directory);
  };
  let installed = false;
  let candidateSnapshot: { manifest: Buffer; dev: number; ino: number } | undefined;
  let movedPrevious = false;
  try {
    cpSync(artifact.root, candidate, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: false });
    readPairedArtifact(candidate, options);
    assert.ok(sourceManifest.equals(readFileSync(path.join(candidate, "artifact.json"))), "复制中的来源清单发生变化；保留既有包并重新导入");
    const candidateStat = lstatSync(candidate);
    candidateSnapshot = { manifest: sourceManifest, dev: candidateStat.dev, ino: candidateStat.ino };
    if (replacing) { assertPrevious(destination); renameSync(destination, backup); movedPrevious = true; }
    else assert.ok(!occupied(destination), "导入目标已被占用，保留现有路径并停止");
    renameSync(candidate, destination);
    installed = true;
    const imported = readPairedArtifact(destination, options);
    assert.ok(sourceManifest.equals(readFileSync(path.join(destination, "artifact.json"))), "导入后清单读回不一致");
    if (movedPrevious) assertPrevious(backup);
    rmSync(temporary, { recursive: true });
    return imported.manifest;
  } catch (error) {
    // 只撤回本次已安装目录；失败时保留可核对的临时材料，不触碰未知路径。
    try {
      if (installed) {
        assert.ok(candidateSnapshot && matches(destination, candidateSnapshot), "导入目标出现本次复制外的改动，停止自动恢复");
        readPairedArtifact(destination);
        renameSync(destination, path.join(temporary, "failed"));
      }
      if (movedPrevious) renameSync(backup, destination);
    } catch {
      throw new Error(`导入及恢复未完成，请核对 ${destination} 与 ${temporary}；不自动清理。`, { cause: error });
    }
    throw new Error(`导入未完成，既有产物已保留；临时材料位于 ${temporary}。`, { cause: error });
  }
}

export function main(args = process.argv.slice(2)): number {
  if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) { console.log(USAGE); return 0; }
  let source: string | undefined;
  const options: { replace?: boolean; release?: boolean } = {};
  for (let index = 0; index < args.length; index++) {
    const option = args[index]!;
    if (option === "--package" && !source && args[index + 1] && !args[index + 1]!.startsWith("--")) source = args[++index];
    else if (option === "--replace" && !options.replace) options.replace = true;
    else if (option === "--release" && !options.release) options.release = true;
    else { console.error(USAGE); return 2; }
  }
  if (!source) { console.error(USAGE); return 2; }
  try {
    const manifest = importStoneDocs(source, PLUGIN_ROOT, options);
    console.log(JSON.stringify({ outcome: "imported", package: "tools/stonedocs", manifest }));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "配套产物导入未完成。");
    return 1;
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main();
