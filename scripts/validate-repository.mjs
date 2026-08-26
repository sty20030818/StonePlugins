#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_NAME = "stonefish-engineering";
const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", PLUGIN_NAME);
const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function requireFile(file) {
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
const hooksPath = path.join(PLUGIN_ROOT, "hooks", "hooks.json");
const skillPath = path.join(
  PLUGIN_ROOT,
  "skills",
  PLUGIN_NAME,
  "SKILL.md",
);

for (const file of [manifestPath, marketplacePath, hooksPath, skillPath]) {
  requireFile(file);
}

const manifest = readJson(manifestPath);
assert.equal(manifest.name, PLUGIN_NAME);
assert.match(manifest.version, STRICT_SEMVER, "plugin version 必须是严格 SemVer");
assert.equal(manifest.skills, "./skills/");
assert.ok(!Object.hasOwn(manifest, "hooks"), "默认 hooks/hooks.json 不应在 manifest 重复声明");
assert.notEqual(manifest.author?.name, "Local developer");
assert.equal(manifest.license, "MIT");
assert.ok(Array.isArray(manifest.interface?.defaultPrompt));
assert.ok(manifest.interface.defaultPrompt.length <= 3);
for (const prompt of manifest.interface.defaultPrompt) {
  assert.ok(prompt.length <= 128, "defaultPrompt 不得超过 128 字符");
}

const marketplace = readJson(marketplacePath);
assert.equal(marketplace.name, "stonefish");
const entry = marketplace.plugins.find((plugin) => plugin.name === PLUGIN_NAME);
assert.ok(entry, `marketplace 缺少 ${PLUGIN_NAME}`);
assert.deepEqual(entry.source, {
  source: "local",
  path: `./plugins/${PLUGIN_NAME}`,
});
assert.equal(entry.policy?.installation, "AVAILABLE");
assert.equal(entry.policy?.authentication, "ON_INSTALL");

const hooks = readJson(hooksPath).hooks;
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
  assert.ok(handler.timeout <= 5, "Hook timeout 应保持短小");
}

const skill = readFileSync(skillPath, "utf8");
for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
  requireFile(path.join(path.dirname(skillPath), match[1]));
}

console.log(`Repository validation passed: ${PLUGIN_NAME}@${manifest.version}`);
