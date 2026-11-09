import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { validateDocumentWorkflow } from "../scripts/validate-document-workflow.ts";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../plugins/stoneplugins");
const SOP_NAMES = ["idea", "compare", "decide", "story", "plan", "design", "task", "verify", "review"];
const DOCS_FILES = ["conventions.md", "sop/README.md", ...SOP_NAMES.map((name) => `sop/${name}.md`)];

function fixture(t: TestContext) {
  const temporary = mkdtempSync(path.join(tmpdir(), "stoneplugins-docs-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const pluginRoot = path.join(temporary, "plugin with spaces");
  const docsRoot = path.join(pluginRoot, "references/docs-system");
  mkdirSync(path.join(docsRoot, "sop"), { recursive: true });
  for (const name of ["engineering", ...SOP_NAMES]) {
    const skillRoot = path.join(pluginRoot, "skills", name);
    mkdirSync(path.join(skillRoot, "agents"), { recursive: true });
    const body = name === "engineering" ? "Engineering rules.\n" : `[Rules](../../references/docs-system/conventions.md#rules)\n[Workflow](../../references/docs-system/sop/${name}.md)\n[Output](../../references/docs-system/sop/${name}.md#输出结构与示例)\n[Source](../../references/docs-system/source.json)\n`;
    writeFileSync(path.join(skillRoot, "SKILL.md"), `---\nname: ${name}\ndescription: "A focused workflow."\n---\n\n${body}`);
    writeFileSync(path.join(skillRoot, "agents/openai.yaml"), `interface:\n  display_name: "${name}"\n  short_description: "A focused workflow"\n  default_prompt: "Use $${name} for this work."\n\npolicy:\n  allow_implicit_invocation: true\n`);
  }
  writeFileSync(path.join(docsRoot, "conventions.md"), "# Rules\n\n[Workflows](sop/README.md)\n");
  writeFileSync(path.join(docsRoot, "sop/README.md"), "# Workflows\n");
  for (const name of SOP_NAMES) {
    writeFileSync(path.join(docsRoot, `sop/${name}.md`), `# ${name}\n\n[Rules](../conventions.md#rules)\n\n## 操作\n\nFollow the workflow.\n\n## 输出结构与示例\n\nRecord the actual result.\n`);
  }
  const source = {
    sourceRepository: "https://github.com/sty20030818/StoneDocs",
    baseCommit: "35e6497a59bc8f008d73268caf791f4a6bdc92d9",
    sourceState: "working-tree",
    files: DOCS_FILES.map((name) => ({
      sourcePath: `docs/${name}`,
      bundledPath: name,
      sha256: createHash("sha256").update(readFileSync(path.join(docsRoot, name))).digest("hex"),
    })),
  };
  writeFileSync(path.join(docsRoot, "source.json"), JSON.stringify(source));
  return { temporary, pluginRoot, docsRoot, source };
}

function appendTask(pluginRoot: string, content: string) {
  const file = path.join(pluginRoot, "skills/task/SKILL.md");
  writeFileSync(file, `${readFileSync(file, "utf8")}\n${content}\n`);
}

test("十项技能与固定来源在独立目录中可验证，忽略围栏示例和 HTTP 背景链接", (t) => {
  const { pluginRoot } = fixture(t);
  appendTask(pluginRoot, "```markdown\n[Example](missing-example.md)\n```\n~~~markdown\n[Example](another-missing.md)\n~~~\n[Background](https://example.com/background)\n`[Inline example](not-a-resource.md)`");
  assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot));
});

test("实际完整插件复制到安装位置后不依赖原仓库路径", (t) => {
  const { pluginRoot } = fixture(t);
  rmSync(pluginRoot, { recursive: true });
  cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
  const resources = validateDocumentWorkflow(pluginRoot);
  const docsRoot = path.join(pluginRoot, "references/docs-system");
  assert.equal(resources.filter((file) => file.startsWith(`${docsRoot}${path.sep}`) && path.extname(file) === ".md").length, 11);
});

test("九项文档技能的四类必需入口缺失均被拒绝", (t) => {
  for (const name of SOP_NAMES) {
    for (const label of ["Rules", "Workflow", "Output", "Source"]) {
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
      ["source.json)", "sop/README.md)"],
    ]) {
      const { pluginRoot } = fixture(t);
      const skill = path.join(pluginRoot, "skills", name, "SKILL.md");
      writeFileSync(skill, readFileSync(skill, "utf8").replace(from!, to!));
      assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
    }
  }
});

test("代码示例、外部同名链接与未使用定义不能补足必需入口", (t) => {
  const workflow = "[Workflow](../../references/docs-system/sop/task.md)";
  for (const substitute of [`\`\`\`markdown\n${workflow}\n\`\`\``, `\`${workflow}\``, "[Workflow](https://example.com/references/docs-system/sop/task.md)", "[unused-workflow]: ../../references/docs-system/sop/task.md"]) {
    const { pluginRoot } = fixture(t);
    const skill = path.join(pluginRoot, "skills/task/SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(workflow, substitute));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少必需文档入口/);
  }
});

test("缩进代码、注释与转义文本不能补足正文入口", (t) => {
  const workflow = "[Workflow](../../references/docs-system/sop/task.md)";
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
    writeFileSync(skill, `${original.replace("[Workflow](../../references/docs-system/sop/task.md)", "[Workflow][route]")}\n[route]: ../../references/docs-system/sop/${first}.md\n[route]: ../../references/docs-system/sop/${last}.md\n`);
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
      if (mode === "normalized") content = original.replaceAll("../../references/docs-system/", "../../references/./docs-system/sop/../");
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
        const targets = ["conventions.md", `sop/${name}.md`, `sop/${name}.md#输出结构与示例`, "source.json"];
        content = `${original.match(/^---\n[\s\S]*?\n---\n/)![0]}\nUse the linked resources.\n${targets.map((_, index) => mode === "reference-whitespace" ? `[Resource ${index}][ Route   ${index} ]` : mode === "reference" ? `[Resource ${index}][route-${index}]` : mode === "collapsed" ? `[route-${index}][]` : `[route-${index}]`).join("\n")}\n\n${targets.map((target, index) => `[${mode === "reference-whitespace" ? `route ${index}` : `route-${index}`}]: <../../references/docs-system/${target}>`).join("\n")}\n`;
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
    const sourcePath = path.join(pluginRoot, "references/docs-system/source.json");
    const source = JSON.parse(readFileSync(sourcePath, "utf8"));
    source.sourceState = "commit";
    writeFileSync(sourcePath, JSON.stringify(source));
    const skill = path.join(pluginRoot, "skills/task/SKILL.md");
    const original = readFileSync(skill, "utf8");
    writeFileSync(skill, mode === "single-line" ? `${original.match(/^---\n[\s\S]*?\n---\n/)![0]}\nRun task.\n` : original.replaceAll("sop/task.md", "sop/design.md"));
    assert.throws(() => validateDocumentWorkflow(pluginRoot, { release: true }), /缺少必需文档入口/);
  }
});

test("每个必需技能缺失、额外技能或嵌套重复发现均被拒绝", (t) => {
  for (const name of ["engineering", ...SOP_NAMES]) {
    const { pluginRoot } = fixture(t);
    rmSync(path.join(pluginRoot, "skills", name), { recursive: true });
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /十项技能/);
  }
  const { pluginRoot } = fixture(t);
  const extra = path.join(pluginRoot, "skills/extra");
  cpSync(path.join(pluginRoot, "skills/task"), extra, { recursive: true });
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /十项技能/);
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
  for (const target of ["missing.md", "../../references/docs-system/conventions.md#absent", "../../references/docs-system/conventions.md#rules#missing", "../../references/docs-system/sop/task.md#输出结构与示例-absent"]) {
    const { pluginRoot } = fixture(t);
    appendTask(pluginRoot, `[Resource](${target})`);
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少|锚点/);
  }
  for (const target of ["../missing.md", "../conventions.md#absent"]) {
    const { pluginRoot, docsRoot, source } = fixture(t);
    const sop = path.join(docsRoot, "sop/task.md");
    writeFileSync(sop, `${readFileSync(sop, "utf8")}\n[Resource](${target})\n`);
    source.files.find((file) => file.bundledPath === "sop/task.md")!.sha256 = createHash("sha256").update(readFileSync(sop)).digest("hex");
    writeFileSync(path.join(docsRoot, "source.json"), JSON.stringify(source));
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

test("必需 SOP 缺失、遗留模板、快照或清单损坏均被拒绝，工作树来源不能用于发布", (t) => {
  for (const name of SOP_NAMES) {
    const { pluginRoot, docsRoot } = fixture(t);
    rmSync(path.join(docsRoot, `sop/${name}.md`));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /缺少插件资源/);
  }
  const { pluginRoot, docsRoot, source } = fixture(t);
  assert.throws(() => validateDocumentWorkflow(pluginRoot, { release: true }), /working-tree/);
  const legacyTemplate = path.join(docsRoot, "templates.md");
  writeFileSync(legacyTemplate, "# Legacy templates\n");
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /遗留 templates\.md/);
  rmSync(legacyTemplate);
  const conventions = path.join(docsRoot, "conventions.md");
  const original = readFileSync(conventions, "utf8");
  writeFileSync(conventions, "# Changed\n");
  assert.throws(() => validateDocumentWorkflow(pluginRoot), /SHA-256/);
  writeFileSync(conventions, original);
  const files = source.files;
  for (const invalid of [
    [...files, { sourcePath: "docs/templates.md", bundledPath: "templates.md", sha256: "0".repeat(64) }],
    files.slice(0, -1),
    [...files.slice(0, -1), files[0]!],
    [{ ...files[0]!, bundledPath: "../conventions.md" }, ...files.slice(1)],
    [{ ...files[0]!, sourcePath: "../docs/conventions.md" }, ...files.slice(1)],
  ]) {
    source.files = invalid;
    writeFileSync(path.join(docsRoot, "source.json"), JSON.stringify(source));
    assert.throws(() => validateDocumentWorkflow(pluginRoot), /来源清单/);
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


test("已提交的完整规则来源可通过包级发布来源检查", (t) => {
  const { pluginRoot, docsRoot, source } = fixture(t);
  source.sourceState = "commit";
  writeFileSync(path.join(docsRoot, "source.json"), JSON.stringify(source));
  assert.doesNotThrow(() => validateDocumentWorkflow(pluginRoot, { release: true }));
});
