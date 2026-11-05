import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const SKILL_NAMES = ["engineering", "review", "task", "verify"];
const SOURCE_REPOSITORY = "https://github.com/sty20030818/StoneDocs";

type SourceFile = { sourcePath: string; bundledPath: string; sha256: string };
type SourceManifest = {
  sourceRepository: string;
  baseCommit: string;
  sourceState: "working-tree" | "commit";
  files: SourceFile[];
};

function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function withoutCode(markdown: string, stripInline = true): string {
  let fence: { marker: string; length: number } | undefined;
  return markdown.split(/\r?\n/).map((line) => {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.marker}{${fence.length},}\\s*$`).test(line)) fence = undefined;
      return "";
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (opening) {
      fence = { marker: opening[1]![0]!, length: opening[1]!.length };
      return "";
    }
    return stripInline ? line.replace(/(`+)(.*?)\1/g, "") : line;
  }).join("\n");
}

function markdownLinks(markdown: string): string[] {
  const content = withoutCode(markdown);
  const links = [...content.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|((?:\\.|[^\s()\\]|\([^()]*\))+))(?:\s+["'][^\n]*?["'])?\s*\)/g)]
    .map((match) => match[1] ?? match[2]!);
  const definitions = new Map<string, string>();
  for (const match of content.matchAll(/^ {0,3}\[([^\]\n]+)\]:\s*(?:<([^>\n]+)>|(\S+))/gm)) {
    const target = match[2] ?? match[3]!;
    definitions.set(match[1]!.trim().toLowerCase(), target);
    links.push(target);
  }
  for (const match of content.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    const label = (match[2] || match[1]!).trim().toLowerCase();
    assert.ok(definitions.has(label), `缺少 Markdown 引用定义：${label}`);
  }
  return links;
}

function markdownAnchors(markdown: string): Set<string> {
  const content = withoutCode(markdown, false);
  const anchors = new Set([...content.matchAll(/<a\s+[^>]*id=["']([^"']+)["'][^>]*>/g)].map((match) => match[1]!));
  const counts = new Map<string, number>();
  for (const match of content.matchAll(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)) {
    const slug = match[1]!.replace(/<[^>]+>/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s/g, "-");
    const count = counts.get(slug) ?? 0;
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
    counts.set(slug, count + 1);
  }
  return anchors;
}

function validateSkillMetadata(metadata: string, name: string): void {
  const sections = new Map<string, Map<string, string | boolean>>();
  let section: Map<string, string | boolean> | undefined;
  for (const line of metadata.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const heading = line.match(/^(interface|policy):\s*$/);
    if (heading) {
      assert.ok(!sections.has(heading[1]!), `Skill 元数据重复区块：${name}`);
      section = new Map();
      sections.set(heading[1]!, section);
      continue;
    }
    const field = line.match(/^  ([a-z_]+):\s*(.+)$/);
    assert.ok(section && field, `Skill 元数据不符合包内 YAML 字段格式：${name}`);
    assert.ok(!section.has(field[1]!), `Skill 元数据重复字段：${name}/${field[1]}`);
    const value = field[2]!;
    assert.ok(value === "true" || value === "false" || /^"(?:[^"\\]|\\.)*"$/.test(value), `Skill 元数据必须使用布尔或双引号字符串：${name}`);
    section.set(field[1]!, JSON.parse(value) as string | boolean);
  }
  const display = sections.get("interface");
  assert.deepEqual([...display?.keys() ?? []].sort(), ["default_prompt", "display_name", "short_description"], `Skill 元数据缺少或包含未知界面字段：${name}`);
  for (const value of display!.values()) assert.ok(typeof value === "string" && value.trim(), `Skill 元数据文本不得为空：${name}`);
  assert.match(display!.get("default_prompt") as string, new RegExp(`\\$(?:stoneplugins:)?${name}(?![A-Za-z0-9_:-])`), `Skill 默认提示必须引用自身入口：${name}`);
  const policy = sections.get("policy");
  assert.deepEqual([...policy?.keys() ?? []], ["allow_implicit_invocation"], `Skill 元数据必须声明 implicit policy：${name}`);
  assert.equal(policy!.get("allow_implicit_invocation"), true, `Skill 必须允许 implicit invocation：${name}`);
}

/** 检查完整安装包；不依赖作者 checkout，也不把本地检查当作宿主行为验收。 */
export function validateDocumentWorkflow(pluginRoot: string, options: { release?: boolean } = {}): string[] {
  const root = path.resolve(pluginRoot);
  const realRoot = realpathSync(root);
  const resources = new Set<string>();
  const requireResource = (file: string, directory = false): void => {
    assert.ok(inside(root, file), `插件资源不得逃逸包根：${path.relative(root, file)}`);
    assert.ok(existsSync(file), `缺少插件资源：${path.relative(root, file)}`);
    assert.ok(inside(realRoot, realpathSync(file)), `插件资源不得通过软链接逃逸包根：${path.relative(root, file)}`);
    assert.ok(directory ? statSync(file).isDirectory() : statSync(file).isFile(), `插件资源类型错误：${path.relative(root, file)}`);
    if (!directory) resources.add(file);
  };

  const skillsRoot = path.join(root, "skills");
  requireResource(skillsRoot, true);
  assert.deepEqual(readdirSync(skillsRoot).sort(), SKILL_NAMES, "插件必须且只能包含四项技能 engineering/task/verify/review");
  const discovered: string[] = [];
  const visitedDirectories = new Set<string>();
  const discover = (directory: string): void => {
    requireResource(directory, true);
    const realDirectory = realpathSync(directory);
    assert.ok(!visitedDirectories.has(realDirectory), "Skill 目录必须有唯一来源，不得循环或重复发现");
    visitedDirectories.add(realDirectory);
    for (const name of readdirSync(directory)) {
      const file = path.join(directory, name);
      assert.ok(existsSync(file), `缺少插件资源：${path.relative(root, file)}`);
      if (statSync(file).isDirectory()) discover(file);
      else if (name === "SKILL.md") {
        requireResource(file);
        discovered.push(path.relative(skillsRoot, file));
      }
    }
  };
  discover(skillsRoot);
  assert.deepEqual(discovered.sort(), SKILL_NAMES.map((name) => `${name}/SKILL.md`), "四项 Skill 必须分别只有唯一包内发现入口");

  const markdownFiles: string[] = [];
  for (const name of SKILL_NAMES) {
    const skillPath = path.join(skillsRoot, name, "SKILL.md");
    const skill = readFileSync(skillPath, "utf8");
    const frontmatter = skill.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    assert.ok(frontmatter, `Skill 必须包含完整 frontmatter：${name}`);
    const fields = frontmatter[1]!.replace(/\r\n/g, "\n");
    assert.equal(fields.split("\n").length, 2, `Skill frontmatter 只包含 name、description 单行字段：${name}`);
    assert.match(fields, new RegExp(`^name: (?:${name}|"${name}"|'${name}')$`, "m"), `Skill frontmatter 名称不匹配：${name}`);
    const description = fields.match(/^description: ("(?:[^"\\\r\n]|\\.)+")$/m);
    assert.ok(description, `Skill frontmatter description 必须为双引号字符串：${name}`);
    assert.ok((JSON.parse(description[1]!) as string).trim(), `Skill frontmatter description 不得为空：${name}`);
    assert.ok(skill.slice(frontmatter[0].length).trim(), `Skill 正文不得为空：${name}`);
    markdownFiles.push(skillPath);
    const metadataPath = path.join(skillsRoot, name, "agents/openai.yaml");
    requireResource(metadataPath);
    validateSkillMetadata(readFileSync(metadataPath, "utf8"), name);
  }

  const docsRoot = path.join(root, "references/docs-system");
  const sourcePath = path.join(docsRoot, "source.json");
  requireResource(sourcePath);
  const source = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceManifest;
  assert.ok(source && typeof source === "object", "来源清单必须为对象");
  assert.equal(source.sourceRepository, SOURCE_REPOSITORY, "来源清单必须指向 StoneDocs 作者源");
  assert.ok(typeof source.baseCommit === "string" && /^[a-f0-9]{40}$/.test(source.baseCommit), "来源清单必须包含完整 baseCommit");
  assert.ok(source.sourceState === "working-tree" || source.sourceState === "commit", "来源清单 sourceState 非法");
  if (options.release) assert.equal(source.sourceState, "commit", "working-tree 来源仅可本地验证，不得发布");
  assert.ok(Array.isArray(source.files) && source.files.length === 2, "来源清单必须且只能包含 SOP 与模板");
  assert.deepEqual(source.files.map((file) => file?.bundledPath).sort(), ["sop.md", "templates.md"], "来源清单必须唯一包含 SOP 与模板");
  for (const file of source.files) {
    assert.equal(file.sourcePath, `docs/${file.bundledPath}`, "来源清单 sourcePath 不匹配");
    assert.ok(typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256), "来源清单 SHA-256 格式错误");
    const bundled = path.resolve(docsRoot, file.bundledPath);
    requireResource(bundled);
    assert.equal(createHash("sha256").update(readFileSync(bundled)).digest("hex"), file.sha256, `来源快照 SHA-256 不匹配：${file.bundledPath}`);
    markdownFiles.push(bundled);
  }

  const checked = new Set<string>();
  for (let index = 0; index < markdownFiles.length; index++) {
    const file = markdownFiles[index]!;
    if (checked.has(file)) continue;
    checked.add(file);
    const markdown = readFileSync(file, "utf8");
    assert.ok(markdown.trim(), `Markdown 资源不得为空：${path.relative(root, file)}`);
    for (const target of markdownLinks(markdown)) {
      if (/^https?:\/\//i.test(target)) continue;
      assert.ok(!/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target), `插件资源必须使用包内相对路径，不得逃逸：${target}`);
      const anchorIndex = target.indexOf("#");
      const encodedPath = anchorIndex < 0 ? target : target.slice(0, anchorIndex);
      const encodedAnchor = anchorIndex < 0 ? undefined : target.slice(anchorIndex + 1);
      const destination = path.resolve(path.dirname(file), decodeURIComponent(encodedPath).replace(/\\([()])/g, "$1") || path.basename(file));
      requireResource(destination);
      if (path.extname(destination).toLowerCase() === ".md") {
        markdownFiles.push(destination);
        if (encodedAnchor) assert.ok(markdownAnchors(readFileSync(destination, "utf8")).has(decodeURIComponent(encodedAnchor)), `缺少 Markdown 锚点：${target}`);
      }
    }
  }
  return [...resources].sort();
}
