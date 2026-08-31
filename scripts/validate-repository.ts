#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_NAME = "stonefish-engineering";
const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", PLUGIN_NAME);
const RELEASE_MODE = process.argv.includes("--release");
const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const HOOK_COMMAND = 'node "${PLUGIN_ROOT}/hooks/inject-context.js"';
const CORE_CONTEXT_TOKEN_LIMIT = 6_000;
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
            additionalContextLimit: CORE_CONTEXT_TOKEN_LIMIT,
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
            additionalContextLimit: CORE_CONTEXT_TOKEN_LIMIT,
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
  skills: string;
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
const skillPath = path.join(
  PLUGIN_ROOT,
  "skills",
  PLUGIN_NAME,
  "SKILL.md",
);
const skillMetadataPath = path.join(
  PLUGIN_ROOT,
  "skills",
  PLUGIN_NAME,
  "agents",
  "openai.yaml",
);
const methodSelectionPath = path.join(
  PLUGIN_ROOT,
  "skills",
  PLUGIN_NAME,
  "references",
  "method-selection.md",
);
const decisionSummaryPath = path.join(
  PLUGIN_ROOT,
  "skills",
  PLUGIN_NAME,
  "references",
  "decision-summary.md",
);
const legacyMethodologyIndexPath = path.join(
  PLUGIN_ROOT,
  "skills",
  PLUGIN_NAME,
  "references",
  "methodology-index.md",
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
  methodSelectionPath,
  decisionSummaryPath,
  methodologiesPath,
  behaviorCasesPath,
  personalAgentsExamplePath,
  contextPath,
  decisionAdrPath,
  persistentContractAdrPath,
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
    methodSelectionPath,
    decisionSummaryPath,
    currentEvalPath,
    methodologiesPath,
    behaviorCasesPath,
    personalAgentsExamplePath,
    persistentContractAdrPath,
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
  existsSync(legacyMethodologyIndexPath),
  false,
  "多职责 methodology-index.md 必须拆分为运行时选择器与非运行时治理资料",
);
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
assert.equal(manifest.skills, "./skills/");
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
const entry = marketplace.plugins.find((plugin) => plugin.name === PLUGIN_NAME);
assert.ok(entry, `marketplace 缺少 ${PLUGIN_NAME}`);
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
  /^\s*allow_implicit_invocation:\s*false\s*$/m,
  "Hook 是唯一自动规则所有者，Skill 只能显式调用",
);

const skill = readFileSync(skillPath, "utf8");
assert.equal(
  skill.split("## 常驻工程执行契约").length - 1,
  1,
  "核心 Skill 必须且只能定义一次常驻工程执行契约",
);
assert.doesNotMatch(skill, /## 常驻工程检查/);
assert.match(skill, /必须共同参与每项工程决定的形成/);
assert.match(skill, /不是交付前检查表/);
assert.match(skill, /不得先形成方案再做方法论签到/);
assert.match(skill, /知识级 DRY 消除必须同步变化的业务知识/);
assert.match(skill, /整洁架构与六边形架构的领域独立、依赖方向和边界原则始终参与设计/);
assert.match(skill, /允许推荐破坏性重构/);
assert.match(skill, /references\/method-selection\.md/);
assert.match(skill, /references\/decision-summary\.md/);
assert.doesNotMatch(skill, /references\/methodology-index\.md/);
assert.equal(
  skill.trimEnd().endsWith("<!-- SF_END -->"),
  true,
  "核心 Skill 必须保留 EOF 完整性标记",
);
assert.equal(
  skill.split("<!-- SF_END -->").length - 1,
  1,
  "核心 Skill 的 EOF 完整性标记必须唯一",
);
for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
  const referencePath = path.join(path.dirname(skillPath), match[1]);
  requireFile(referencePath);
  if (RELEASE_MODE) requireTrackedFile(referencePath);
}

const methodSelection = readFileSync(methodSelectionPath, "utf8");
for (const method of [
  "Functional Core / Imperative Shell",
  "Bounded Context",
  "REP、CCP、CRP、ADP、SDP、SAP",
  "Tidy First",
  "Strangler Fig",
  "Characterization Testing",
  "Threat Modeling",
  "Fitness Functions",
]) {
  assert.match(
    methodSelection,
    new RegExp(method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `条件方法选择器缺少方法族：${method}`,
  );
}
for (const match of methodSelection.matchAll(/\]\(([^)]+\.md)\)/g)) {
  const referencePath = path.join(path.dirname(methodSelectionPath), match[1]);
  requireFile(referencePath);
  if (RELEASE_MODE) requireTrackedFile(referencePath);
}

const decisionSummary = readFileSync(decisionSummaryPath, "utf8");
const disclosureHeading = "## 🧭 为什么这样做（石头鱼的工程规则）";
assert.equal(
  decisionSummary.split(disclosureHeading).length - 1,
  1,
  "公开决策标题必须且只能由 decision-summary.md 定义一次",
);
assert.match(decisionSummary, /完整常驻工程执行契约共同形成方案/);
assert.match(decisionSummary, /事实与约束 → 方法的具体作用 → 决定 → 影响与取舍/);
assert.match(decisionSummary, /关键决定 \| 方法论如何产生决定 \| 结果 \| 影响与取舍/);
assert.doesNotMatch(decisionSummary, /本次决策与方法论（石头鱼的工程规则）/);
assert.doesNotMatch(
  decisionSummary,
  /\*\*(?:为什么这样做|影响与取舍|验证证据)[：:]\*\*/,
  "加粗标签的标点必须放在强调标记外",
);

const methodologies = readFileSync(methodologiesPath, "utf8");
assert.match(methodologies, /### 常驻工程执行契约/);
assert.match(methodologies, /### 条件方法/);
assert.match(methodologies, /### 研究候选与评审视角/);
assert.match(methodologies, /一手来源或真实失败/);

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
assert.match(behaviorCases, /startup、UserPromptSubmit、SubagentStart、resume、clear、compact/);

const personalAgentsExample = readFileSync(personalAgentsExamplePath, "utf8");
assert.doesNotMatch(personalAgentsExample, /\$stonefish-engineering/);
assert.doesNotMatch(personalAgentsExample, /^## 工程规则$/m);
assert.match(personalAgentsExample, /Bun/);

const readme = readFileSync(readmePath, "utf8");
assert.match(readme, /旧版石头鱼 Hook/);
assert.match(readme, /近似 token 阈值/);
assert.match(readme, /常驻工程执行契约/);
assert.match(readme, /规则送达/);
assert.match(readme, /规则落实/);
assert.match(readme, /sty20030818\/StonePlugins/);
assert.match(
  readme,
  new RegExp(`--ref v${manifest.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  "README 必须提供当前版本的固定安装示例",
);

const changelog = readFileSync(changelogPath, "utf8");
assert.match(
  changelog,
  new RegExp(`^## \\[${manifest.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m"),
  "CHANGELOG 必须包含当前版本",
);

console.log(
  `Repository validation passed: ${PLUGIN_NAME}@${manifest.version}${RELEASE_MODE ? " (release)" : ""}`,
);
