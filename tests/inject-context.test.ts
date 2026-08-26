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

type RunHookOptions = { pluginRoot?: string };

type HookConfig = {
  hooks: Record<
    string,
    Array<{ hooks: Array<{ command: string }> }>
  >;
};

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

  for (const event of Object.values(config.hooks)) {
    assert.equal(
      event[0].hooks[0].command,
      'node "${PLUGIN_ROOT}/hooks/inject-context.mjs"',
    );
  }
});

test("SessionStart 与 SubagentStart 注入版本化且去除 frontmatter 的核心", () => {
  for (const hook_event_name of ["SessionStart", "SubagentStart"]) {
    const { output } = runHook({ hook_event_name });
    assert.equal(output.hookSpecificOutput.hookEventName, hook_event_name);
    assert.equal(output.systemMessage, undefined);
    assert.match(
      output.hookSpecificOutput.additionalContext,
      /STONEFISH ENGINEERING ACTIVE — v0\.3\.0/,
    );
    assert.match(
      output.hookSpecificOutput.additionalContext,
      new RegExp(PLUGIN_ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.match(output.hookSpecificOutput.additionalContext, /# 工程设计、实现与验证/);
    assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /^---/m);
    assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /^name:/m);
  }
});

test("UserPromptSubmit 只注入短提醒且不回显用户提示", () => {
  const secret = "TOKEN_SENTINEL_MUST_NOT_LEAK";
  const { output, raw } = runHook({
    hook_event_name: "UserPromptSubmit",
    prompt: secret,
  });

  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /^石头鱼工程工作流/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /工程设计、实现与验证/);
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
