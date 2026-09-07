import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", "stonefish-engineering");
const SCRIPT = path.join(PLUGIN_ROOT, "hooks", "inject-context.js");
const EVENTS = ["SessionStart", "SubagentStart", "UserPromptSubmit"];
const CONTEXT_BYTE_LIMIT = 300;

type RunHookOptions = { pluginRoot?: string; script?: string };

function runHook(input: unknown, options: RunHookOptions = {}) {
  const env = { ...process.env };
  if (options.pluginRoot === undefined) delete env.PLUGIN_ROOT;
  else env.PLUGIN_ROOT = options.pluginRoot;

  const result = spawnSync(process.execPath, [options.script ?? SCRIPT], {
    encoding: "utf8",
    env,
    input: typeof input === "string" ? input : JSON.stringify(input),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return { output: JSON.parse(result.stdout), raw: result.stdout };
}

test("所有事件发送精简、自包含且彼此不同的加载要求", () => {
  const contexts = new Set<string>();
  for (const hook_event_name of EVENTS) {
    const { output } = runHook({ hook_event_name });
    assert.deepEqual(Object.keys(output), ["hookSpecificOutput"]);
    assert.equal(output.hookSpecificOutput.hookEventName, hook_event_name);
    const context = output.hookSpecificOutput.additionalContext as string;
    contexts.add(context);
    for (const requirement of [
      "宿主 Skill 入口",
      "$stonefish-engineering",
      "SKILL.md",
      "读取失败",
      "报告并暂停工程决定",
      "不自动安装",
      "不回退旧缓存",
    ]) {
      assert.ok(context.includes(requirement), `加载要求缺少：${requirement}`);
    }
    assert.doesNotMatch(
      context,
      /STONEFISH ENGINEERING ACTIVE|^# 石头鱼的工程规则$|references/m,
    );
    assert.ok(!context.includes(PLUGIN_ROOT));
    assert.ok(
      Buffer.byteLength(context, "utf8") <= CONTEXT_BYTE_LIMIT,
      `加载要求超过 ${CONTEXT_BYTE_LIMIT} bytes`,
    );

    for (const pluginRoot of [PLUGIN_ROOT, "relative-plugin-root", "/missing-plugin-root"]) {
      assert.deepEqual(runHook({ hook_event_name }, { pluginRoot }).output, output);
    }
  }
  assert.equal(contexts.size, EVENTS.length);
});

test("SessionStart 普通来源按需加载，compact 无条件重新完整读取", () => {
  const expected = runHook({ hook_event_name: "SessionStart" }).output;
  const regularContext = expected.hookSpecificOutput.additionalContext as string;
  assert.match(regularContext, /工程任务若.*尚未完整加载/);
  assert.match(regularContext, /已加载.*沿用/);
  assert.match(regularContext, /边界不清时加载/);

  for (const source of ["startup", "resume", "clear"]) {
    assert.deepEqual(runHook({ hook_event_name: "SessionStart", source }).output, expected);
  }

  const compact = runHook({ hook_event_name: "SessionStart", source: "compact" }).output;
  const compactContext = compact.hookSpecificOutput.additionalContext as string;
  assert.notDeepEqual(compact, expected);
  assert.match(compactContext, /压缩已发生.*无条件.*重新完整读取/s);
  assert.match(compactContext, /形成工程决定前/);
  assert.doesNotMatch(compactContext, /已加载.*不重复|边界不清/);
  assert.ok(Buffer.byteLength(compactContext, "utf8") <= CONTEXT_BYTE_LIMIT);
});

test("子 Agent 加载要求不假定已继承父 Agent 的规则", () => {
  const { output } = runHook({ hook_event_name: "SubagentStart", agent_type: "worker" });
  assert.match(output.hookSpecificOutput.additionalContext, /上下文独立.*不得沿用父 Agent/);
  assert.match(output.hookSpecificOutput.additionalContext, /工程任务须先/);
});

test("UserPromptSubmit 只在工程正文缺失或边界不清时要求加载", () => {
  const { output } = runHook({ hook_event_name: "UserPromptSubmit" });
  const context = output.hookSpecificOutput.additionalContext as string;
  assert.match(context, /工程任务若尚未完整加载/);
  assert.match(context, /已加载.*沿用/);
  assert.match(context, /边界不清时加载/);
});

test("生成的 .js Hook 在无 manifest 或 Skill 的独立缓存中保持 ESM 语义", (t) => {
  const cacheRoot = mkdtempSync(path.join(tmpdir(), "stonefish-plugin-cache-"));
  t.after(() => rmSync(cacheRoot, { recursive: true, force: true }));
  const installedPluginRoot = path.join(cacheRoot, "plugin with spaces");
  mkdirSync(path.join(installedPluginRoot, "hooks"), { recursive: true });
  cpSync(path.join(PLUGIN_ROOT, "package.json"), path.join(installedPluginRoot, "package.json"));
  const script = path.join(installedPluginRoot, "hooks", "inject-context.js");
  cpSync(SCRIPT, script);

  for (const hook_event_name of EVENTS) {
    assert.deepEqual(
      runHook({ hook_event_name }, { script }).output,
      runHook({ hook_event_name }).output,
    );
  }
});

test("所有事件忽略用户提示、transcript 和未知字段，不回显或依赖内容", () => {
  const secret = "TOKEN_SENTINEL_MUST_NOT_LEAK";
  for (const hook_event_name of EVENTS) {
    const expected = runHook({ hook_event_name }).output;
    for (const prompt of [secret, "完全不同的架构讨论", { ignored: secret }]) {
      const { output, raw } = runHook({
        hook_event_name,
        prompt,
        transcript_path: secret,
        unknown: { private: secret },
      });
      assert.deepEqual(output, expected);
      assert.ok(!raw.includes(secret));
    }
  }
});

test("合法 JSON 输入允许 BOM", () => {
  for (const hook_event_name of EVENTS) {
    assert.deepEqual(
      runHook(`\uFEFF${JSON.stringify({ hook_event_name })}`).output,
      runHook({ hook_event_name }).output,
    );
  }
});

test("无效输入边界只返回安全 systemMessage", () => {
  const secret = "private-token-value";
  const cases = [
    { input: `{"token":"${secret}"`, error: "输入不是有效 JSON" },
    { input: "", error: "输入不是有效 JSON" },
    ...[null, [], true, 42, JSON.stringify(secret)].map((input) => ({
      input,
      error: "输入必须是 JSON 对象",
    })),
    ...[undefined, "UnknownEvent", "constructor", "__proto__", 42].map((hook_event_name) => ({
      input: { hook_event_name, secret },
      error: "Hook 事件不受支持",
    })),
  ];

  for (const { input, error } of cases) {
    const { output, raw } = runHook(input);
    assert.deepEqual(Object.keys(output), ["systemMessage"]);
    assert.equal(output.systemMessage, `未能发送石头鱼的工程规则加载要求：${error}。`);
    assert.ok(!raw.includes(secret));
  }
});
