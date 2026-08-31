#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

// `npm run build` generates the dependency-free JavaScript Hook runtime in ../hooks/.

const ALLOWED_EVENTS = new Set([
  "SessionStart",
  "SubagentStart",
  "UserPromptSubmit",
]);
const PROMPT_REMINDER =
  "石头鱼的工程规则：本轮工程决定须由完整常驻工程执行契约从理解、设计、实施到验证共同形成，并按真实信号采用条件方法；本提醒只维持连续性，不证明核心规则已送达。不得退化为事后检查、方法名签到，或先形成方案再补规则。";

type HookEventName = "SessionStart" | "SubagentStart" | "UserPromptSubmit";
type HookInput = {
  hook_event_name: HookEventName;
};
type HookEnvironment = Readonly<Record<string, string | undefined>>;

class SafeHookError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function parseHookInput(rawInput: string): HookInput {
  let input: unknown;
  try {
    input = JSON.parse(rawInput.replace(/^\uFEFF/, ""));
  } catch {
    throw new SafeHookError("输入不是有效 JSON");
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SafeHookError("输入必须是 JSON 对象");
  }

  const record = input as Record<string, unknown>;
  if (
    typeof record.hook_event_name !== "string" ||
    !ALLOWED_EVENTS.has(record.hook_event_name)
  ) {
    throw new SafeHookError("Hook 事件不受支持");
  }
  return {
    hook_event_name: record.hook_event_name as HookEventName,
  };
}

function stripFrontmatter(markdown: string): string {
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

function pluginRootFromEnv(env: HookEnvironment): string {
  const pluginRoot = env.PLUGIN_ROOT?.trim();
  if (!pluginRoot || !path.isAbsolute(pluginRoot)) {
    throw new SafeHookError("PLUGIN_ROOT 无效");
  }
  return pluginRoot;
}

async function readCoreContext(env: HookEnvironment) {
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
  if (
    !/^# 石头鱼的工程规则$/m.test(rules) ||
    !/^## 常驻工程执行契约$/m.test(rules) ||
    !/^## 工作顺序$/m.test(rules) ||
    !rules.endsWith("<!-- SF_END -->")
  ) {
    throw new SafeHookError("规则正文无效");
  }
  const skillRoot = path.dirname(skillPath);
  return {
    version,
    context: [
      `STONEFISH ENGINEERING ACTIVE — v${version}`,
      `Skill source: ${skillPath}`,
      `Resolve bundled relative references from: ${skillRoot}`,
      "以下是已安装的 $stonefish-engineering 核心规则；需要细则时，按正文说明读取 references 中的对应文件。",
      "",
      rules,
    ].join("\n"),
  };
}

async function buildHookOutput(
  input: HookInput,
  env: HookEnvironment = process.env,
) {
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
} catch (error: unknown) {
  const code = error instanceof SafeHookError ? error.code : "未知错误";
  output = {
    systemMessage: `未能加载石头鱼的工程规则：${code}。`,
  };
}

process.stdout.write(JSON.stringify(output));
