import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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
const SCRIPT = path.join(PLUGIN_ROOT, "hooks", "inject-context.mjs");
const PLUGIN_VERSION = (
  JSON.parse(
    readFileSync(
      path.join(PLUGIN_ROOT, ".codex-plugin", "plugin.json"),
      "utf8",
    ),
  ) as { version: string }
).version;

type RunHookOptions = { pluginRoot?: string };

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

function createPluginRoot(files: { skill?: string; manifest?: string }) {
  const root = mkdtempSync(path.join(tmpdir(), "stonefish-engineering-hook-"));
  if (files.skill !== undefined) {
    const skillDir = path.join(
      root,
      "skills",
      "stonefish-engineering",
    );
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, "SKILL.md"), files.skill, "utf8");
  }
  if (files.manifest !== undefined) {
    const manifestDir = path.join(root, ".codex-plugin");
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      path.join(manifestDir, "plugin.json"),
      files.manifest,
      "utf8",
    );
  }
  return root;
}

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
    assert.match(context, /references\/methodology-index\.md/);
    assert.doesNotMatch(context, /^# 方法论索引与晋升门槛$/m);
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
  const withoutPluginRoot = runHook(
    { hook_event_name: "UserPromptSubmit", prompt: "不读取插件文件" },
    { pluginRoot: undefined },
  );

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
  assert.equal(
    output.hookSpecificOutput.additionalContext,
    withoutPluginRoot.output.hookSpecificOutput.additionalContext,
  );
  assert.doesNotMatch(raw, new RegExp(secret));
});

test("无效输入边界只返回安全 systemMessage", () => {
  const secret = "private-token-value";
  const cases = [
    {
      result: runHook(`{\"token\":\"${secret}\"`),
      error: /输入不是有效 JSON/,
    },
    {
      result: runHook({ hook_event_name: "UnknownEvent", secret }),
      error: /Hook 事件不受支持/,
    },
    {
      result: runHook({
        hook_event_name: "UserPromptSubmit",
        prompt: 42,
        secret,
      }),
      error: /提示内容类型无效/,
    },
    {
      result: runHook(
        { hook_event_name: "SessionStart", secret },
        { pluginRoot: "relative-plugin-root" },
      ),
      error: /PLUGIN_ROOT 无效/,
    },
  ];

  for (const { result, error } of cases) {
    assert.deepEqual(Object.keys(result.output), ["systemMessage"]);
    assert.match(result.output.systemMessage, error);
    assert.doesNotMatch(result.raw, new RegExp(secret));
  }
});

test("损坏的插件文件保持脱敏失败语义", (t) => {
  const secret = "fixture-secret-must-not-leak";
  const fixtures = [
    {
      files: {},
      error: /插件规则或 manifest 不可读/,
    },
    {
      files: { skill: "# 规则", manifest: `{\"secret\":\"${secret}\"` },
      error: /manifest 不是有效 JSON/,
    },
    {
      files: {
        skill: "# 规则",
        manifest: JSON.stringify({ secret }),
      },
      error: /manifest 缺少版本/,
    },
    {
      files: {
        skill: `---\nname: ${secret}\n# 缺少结束分隔符`,
        manifest: JSON.stringify({ version: "0.0.0" }),
      },
      error: /规则文件 frontmatter 无效/,
    },
  ];
  const roots = fixtures.map(({ files }) => createPluginRoot(files));
  t.after(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  });

  for (const [index, { error }] of fixtures.entries()) {
    const result = runHook(
      { hook_event_name: "SessionStart" },
      { pluginRoot: roots[index] },
    );
    assert.deepEqual(Object.keys(result.output), ["systemMessage"]);
    assert.match(result.output.systemMessage, error);
    assert.doesNotMatch(result.raw, new RegExp(secret));
  }
});
