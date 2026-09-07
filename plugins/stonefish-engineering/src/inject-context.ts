#!/usr/bin/env node

import { readFileSync } from "node:fs";

// npm run build 生成无依赖的 JavaScript Hook；规则正文由独立 Skill 持有。
const FAILURE_CONTEXT =
  "读取失败则报告并暂停工程决定，不自动安装，也不回退旧缓存。";

const EVENT_CONTEXT = {
  SessionStart:
    "会话启动、恢复或清空后，工程任务若尚未完整加载 $stonefish-engineering，先通过宿主 Skill 入口读取其 SKILL.md；已加载则沿用，边界不清时加载。",
  SubagentStart:
    "子 Agent 上下文独立。工程任务须先通过宿主 Skill 入口完整读取 $stonefish-engineering 的 SKILL.md，不得沿用父 Agent 的加载声明。",
  UserPromptSubmit:
    "工程任务若尚未完整加载 $stonefish-engineering，先通过宿主 Skill 入口读取其 SKILL.md；已加载则沿用，边界不清时加载。",
} as const;

const COMPACT_CONTEXT =
  "压缩已发生。形成工程决定前，无条件通过宿主 Skill 入口重新完整读取 $stonefish-engineering 的 SKILL.md。";

type HookEventName = keyof typeof EVENT_CONTEXT;

class SafeHookError extends Error {}

function parseHookInput(rawInput: string): { event: HookEventName; compact: boolean } {
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
  const event = record.hook_event_name;
  if (typeof event !== "string" || !Object.hasOwn(EVENT_CONTEXT, event)) {
    throw new SafeHookError("Hook 事件不受支持");
  }
  return {
    event: event as HookEventName,
    compact: event === "SessionStart" && record.source === "compact",
  };
}

let output;
try {
  const { event, compact } = parseHookInput(readFileSync(0, "utf8"));
  const requirement = compact ? COMPACT_CONTEXT : EVENT_CONTEXT[event];
  output = {
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: `${requirement}\n${FAILURE_CONTEXT}`,
    },
  };
} catch (error: unknown) {
  const reason = error instanceof SafeHookError ? error.message : "未知错误";
  output = {
    systemMessage: `未能发送石头鱼的工程规则加载要求：${reason}。`,
  };
}

process.stdout.write(JSON.stringify(output));
