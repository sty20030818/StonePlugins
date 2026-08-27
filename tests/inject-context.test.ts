import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_ROOT = path.join(
  REPO_ROOT,
  "plugins",
  "stonefish-engineering",
);
const HOOKS_DIR = path.join(PLUGIN_ROOT, "hooks");
const SCRIPT = path.join(HOOKS_DIR, "inject-context.mjs");
const PLUGIN_VERSION = (
  JSON.parse(
    readFileSync(
      path.join(PLUGIN_ROOT, ".codex-plugin", "plugin.json"),
      "utf8",
    ),
  ) as { version: string }
).version;

type RunHookOptions = { pluginRoot?: string };

type HookConfig = {
  hooks: Record<
    string,
    Array<{ matcher?: string; hooks: Array<{ command: string }> }>
  >;
};

const CORE_CONTEXT_BYTE_LIMIT = 6_000;

function runHook(input: unknown, options: RunHookOptions = {}) {
  const env = { ...process.env };
  if (Object.hasOwn(options, "pluginRoot")) {
    if (options.pluginRoot === undefined) delete env.PLUGIN_ROOT;
    else env.PLUGIN_ROOT = options.pluginRoot;
  } else {
    env.PLUGIN_ROOT = PLUGIN_ROOT;
  }

  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env,
    input: typeof input === "string" ? input : JSON.stringify(input),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return { output: JSON.parse(result.stdout), raw: result.stdout };
}

test("Hook 配置覆盖三个事件并通过 PLUGIN_ROOT 启动同一脚本", () => {
  const config = JSON.parse(
    readFileSync(path.join(HOOKS_DIR, "hooks.json"), "utf8"),
  ) as HookConfig;
  assert.deepEqual(Object.keys(config.hooks).sort(), [
    "SessionStart",
    "SubagentStart",
    "UserPromptSubmit",
  ]);
  assert.equal(
    config.hooks.SessionStart[0].matcher,
    "startup|resume|clear|compact",
  );

  for (const event of Object.values(config.hooks)) {
    assert.equal(
      event[0].hooks[0].command,
      'node "${PLUGIN_ROOT}/hooks/inject-context.mjs"',
    );
  }
});

test("SessionStart compact 与 SubagentStart 注入同一份有体积上限的核心", () => {
  const contexts: string[] = [];
  for (const hook_event_name of ["SessionStart", "SubagentStart"]) {
    const { output } = runHook({
      hook_event_name,
      ...(hook_event_name === "SessionStart"
        ? { source: "compact" }
        : { agent_type: "worker" }),
    });
    const context = output.hookSpecificOutput.additionalContext as string;
    contexts.push(context);
    assert.equal(output.hookSpecificOutput.hookEventName, hook_event_name);
    assert.equal(output.systemMessage, undefined);
    assert.ok(
      context.includes(`STONEFISH ENGINEERING ACTIVE — v${PLUGIN_VERSION}`),
    );
    assert.match(
      context,
      new RegExp(PLUGIN_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.match(context, /# 石头鱼的工程规则/);
    assert.doesNotMatch(context, /^---/m);
    assert.doesNotMatch(context, /^name:/m);
    assert.doesNotMatch(context, /^# 架构与长期变更$/m);
    assert.doesNotMatch(context, /^# 修改边界、依赖与迁移$/m);
    assert.doesNotMatch(context, /^# 验证、诊断与审查$/m);
    assert.ok(
      Buffer.byteLength(context, "utf8") <= CORE_CONTEXT_BYTE_LIMIT,
      `核心注入超过 ${CORE_CONTEXT_BYTE_LIMIT} bytes`,
    );
  }
  assert.equal(contexts[0], contexts[1]);
});

test("UserPromptSubmit 固定注入短提醒且不读取或回显用户提示", () => {
  const secret = "TOKEN_SENTINEL_MUST_NOT_LEAK";
  const { output, raw } = runHook({
    hook_event_name: "UserPromptSubmit",
    prompt: secret,
  });
  const second = runHook({
    hook_event_name: "UserPromptSubmit",
    prompt: "完全不同的架构讨论",
  });

  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /^石头鱼的工程规则/);
  assert.doesNotMatch(
    output.hookSpecificOutput.additionalContext,
    /\$stonefish-engineering/,
  );
  assert.doesNotMatch(
    output.hookSpecificOutput.additionalContext,
    /工程设计、实现与验证/,
  );
  assert.equal(
    output.hookSpecificOutput.additionalContext,
    second.output.hookSpecificOutput.additionalContext,
  );
  assert.doesNotMatch(raw, new RegExp(secret));
});

test("无效输入和缺失 PLUGIN_ROOT 只返回安全 systemMessage", () => {
  const secret = "private-token-value";
  const invalid = runHook(`{\"token\":\"${secret}\"`);
  assert.match(invalid.output.systemMessage, /输入不是有效 JSON/);
  assert.doesNotMatch(invalid.raw, new RegExp(secret));

  const missingRoot = runHook(
    { hook_event_name: "SessionStart" },
    { pluginRoot: undefined },
  );
  assert.match(missingRoot.output.systemMessage, /PLUGIN_ROOT 无效/);
});
