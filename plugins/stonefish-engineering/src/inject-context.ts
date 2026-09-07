#!/usr/bin/env node

import { readFileSync } from "node:fs";

// npm run build 生成无依赖的 JavaScript Hook；规则正文由独立 Skill 持有。
const LOAD_REQUIREMENT = [
  "石头鱼的工程规则：这是 Skill 加载要求，不证明正文已加载或规则已落实。",
  "工程任务须先通过宿主的 Skill 入口使用 $stonefish-engineering，完整读取该入口的 SKILL.md，再形成工程决定；不得跳过核心直接读取 references。",
  "同一技能正文已完整加载且仍在当前有效上下文中时，无需重复读取；按正文信号加载 references，并以该 Skill 所在目录解析相对路径。",
  "若未发现该技能或读取失败，先报告并暂停依赖它的工程决定，不得假装已采用；不要自动安装，也不要回退到旧插件缓存。",
  "纯文案、翻译、格式调整等非工程任务不强制加载。",
].join("\n");

const EVENT_CONTEXT = {
  SessionStart: "会话启动、恢复或压缩后的工程工作应先确认 Skill 正文仍完整可用。",
  SubagentStart: "本子 Agent 不得假定父 Agent 已加载的 Skill 正文存在于自己的上下文。",
  UserPromptSubmit: "本轮工程工作沿用已完整加载的契约；若当前上下文缺失正文，先加载 Skill。",
} as const;

type HookEventName = keyof typeof EVENT_CONTEXT;

class SafeHookError extends Error {}

function parseHookEvent(rawInput: string): HookEventName {
  let input: unknown;
  try {
    input = JSON.parse(rawInput.replace(/^\uFEFF/, ""));
  } catch {
    throw new SafeHookError("输入不是有效 JSON");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SafeHookError("输入必须是 JSON 对象");
  }
  const event = (input as Record<string, unknown>).hook_event_name;
  if (typeof event !== "string" || !Object.hasOwn(EVENT_CONTEXT, event)) {
    throw new SafeHookError("Hook 事件不受支持");
  }
  return event as HookEventName;
}

let output;
try {
  const event = parseHookEvent(readFileSync(0, "utf8"));
  output = {
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: `${EVENT_CONTEXT[event]}\n${LOAD_REQUIREMENT}`,
    },
  };
} catch (error: unknown) {
  const reason = error instanceof SafeHookError ? error.message : "未知错误";
  output = {
    systemMessage: `未能发送石头鱼的工程规则加载要求：${reason}。`,
  };
}

process.stdout.write(JSON.stringify(output));
