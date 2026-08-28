#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_NAME = "stonefish-engineering";
const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", PLUGIN_NAME);
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
const methodologyIndexPath = path.join(
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
  marketplacePath,
  hooksPath,
  pluginPackagePath,
  hookSourcePath,
  hookRuntimePath,
  skillPath,
  skillMetadataPath,
  methodologyIndexPath,
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
requireFile(path.join(REPO_ROOT, "docs", "evals", `v${manifest.version}.md`));
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
assert.doesNotMatch(
  skill,
  /\*\*(?:结果|事实|决定|主要收益|未选方案)[：:]\*\*/,
  "加粗标签的标点必须放在强调标记外，例如 **结果**：",
);
for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
  requireFile(path.join(path.dirname(skillPath), match[1]));
}

console.log(`Repository validation passed: ${PLUGIN_NAME}@${manifest.version}`);
