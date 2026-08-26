#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_NAME = "stonefish-engineering";
const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", PLUGIN_NAME);
const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

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

type HookConfig = {
  hooks: Record<
    string,
    Array<{
      hooks?: Array<{ type?: string; command?: string; timeout?: number }>;
    }>
  >;
};

type RepositoryPackage = {
  version: string;
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
const hooksPath = path.join(PLUGIN_ROOT, "hooks", "hooks.json");
const hookSourcePath = path.join(PLUGIN_ROOT, "src", "inject-context.mts");
const hookRuntimePath = path.join(PLUGIN_ROOT, "hooks", "inject-context.mjs");
const skillPath = path.join(
  PLUGIN_ROOT,
  "skills",
  PLUGIN_NAME,
  "SKILL.md",
);

for (const file of [
  manifestPath,
  repositoryPackagePath,
  marketplacePath,
  hooksPath,
  hookSourcePath,
  hookRuntimePath,
  skillPath,
]) {
  requireFile(file);
}

const manifest = readJson<PluginManifest>(manifestPath);
const repositoryPackage = readJson<RepositoryPackage>(repositoryPackagePath);
assert.equal(manifest.name, PLUGIN_NAME);
assert.match(manifest.version, STRICT_SEMVER, "plugin version 必须是严格 SemVer");
assert.equal(
  repositoryPackage.version,
  manifest.version,
  "package 与 plugin manifest 版本必须一致",
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

const hooks = readJson<HookConfig>(hooksPath).hooks;
assert.deepEqual(Object.keys(hooks).sort(), [
  "SessionStart",
  "SubagentStart",
  "UserPromptSubmit",
]);
for (const event of Object.values(hooks)) {
  const handler = event[0]?.hooks?.[0];
  assert.equal(handler?.type, "command");
  assert.equal(
    handler?.command,
    'node "${PLUGIN_ROOT}/hooks/inject-context.mjs"',
  );
  assert.ok((handler?.timeout ?? Infinity) <= 5, "Hook timeout 应保持短小");
}

const skill = readFileSync(skillPath, "utf8");
for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
  requireFile(path.join(path.dirname(skillPath), match[1]));
}

console.log(`Repository validation passed: ${PLUGIN_NAME}@${manifest.version}`);
