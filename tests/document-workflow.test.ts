import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { validateDocumentWorkflow } from "../scripts/validate-document-workflow.ts";
import { encodeLinearGuide, LINEAR_GUIDE_PATH, LINEAR_GUIDE_REPOSITORY, readLinearGuide } from "../scripts/linear-guide.ts";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../plugins/stoneplugins");
const SOP_NAMES = ["idea", "compare", "decide", "story", "plan", "design", "task", "verify", "review"];
const DOCS_FILES = ["conventions.md", "sop/README.md", ...SOP_NAMES.map((name) => `sop/${name}.md`)];

function sealPackage(packageRoot: string) {
  const file = path.join(packageRoot, "artifact.json");
  const artifact = JSON.parse(readFileSync(file, "utf8"));
  for (const entry of artifact.files) entry.sha256 = createHash("sha256").update(readFileSync(path.join(packageRoot, entry.path))).digest("hex");
  writeFileSync(file, JSON.stringify(artifact));
}

function fixture(t: TestContext, ruleContract: 1 | 2 = 1) {
  const temporary = mkdtempSync(path.join(tmpdir(), "stoneplugins-docs-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const pluginRoot = path.join(temporary, "plugin with spaces");
  const packageRoot = path.join(pluginRoot, "tools/stonedocs");
  cpSync(path.join(PLUGIN_ROOT, "tools/stonedocs"), packageRoot, { recursive: true });
  const docsRoot = path.join(packageRoot, "rules/docs");
  mkdirSync(path.join(pluginRoot, "references"), { recursive: true });
  writeFileSync(path.join(pluginRoot, "references/cli.md"), "# CLI\n\n[Tool](../tools/stonedocs/lib/cli/main.js)\n");
  for (const name of ["engineering", "linear", ...SOP_NAMES]) {
    const skillRoot = path.join(pluginRoot, "skills", name);
    mkdirSync(path.join(skillRoot, "agents"), { recursive: true });
    const method = ruleContract === 2 && ["design", "plan", "task", "verify", "review"].includes(name) ? "[Method](../../tools/stonedocs/rules/docs/knowledge/technical-design.md)\n" : "";
    const body = name === "engineering" ? "Engineering rules.\n" : name === "linear" ? "[Rules](../../tools/stonedocs/rules/docs/conventions.md#rules)\n[Guide](../../references/linear.md)\n[CLI](../../references/cli.md)\n" : `[Rules](../../tools/stonedocs/rules/docs/conventions.md#rules)\n[Workflow](../../tools/stonedocs/rules/docs/sop/${name}.md)\n[Output](../../tools/stonedocs/rules/docs/sop/${name}.md#输出结构与示例)\n[Source](../../tools/stonedocs/rules/source.json)\n[CLI](../../references/cli.md)\n`;
    writeFileSync(path.join(skillRoot, "SKILL.md"), `---\nname: ${name}\ndescription: "A focused workflow."\n---\n\n${body}${method}`);
    writeFileSync(path.join(skillRoot, "agents/openai.yaml"), `interface:\n  display_name: "${name}"\n  short_description: "A focused workflow"\n  default_prompt: "Use $${name} for this work."\n\npolicy:\n  allow_implicit_invocation: true\n`);
  }
  writeFileSync(path.join(pluginRoot, "references/linear.md"), encodeLinearGuide(Buffer.from("# Linear\n\n[Official](https://linear.app/docs/documents)\n"), { repository: LINEAR_GUIDE_REPOSITORY, revision: "35e6497a59bc8f008d73268caf791f4a6bdc92d9", state: "commit", path: LINEAR_GUIDE_PATH }));
  writeFileSync(path.join(docsRoot, "conventions.md"), "# Rules\n\n[Workflows](sop/README.md)\n");
  writeFileSync(path.join(docsRoot, "sop/README.md"), "# Workflows\n");
  for (const name of SOP_NAMES) {
    writeFileSync(path.join(docsRoot, `sop/${name}.md`), `# ${name}\n\n[Rules](../conventions.md#rules)\n\n## 操作\n\nFollow the workflow.\n\n## 输出结构与示例\n\nRecord the actual result.\n`);
  }
  if (ruleContract === 2) writeFileSync(path.join(docsRoot, "knowledge/technical-design.md"), "# Method\n\n[Rules](../conventions.md#rules)\n");
  else rmSync(path.join(docsRoot, "knowledge"), { recursive: true, force: true });
  const source = {
    schemaVersion: 1,
    ruleContract,
    source: { repository: "https://github.com/sty20030818/StoneDocs", revision: "35e6497a59bc8f008d73268caf791f4a6bdc92d9" },
    files: [...DOCS_FILES, ...(ruleContract === 2 ? ["knowledge/technical-design.md"] : [])].map((name) => ({ path: `docs/${name}`, sha256: createHash("sha256").update(readFileSync(path.join(docsRoot, name))).digest("hex") })),
  };
  writeFileSync(path.join(packageRoot, "rules/source.json"), JSON.stringify(source));
  const artifact = JSON.parse(readFileSync(path.join(packageRoot, "artifact.json"), "utf8"));
  artifact.ruleContract = ruleContract;
  artifact.files = artifact.files.filter((entry: { path: string }) => !entry.path.startsWith("rules/docs/knowledge/"));
  if (ruleContract === 2) artifact.files.push({ path: "rules/docs/knowledge/technical-design.md", sha256: "0".repeat(64), executable: false });
  artifact.rules = source.source;
  artifact.source.state = "working-tree";
  writeFileSync(path.join(packageRoot, "artifact.json"), JSON.stringify(artifact));
  sealPackage(packageRoot);
  return { temporary, pluginRoot, docsRoot, packageRoot, source };
}

function appendTask(pluginRoot: string, content: string) {
  const file = path.join(pluginRoot, "skills/task/SKILL.md");
  writeFileSync(file, `${readFileSync(file, "utf8")}\n${content}\n`);
}

test("十一项技能与固定来源在独立目录中可验证，忽略围栏示例和 HTTP 背景链接", (t) => {
  const { pluginRoot } = fixture(t);
  appendTask(pluginRoot, "```markdown\n[Example](missing-example.md)\n```\n~~~markdown\n[Example](another-missing.md)\n~~~\n[Background](https://example.com/background)\n`[Inline example](not-a-resource.md)`");
  assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot));
});

test("实际完整插件复制到安装位置后不依赖原仓库路径", (t) => {
  const { pluginRoot } = fixture(t);
  rmSync(pluginRoot, { recursive: true });
  cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
  const resources = validateDocumentWorkflow(pluginRoot);
  const docsRoot = path.join(pluginRoot, "tools/stonedocs/rules/docs");
  assert.equal(resources.filter((file) => file.startsWith(`${docsRoot}${path.sep}`) && path.extname(file) === ".md").length, 12);
});

test("九项文档技能的五类必需入口缺失均被拒绝", (t) => {
  for (const name of SOP_NAMES) {
    for (const label of ["Rules", "Workflow", "Output", "Source", "CLI"]) {
      const { pluginRoot } = fixture(t);
      const skill = path.join(pluginRoot, "skills", name, "SKILL.md");
      writeFileSync(skill, readFileSync(skill, "utf8").split("\n").filter((line) => !line.startsWith(`[${label}]`)).join("\n"));
      assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
    }
  }
});

test("合法资源不能替代共同约定、自身 SOP、输出锚点或来源入口", (t) => {
  for (const name of SOP_NAMES) {
    const other = name === "design" ? "task" : "design";
    for (const [from, to] of [
      ["conventions.md#rules)", "sop/README.md)"],
      [`sop/${name}.md)`, `sop/${other}.md)`],
      [`sop/${name}.md#输出结构与示例)`, `sop/${other}.md#输出结构与示例)`],
      ["source.json)", "docs/sop/README.md)"],
      ["../../references/cli.md)", "../../tools/stonedocs/rules/docs/sop/README.md)"],
    ]) {
      const { pluginRoot } = fixture(t);
      const skill = path.join(pluginRoot, "skills", name, "SKILL.md");
      writeFileSync(skill, readFileSync(skill, "utf8").replace(from!, to!));
      assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
    }
  }
});

test("代码示例、外部同名链接与未使用定义不能补足必需入口", (t) => {
  const workflow = "[Workflow](../../tools/stonedocs/rules/docs/sop/task.md)";
  for (const substitute of [`\`\`\`markdown\n${workflow}\n\`\`\``, `\`${workflow}\``, "[Workflow](https://example.com/tools/stonedocs/rules/docs/sop/task.md)", "[unused-workflow]: ../../tools/stonedocs/rules/docs/sop/task.md"]) {
    const { pluginRoot } = fixture(t);
    const skill = path.join(pluginRoot, "skills/task/SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(workflow, substitute));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
  }
});

test("缩进代码、注释与转义文本不能补足正文入口", (t) => {
  const workflow = "[Workflow](../../tools/stonedocs/rules/docs/sop/task.md)";
  for (const substitute of [`\n    ${workflow}\n`, `\n\t${workflow}\n`, `\n- Example:\n\n      ${workflow}\n`, `<!--\n${workflow}\n-->`, `\\${workflow}`]) {
    const { pluginRoot } = fixture(t);
    const skill = path.join(pluginRoot, "skills/task/SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(workflow, substitute));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
  }
});

test("frontmatter 内的链接不能补足正文入口", (t) => {
  const { pluginRoot } = fixture(t);
  const skill = path.join(pluginRoot, "skills/task/SKILL.md");
  const original = readFileSync(skill, "utf8");
  const routes = original.slice(original.indexOf("\n---\n") + 5).trim();
  writeFileSync(skill, `---\nname: task\ndescription: ${JSON.stringify(routes.replaceAll("\n", " "))}\n---\n\nRun task.\n`);
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
});

test("重复引用定义按第一个目标判断正文入口", (t) => {
  for (const first of ["task", "design"]) {
    const { pluginRoot } = fixture(t);
    const skill = path.join(pluginRoot, "skills/task/SKILL.md");
    const original = readFileSync(skill, "utf8");
    const last = first === "task" ? "design" : "task";
    writeFileSync(skill, `${original.replace("[Workflow](../../tools/stonedocs/rules/docs/sop/task.md)", "[Workflow][route]")}\n[route]: ../../tools/stonedocs/rules/docs/sop/${first}.md\n[route]: ../../tools/stonedocs/rules/docs/sop/${last}.md\n`);
    if (first === "task") assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot));
    else assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
  }
});

test("合法路径变体、引用式链接与正文改写保留入口契约，engineering 不要求文档 SOP", (t) => {
  for (const name of SOP_NAMES) {
    for (const mode of ["normalized", "encoded", "anchored", "escaped-backslash", "paragraph", "list", "list-continuation", "reference", "reference-whitespace", "collapsed", "shortcut"]) {
      const { pluginRoot } = fixture(t);
      const skill = path.join(pluginRoot, "skills", name, "SKILL.md");
      const original = readFileSync(skill, "utf8");
      let content = original;
      if (mode === "normalized") content = original.replaceAll("../../tools/stonedocs/rules/docs/", "../../tools/stonedocs/rules/./docs/sop/../");
      else if (mode === "encoded") {
        content = original.replaceAll(`${name}.md`, `%${name.charCodeAt(0).toString(16)}${name.slice(1)}.md`)
          .replaceAll("#输出结构与示例", `#${encodeURIComponent("输出结构与示例")}`)
          .replace("conventions.md#rules)", "%63onventions.md#rules)").replace("source.json)", "%73ource.json)");
      } else if (mode === "anchored") content = original.replace(`sop/${name}.md)`, `sop/${name}.md#操作)`);
      else if (mode === "escaped-backslash") content = original.replaceAll("[", "\\\\[");
      else if (mode === "paragraph") content = original.replace("[Rules]", "Resources:\n    [Rules]").replaceAll("\n[", "\n    [");
      else if (mode === "list") content = original.replaceAll("\n[", "\n- [");
      else if (mode === "list-continuation") content = original.replace("[Rules]", "- Resources:\n\n    [Rules]").replaceAll("\n[", "\n    [");
      else {
        const targets = ["conventions.md", `sop/${name}.md`, `sop/${name}.md#输出结构与示例`, "../source.json", "../../../references/cli.md"];
        content = `${original.match(/^---\n[\s\S]*?\n---\n/)![0]}\nUse the linked resources.\n${targets.map((_, index) => mode === "reference-whitespace" ? `[Resource ${index}][ Route   ${index} ]` : mode === "reference" ? `[Resource ${index}][route-${index}]` : mode === "collapsed" ? `[route-${index}][]` : `[route-${index}]`).join("\n")}\n\n${targets.map((target, index) => `[${mode === "reference-whitespace" ? `route ${index}` : `route-${index}`}]: <${target === "../../../references/cli.md" ? "../../references/cli.md" : "../../tools/stonedocs/rules/docs/" + target}>`).join("\n")}\n`;
      }
      writeFileSync(skill, content);
      assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot));
    }
  }
});

test("完整安装包的正文缩水或全部错指合法 SOP 无法通过发布检查", (t) => {
  for (const mode of ["single-line", "wrong-sop"]) {
    const { pluginRoot } = fixture(t);
    rmSync(pluginRoot, { recursive: true });
    cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
    const sourcePath = path.join(pluginRoot, "tools/stonedocs/artifact.json");
    const source = JSON.parse(readFileSync(sourcePath, "utf8"));
    source.source.state = "commit";
    writeFileSync(sourcePath, JSON.stringify(source));
    const linearGuidePath = path.join(pluginRoot, "references/linear.md");
    const linearGuide = readLinearGuide(linearGuidePath);
    writeFileSync(linearGuidePath, encodeLinearGuide(linearGuide.body, { ...linearGuide.source, state: "commit" }));
    const skill = path.join(pluginRoot, "skills/task/SKILL.md");
    const original = readFileSync(skill, "utf8");
    writeFileSync(skill, mode === "single-line" ? `${original.match(/^---\n[\s\S]*?\n---\n/)![0]}\nRun task.\n` : original.replaceAll("sop/task.md", "sop/design.md"));
    assert.throws(() => validateDocumentWorkflow(pluginRoot, { release: true }), /缺少必需文档入口/);
  }
});

test("每个必需技能缺失、额外技能或嵌套重复发现均被拒绝", (t) => {
  for (const name of ["engineering", "linear", ...SOP_NAMES]) {
    const { pluginRoot } = fixture(t);
    rmSync(path.join(pluginRoot, "skills", name), { recursive: true });
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /十一项技能/);
  }
  const { pluginRoot } = fixture(t);
  const extra = path.join(pluginRoot, "skills/extra");
  cpSync(path.join(pluginRoot, "skills/task"), extra, { recursive: true });
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /十一项技能/);
  rmSync(extra, { recursive: true });
  mkdirSync(path.join(pluginRoot, "skills/story/nested"));
  writeFileSync(path.join(pluginRoot, "skills/story/nested/SKILL.md"), "# Duplicate\n");
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /唯一/);
});

test("损坏或重复元数据以及隐式调用关闭均被拒绝", (t) => {
  const { pluginRoot } = fixture(t);
  const skill = path.join(pluginRoot, "skills/task/SKILL.md");
  const original = readFileSync(skill, "utf8");
  writeFileSync(skill, original.replace("name: task", "name: task\nname: task"));
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /frontmatter/);
  writeFileSync(skill, original);
  const metadata = path.join(pluginRoot, "skills/task/agents/openai.yaml");
  const yaml = readFileSync(metadata, "utf8");
  for (const invalid of [
    yaml.replace("allow_implicit_invocation: true", "allow_implicit_invocation: false"),
    yaml.replace('display_name: "task"', 'display_name: "task"\n  display_name: "task"'),
    yaml.replace("$task for", "$task-other for"),
    yaml.replace("$task for", "$stoneplugins:task-other for"),
    yaml.replace("$task for", "$task:other for"),
  ]) {
    writeFileSync(metadata, invalid);
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /元数据|implicit|自身入口/);
  }
});

test("正文断链与缺失锚点被拒绝", (t) => {
  for (const target of ["missing.md", "../../tools/stonedocs/rules/docs/conventions.md#absent", "../../tools/stonedocs/rules/docs/conventions.md#rules#missing", "../../tools/stonedocs/rules/docs/sop/task.md#输出结构与示例-absent"]) {
    const { pluginRoot } = fixture(t);
    appendTask(pluginRoot, `[Resource](${target})`);
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少|锚点/);
  }
  for (const target of ["../missing.md", "../conventions.md#absent"]) {
    const { pluginRoot, docsRoot, packageRoot, source } = fixture(t);
    const sop = path.join(docsRoot, "sop/task.md");
    writeFileSync(sop, `${readFileSync(sop, "utf8")}\n[Resource](${target})\n`);
    source.files.find((file) => file.path === "docs/sop/task.md")!.sha256 = createHash("sha256").update(readFileSync(sop)).digest("hex");
    writeFileSync(path.join(packageRoot, "rules/source.json"), JSON.stringify(source));
    sealPackage(packageRoot);
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少|锚点/);
  }
});

test("资源的词法逃逸与软链接真实路径逃逸均被拒绝", (t) => {
  for (const mode of ["relative", "symlink"]) {
    const { pluginRoot, temporary } = fixture(t);
    const outside = path.join(temporary, "outside.md");
    writeFileSync(outside, "# Outside\n");
    if (mode === "relative") appendTask(pluginRoot, "[Outside](../../../outside.md)");
    else {
      symlinkSync(outside, path.join(pluginRoot, "skills/task/escape.md"));
      appendTask(pluginRoot, "[Outside](escape.md)");
    }
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /逃逸/);
  }
});

test("必需 SOP 缺失、遗留副本、快照或清单损坏均被拒绝，候选程序不能用于发布", (t) => {
  for (const name of SOP_NAMES) {
    const { pluginRoot, docsRoot } = fixture(t);
    rmSync(path.join(docsRoot, `sop/${name}.md`));
    assert.throws(() => validateDocumentWorkflow(pluginRoot));
  }
  const { pluginRoot, docsRoot, packageRoot, source } = fixture(t);
  assert.throws(() => validateDocumentWorkflow(pluginRoot, { release: true }), /working-tree|候选|提交/);
  const legacy = path.join(pluginRoot, "references/docs-system");
  mkdirSync(legacy);
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /第二份/);
  rmSync(legacy, { recursive: true });
  const conventions = path.join(docsRoot, "conventions.md");
  const original = readFileSync(conventions, "utf8");
  writeFileSync(conventions, "# Changed\n");
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /摘要|损坏|匹配|SHA-256/);
  writeFileSync(conventions, original);
  const files = source.files;
  for (const invalid of [
    [...files, { path: "docs/templates.md", sha256: "0".repeat(64) }],
    files.slice(0, -1),
    [...files.slice(0, -1), files[0]!],
    [{ ...files[0]!, path: "../conventions.md" }, ...files.slice(1)],
  ]) {
    source.files = invalid;
    writeFileSync(path.join(packageRoot, "rules/source.json"), JSON.stringify(source));
    sealPackage(packageRoot);
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /规范|清单|路径|资源集合/);
  }
});

test("新入口元数据必须指向自身且自身 SOP 锚点可取回", (t) => {
  for (const name of SOP_NAMES) {
    const { pluginRoot } = fixture(t);
    const metadata = path.join(pluginRoot, "skills", name, "agents/openai.yaml");
    const original = readFileSync(metadata, "utf8");
    writeFileSync(metadata, original.replace(`$${name} for`, "$unrelated-workflow for"));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /自身入口/);
    writeFileSync(metadata, original);
    const skill = path.join(pluginRoot, "skills", name, "SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace("#输出结构与示例", "#missing-output"));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /锚点/);
  }
});


test("静态格式已声明固定提交的完整候选可验证；不证明真实发布或来源认证", (t) => {
  const { pluginRoot, packageRoot } = fixture(t);
  const file = path.join(packageRoot, "artifact.json");
  const artifact = JSON.parse(readFileSync(file, "utf8"));
  artifact.source.state = "commit";
  writeFileSync(file, JSON.stringify(artifact));
  assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot, { release: true }));
});

test("Linear 适配器独立于九项 SOP，三类必需入口不能省略", (t) => {
  for (const label of ["Rules", "Guide", "CLI"]) {
    const { pluginRoot } = fixture(t);
    assert.equal(readFileSync(path.join(pluginRoot, "skills/linear/SKILL.md"), "utf8").includes("sop/linear.md"), false);
    const skill = path.join(pluginRoot, "skills/linear/SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").split("\n").filter((line) => !line.startsWith(`[${label}]`)).join("\n"));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口：linear/);
  }
});

test("Linear 指南损坏与候选发布被拒绝，CLI 和十一份规范仍为独立合同", (t) => {
  const { pluginRoot, packageRoot } = fixture(t);
  const file = path.join(pluginRoot, "references/linear.md");
  const original = readFileSync(file);
  writeFileSync(file, Buffer.concat([original, Buffer.from("\nmanual edit\n")]));
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /摘要/);
  writeFileSync(file, original);
  const artifactPath = path.join(packageRoot, "artifact.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  artifact.source.state = "commit";
  writeFileSync(artifactPath, JSON.stringify(artifact));
  assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot, { release: true }));
  writeFileSync(file, encodeLinearGuide(Buffer.from("# Linear candidate\n"), { repository: LINEAR_GUIDE_REPOSITORY, revision: "a".repeat(40), state: "working-tree", path: LINEAR_GUIDE_PATH }));
  assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot));
  assert.throws(() => validateDocumentWorkflow(pluginRoot, { release: true }), /Linear 指南.*候选/);
});


test("v2 的五项技术设计入口必须实际链接同包方法，代码或错指不能补足", (t) => {
  for (const name of ["design", "plan", "task", "verify", "review"]) {
    const { pluginRoot } = fixture(t, 2);
    assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot));
    const file = path.join(pluginRoot, "skills", name, "SKILL.md");
    const original = readFileSync(file, "utf8");
    const method = "[Method](../../tools/stonedocs/rules/docs/knowledge/technical-design.md)";
    for (const replacement of ["", "```markdown\n" + method + "\n```", "[Method](../../tools/stonedocs/rules/docs/conventions.md#rules)"]) {
      writeFileSync(file, original.replace(method, replacement));
      assert.throws(() => validateDocumentWorkflow(pluginRoot), /技术设计方法/);
    }
  }
});

test("v2 必需方法缺失或损坏时消费者拒绝，不从作者仓补缺", (t) => {
  for (const mode of ["missing", "changed"]) {
    const { pluginRoot, docsRoot } = fixture(t, 2);
    const method = path.join(docsRoot, "knowledge/technical-design.md");
    if (mode === "missing") rmSync(method);
    else writeFileSync(method, "# Different method\n");
    assert.throws(() => validateDocumentWorkflow(pluginRoot));
  }
});


test("新固定 CLI 继续读取 v1 项目本地 SOP，显式 v2 采用才获得方法且缺失时拒绝写入", (t) => {
  const { temporary, packageRoot: oldPackage } = fixture(t);
  const currentPackage = path.join(temporary, "current package");
  cpSync(path.join(PLUGIN_ROOT, "tools/stonedocs"), currentPackage, { recursive: true });
  const cli = path.join(currentPackage, "lib/cli/main.js");
  const run = (project: string, args: string[], input?: unknown, expected = 0) => {
    const result = spawnSync(process.execPath, [cli, ...args, "--project", project, "--json"], {
      cwd: temporary, encoding: "utf8", input: input === undefined ? undefined : JSON.stringify(input),
    });
    assert.equal(result.status, expected, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  };
  const adopt = (project: string, rules: string) => {
    mkdirSync(project);
    const preview = run(project, ["init", "--rules", rules]);
    assert.equal(preview.outcome, "preview");
    assert.equal(run(project, ["init", "--rules", rules, "--apply", "--expect", preview.data.expect]).outcome, "applied");
  };
  const v1 = path.join(temporary, "old v1 project"), v2 = path.join(temporary, "new v2 project");
  adopt(v1, path.join(oldPackage, "rules"));
  const local = path.join(v1, "docs/sop/task.md");
  writeFileSync(local, readFileSync(local, "utf8") + "\n项目本地约束继续有效。\n");
  const oldMetadata = readFileSync(path.join(v1, "docs/.stonedocs.json"), "utf8");
  const shown = run(v1, ["sop", "show", "task"]);
  assert.equal(shown.data.source.ruleContract, 1);
  assert.equal(shown.data.raw, readFileSync(local, "utf8"));
  assert.equal(readFileSync(path.join(v1, "docs/.stonedocs.json"), "utf8"), oldMetadata);
  assert.equal(existsSync(path.join(v1, "docs/knowledge/technical-design.md")), false);
  adopt(v2, path.join(currentPackage, "rules"));
  const method = path.join(v2, "docs/knowledge/technical-design.md");
  assert.equal(readFileSync(method, "utf8"), readFileSync(path.join(currentPackage, "rules/docs/knowledge/technical-design.md"), "utf8"));
  assert.equal(run(v2, ["sop", "show", "design"]).data.source.ruleContract, 2);
  rmSync(method);
  const rejected = run(v2, ["goal", "new", "--input", "-"], { schemaVersion: 1, id: "V1", title: "阻断检查", scope: "不应写入。", criteria: ["必需方法须完整。"] }, 1);
  assert.equal(rejected.outcome, "rejected");
  assert.equal(rejected.errors[0].code, "ADOPTED_RULES_MISSING");
  assert.equal(existsSync(method), false);
  assert.equal(existsSync(path.join(v2, "docs/goals")), false);
});
