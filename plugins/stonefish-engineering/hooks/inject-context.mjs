#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_EVENTS = new Set([
  "SessionStart",
  "SubagentStart",
  "UserPromptSubmit",
]);
const PROMPT_REMINDER =
  "Stonefish Engineering 仍然生效：工程任务应加载 $stonefish-engineering；项目明确约束优先，选择最小完整、长期连贯且可验证的方案。";

class SafeHookError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function parseHookInput(rawInput) {
  let input;
  try {
    input = JSON.parse(rawInput.replace(/^\uFEFF/, ""));
  } catch {
    throw new SafeHookError("输入不是有效 JSON");
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SafeHookError("输入必须是 JSON 对象");
  }
  if (!ALLOWED_EVENTS.has(input.hook_event_name)) {
    throw new SafeHookError("Hook 事件不受支持");
  }
  if (
    input.hook_event_name === "UserPromptSubmit" &&
    typeof input.prompt !== "string"
  ) {
    throw new SafeHookError("提示内容类型无效");
  }

  return input;
}

function stripFrontmatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return normalized.trim();
  }

  const match = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!match) {
    throw new SafeHookError("规则文件 frontmatter 无效");
  }
  return normalized.slice(match[0].length).trim();
}

function pluginRootFromEnv(env) {
  const pluginRoot = env.PLUGIN_ROOT?.trim();
  if (!pluginRoot || !path.isAbsolute(pluginRoot)) {
    throw new SafeHookError("PLUGIN_ROOT 无效");
  }
  return pluginRoot;
}

async function readCoreContext(env) {
  const pluginRoot = pluginRootFromEnv(env);
  const skillPath = path.join(
    pluginRoot,
    "skills",
    "stonefish-engineering",
    "SKILL.md",
  );
  const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");

  let skill;
  let manifest;
  try {
    [skill, manifest] = await Promise.all([
      readFile(skillPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
  } catch {
    throw new SafeHookError("插件规则或 manifest 不可读");
  }

  let version;
  try {
    version = JSON.parse(manifest).version;
  } catch {
    throw new SafeHookError("manifest 不是有效 JSON");
  }
  if (typeof version !== "string" || !version) {
    throw new SafeHookError("manifest 缺少版本");
  }

  const rules = stripFrontmatter(skill);
  const skillRoot = path.dirname(skillPath);
  return {
    version,
    context: [
      `STONEFISH ENGINEERING ACTIVE — v${version}`,
      `Skill source: ${skillPath}`,
      `Resolve bundled relative references from: ${skillRoot}`,
      "以下内容来自已安装的 $stonefish-engineering 核心；需要详细规则时按其中路由读取 references。",
      "",
      rules,
    ].join("\n"),
  };
}

async function buildHookOutput(input, env = process.env) {
  if (input.hook_event_name === "UserPromptSubmit") {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: PROMPT_REMINDER,
      },
    };
  }

  const { context } = await readCoreContext(env);
  return {
    hookSpecificOutput: {
      hookEventName: input.hook_event_name,
      additionalContext: context,
    },
  };
}

let output;
try {
  const input = parseHookInput(readFileSync(0, "utf8"));
  output = await buildHookOutput(input);
} catch (error) {
  const code = error instanceof SafeHookError ? error.code : "未知错误";
  output = {
    systemMessage: `Stonefish Engineering Hook 未加载：${code}。`,
  };
}

process.stdout.write(JSON.stringify(output));
