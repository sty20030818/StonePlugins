#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_NAME = "stoneplugins";
const SKILL_NAME = "engineering";
const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", PLUGIN_NAME);
const SKILL_ROOT = path.join(PLUGIN_ROOT, "skills", SKILL_NAME);
const RELEASE_MODE = process.argv.includes("--release");
const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const HOOK_COMMAND = 'node "${PLUGIN_ROOT}/hooks/inject-context.js"';
const EXPECTED_HOOK_CONFIG = {
  hooks: {
    SessionStart: [
      {
        matcher: "startup|resume|clear|compact",
        hooks: [
          {
            type: "command",
            command: HOOK_COMMAND,
            timeout: 5,
            statusMessage: "正在加载石头鱼的工程规则……",
          },
        ],
      },
    ],
    SubagentStart: [
      {
        hooks: [
          {
            type: "command",
            command: HOOK_COMMAND,
            timeout: 5,
            statusMessage: "正在加载石头鱼的工程规则……",
          },
        ],
      },
    ],
    UserPromptSubmit: [
      {
        hooks: [
          {
            type: "command",
            command: HOOK_COMMAND,
            timeout: 5,
          },
        ],
      },
    ],
  },
} as const;

type PluginManifest = {
  name: string;
  version: string;
  skills?: unknown;
  hooks?: unknown;
  author?: { name?: string };
  license: string;
  interface?: {
    composerIcon?: string;
    logo?: string;
    defaultPrompt?: string[];
  };
};

type Marketplace = {
  name: string;
  plugins: Array<{
    name: string;
    source: unknown;
    policy?: { installation?: string; authentication?: string };
  }>;
};

type RepositoryPackage = {
  version: string;
};

type PluginPackage = {
  private: boolean;
  type: string;
};

type RepositoryPackageLock = {
  version: string;
  packages: { "": { version: string } };
};

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function requireFile(file: string): void {
  assert.ok(existsSync(file), `缺少文件：${path.relative(REPO_ROOT, file)}`);
  if (file.startsWith(`${PLUGIN_ROOT}${path.sep}`)) {
    assert.ok(
      realpathSync(file).startsWith(`${realpathSync(PLUGIN_ROOT)}${path.sep}`),
      `插件资源不得通过软链接逃逸包根：${path.relative(PLUGIN_ROOT, file)}`,
    );
  }
}

function requireTrackedFile(file: string): void {
  requireFile(file);
  const relative = path.relative(REPO_ROOT, file);
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", relative], {
      cwd: REPO_ROOT,
      stdio: "ignore",
    });
  } catch {
    assert.fail(`发布文档必须由 Git 跟踪：${relative}`);
  }
}

const manifestPath = path.join(
  PLUGIN_ROOT,
  ".codex-plugin",
  "plugin.json",
);
const marketplacePath = path.join(
  REPO_ROOT,
  ".agents",
  "plugins",
  "marketplace.json",
);
const repositoryPackagePath = path.join(REPO_ROOT, "package.json");
const repositoryPackageLockPath = path.join(REPO_ROOT, "package-lock.json");
const readmePath = path.join(REPO_ROOT, "README.md");
const changelogPath = path.join(REPO_ROOT, "CHANGELOG.md");
const contextPath = path.join(REPO_ROOT, "CONTEXT.md");
const decisionAdrPath = path.join(
  REPO_ROOT,
  "docs",
  "adr",
  "0001-decision-centered-methodology-disclosure.md",
);
const persistentContractAdrPath = path.join(
  REPO_ROOT,
  "docs",
  "adr",
  "0002-persistent-execution-contract.md",
);
const independentSkillAdrPath = path.join(
  REPO_ROOT,
  "docs",
  "adr",
  "0003-independent-skill-and-loader-hooks.md",
);
const bundledSkillAdrPath = path.join(
  REPO_ROOT,
  "docs",
  "adr",
  "0004-codex-first-bundled-engineering.md",
);
const bundledDevelopmentEvalPath = path.join(
  REPO_ROOT,
  "docs",
  "evals",
  "codex-first-bundled-development.md",
);
const decisionResearchPath = path.join(
  REPO_ROOT,
  "docs",
  "research",
  "2026-08-29-engineering-rationale-copy-structure.md",
);
const persistentContractResearchPath = path.join(
  REPO_ROOT,
  "docs",
  "research",
  "2026-08-31-persistent-engineering-rules-and-evaluation.md",
);
const methodologiesPath = path.join(REPO_ROOT, "docs", "methodologies.md");
const behaviorCasesPath = path.join(
  REPO_ROOT,
  "docs",
  "evals",
  "behavior-cases.md",
);
const personalAgentsExamplePath = path.join(
  REPO_ROOT,
  "examples",
  "AGENTS.stonefish.md",
);
const hooksPath = path.join(PLUGIN_ROOT, "hooks", "hooks.json");
const pluginPackagePath = path.join(PLUGIN_ROOT, "package.json");
const hookSourcePath = path.join(PLUGIN_ROOT, "src", "inject-context.ts");
const hookRuntimePath = path.join(PLUGIN_ROOT, "hooks", "inject-context.js");
const legacyHookPaths = [
  path.join(PLUGIN_ROOT, "src", "inject-context.mts"),
  path.join(PLUGIN_ROOT, "hooks", "inject-context.mjs"),
];
const skillPath = path.join(SKILL_ROOT, "SKILL.md");
const skillMetadataPath = path.join(
  SKILL_ROOT,
  "agents",
  "openai.yaml",
);

for (const file of [
  manifestPath,
  repositoryPackagePath,
  repositoryPackageLockPath,
  readmePath,
  changelogPath,
  marketplacePath,
  hooksPath,
  pluginPackagePath,
  hookSourcePath,
  hookRuntimePath,
  skillPath,
  skillMetadataPath,
  methodologiesPath,
  behaviorCasesPath,
  personalAgentsExamplePath,
  contextPath,
  decisionAdrPath,
  persistentContractAdrPath,
  independentSkillAdrPath,
  bundledSkillAdrPath,
  bundledDevelopmentEvalPath,
  decisionResearchPath,
  persistentContractResearchPath,
]) {
  requireFile(file);
}

const manifest = readJson<PluginManifest>(manifestPath);
const repositoryPackage = readJson<RepositoryPackage>(repositoryPackagePath);
const pluginPackage = readJson<PluginPackage>(pluginPackagePath);
const repositoryPackageLock = readJson<RepositoryPackageLock>(
  repositoryPackageLockPath,
);
assert.equal(manifest.name, PLUGIN_NAME);
assert.equal(pluginPackage.private, true);
assert.equal(
  pluginPackage.type,
  "module",
  "生成的 .js Hook 必须在插件缓存中保持 ESM 语义",
);
assert.match(manifest.version, STRICT_SEMVER, "plugin version 必须是严格 SemVer");
const currentEvalPath = path.join(
  REPO_ROOT,
  "docs",
  "evals",
  `v${manifest.version}.md`,
);
requireFile(currentEvalPath);
for (const file of [contextPath, decisionAdrPath, decisionResearchPath]) {
  requireTrackedFile(file);
}
if (RELEASE_MODE) {
  for (const file of [
    manifestPath,
    marketplacePath,
    hooksPath,
    pluginPackagePath,
    hookSourcePath,
    hookRuntimePath,
    skillPath,
    skillMetadataPath,
    currentEvalPath,
    methodologiesPath,
    behaviorCasesPath,
    personalAgentsExamplePath,
    persistentContractAdrPath,
    independentSkillAdrPath,
    bundledSkillAdrPath,
    bundledDevelopmentEvalPath,
    persistentContractResearchPath,
    readmePath,
    changelogPath,
  ]) {
    requireTrackedFile(file);
  }
}
for (const file of legacyHookPaths) {
  assert.equal(
    existsSync(file),
    false,
    `不得保留旧 Hook 文件：${path.relative(REPO_ROOT, file)}`,
  );
}
assert.equal(
  repositoryPackage.version,
  manifest.version,
  "package 与 plugin manifest 版本必须一致",
);
assert.equal(
  repositoryPackageLock.version,
  manifest.version,
  "package-lock 与 plugin manifest 版本必须一致",
);
assert.equal(
  repositoryPackageLock.packages[""].version,
  manifest.version,
  "package-lock 根包与 plugin manifest 版本必须一致",
);
assert.equal(manifest.skills, "./skills/", "插件必须声明包内 Skill 目录");
assert.deepEqual(
  readdirSync(path.join(PLUGIN_ROOT, "skills")),
  [SKILL_NAME],
  "工程 Skill 必须只有唯一包内来源",
);
for (const legacyPath of [
  path.join(REPO_ROOT, "plugins", "stonefish-engineering"),
  path.join(REPO_ROOT, "skills", "stonefish-engineering"),
  path.join(REPO_ROOT, "skills", SKILL_NAME),
]) {
  assert.equal(
    existsSync(legacyPath),
    false,
    `不得保留旧入口或根目录 Skill 副本：${path.relative(REPO_ROOT, legacyPath)}`,
  );
}
assert.ok(!Object.hasOwn(manifest, "hooks"), "默认 hooks/hooks.json 不应在 manifest 重复声明");
assert.notEqual(manifest.author?.name, "Local developer");
assert.equal(manifest.license, "MIT");
assert.equal(manifest.interface?.composerIcon, "./assets/icon.jpg");
assert.equal(manifest.interface?.logo, "./assets/icon.jpg");
requireFile(path.join(PLUGIN_ROOT, "assets", "icon.jpg"));
assert.ok(Array.isArray(manifest.interface?.defaultPrompt));
assert.ok(manifest.interface.defaultPrompt.length <= 3);
for (const prompt of manifest.interface.defaultPrompt) {
  assert.ok(prompt.length <= 128, "defaultPrompt 不得超过 128 字符");
}

const marketplace = readJson<Marketplace>(marketplacePath);
assert.equal(marketplace.name, "stonefish");
const entries = marketplace.plugins.filter((plugin) => plugin.name === PLUGIN_NAME);
assert.equal(entries.length, 1, `marketplace 必须且只能包含一个 ${PLUGIN_NAME}`);
assert.ok(
  marketplace.plugins.every((plugin) => plugin.name !== "stonefish-engineering"),
  "marketplace 不得保留旧插件入口",
);
const entry = entries[0];
assert.deepEqual(entry.source, {
  source: "local",
  path: `./plugins/${PLUGIN_NAME}`,
});
assert.equal(entry.policy?.installation, "AVAILABLE");
assert.equal(entry.policy?.authentication, "ON_INSTALL");

assert.deepEqual(
  readJson<unknown>(hooksPath),
  EXPECTED_HOOK_CONFIG,
  "Hook 配置必须保持精确的单 group、单 handler 允许列表",
);

const skillMetadata = readFileSync(skillMetadataPath, "utf8");
assert.match(
  skillMetadata,
  /^\s*allow_implicit_invocation:\s*true\s*$/m,
  "Skill 必须允许宿主按任务自动发现和加载",
);
assert.match(
  skillMetadata,
  /^\s*default_prompt:.*\$engineering\b/m,
  "Skill 默认提示必须使用可独立调用的 $engineering 名称",
);

const skill = readFileSync(skillPath, "utf8");
const frontmatter = skill.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n/);
assert.ok(frontmatter, "Skill 必须包含完整 frontmatter");
const skillFields = frontmatter[1].replace(/\r\n/g, "\n");
assert.equal(skillFields.split("\n").length, 2, "本包 Skill 元数据只包含 name、description 两个单行字段");
assert.match(skillFields, new RegExp(`^name: (?:${SKILL_NAME}|"${SKILL_NAME}"|'${SKILL_NAME}')$`, "m"));
assert.match(skillFields, /^description: "[^"\r\n]+"$/m);
const body = skill.slice(frontmatter[0].length);
assert.ok(body.trim(), "Skill 正文不得为空");
const references = [...body.matchAll(/\]\((references\/[^)]+)\)/g)];
assert.ok(references.length > 0, "Skill 必须提供按需细则入口");
for (const match of references) {
  const referencePath = path.resolve(SKILL_ROOT, match[1]);
  assert.ok(
    referencePath.startsWith(`${PLUGIN_ROOT}${path.sep}`),
    `Skill 引用不得逃逸插件包：${match[1]}`,
  );
  requireFile(referencePath);
  assert.ok(readFileSync(referencePath, "utf8").trim(), `Skill 引用不得为空：${match[1]}`);
  if (RELEASE_MODE) requireTrackedFile(referencePath);
}

const behaviorCases = readFileSync(behaviorCasesPath, "utf8");
for (const id of [
  "OWNER-1",
  "DRY-1",
  "SIMPLE-1",
  "ARCH-1",
  "MIGRATION-1",
  "MIGRATION-2",
  "REFACTOR-1",
  "TEST-1",
  "RISK-1",
  "SCOPE-1",
]) {
  assert.match(behaviorCases, new RegExp(id), `行为评测缺少案例：${id}`);
}

const personalAgentsExample = readFileSync(personalAgentsExamplePath, "utf8");
assert.match(personalAgentsExample, /\$stoneplugins:engineering/);

const readme = readFileSync(readmePath, "utf8");
assert.match(readme, /sty20030818\/StonePlugins/);
assert.ok(readme.includes("plugins/stoneplugins/skills/engineering/SKILL.md"));
assert.ok(readme.includes("docs/adr/0004-codex-first-bundled-engineering.md"));
if (RELEASE_MODE) {
  assert.match(
    readme,
    new RegExp(`--ref v${manifest.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    "发布 README 必须提供与 manifest 版本一致的固定安装示例",
  );
}

const changelog = readFileSync(changelogPath, "utf8");
assert.match(
  changelog,
  new RegExp(`^## \\[${manifest.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m"),
  "CHANGELOG 必须包含当前版本",
);

console.log(
  `Repository validation passed: ${PLUGIN_NAME}@${manifest.version}${RELEASE_MODE ? " (release)" : ""}`,
);
