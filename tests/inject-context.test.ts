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

test("所有事件只发送独立 Skill 加载要求，不依赖 PLUGIN_ROOT", () => {
  for (const hook_event_name of EVENTS) {
    const { output } = runHook({ hook_event_name });
    assert.deepEqual(Object.keys(output), ["hookSpecificOutput"]);
    assert.equal(output.hookSpecificOutput.hookEventName, hook_event_name);
    const context = output.hookSpecificOutput.additionalContext as string;
    for (const requirement of [
      "通过宿主的 Skill 入口使用 $stonefish-engineering",
      "完整读取该入口的 SKILL.md",
      "不得跳过核心直接读取 references",
      "仍在当前有效上下文中时，无需重复读取",
      "按正文信号加载 references",
      "以该 Skill 所在目录解析相对路径",
      "未发现该技能或读取失败",
      "先报告并暂停依赖它的工程决定，不得假装已采用",
      "非工程任务不强制加载",
      "不证明正文已加载或规则已落实",
    ]) {
      assert.ok(context.includes(requirement), `加载要求缺少：${requirement}`);
    }
    assert.doesNotMatch(context, /STONEFISH ENGINEERING ACTIVE|<!-- SF_END -->|^# 石头鱼的工程规则$/m);
    assert.ok(!context.includes(PLUGIN_ROOT));

    for (const pluginRoot of [PLUGIN_ROOT, "relative-plugin-root", "/missing-plugin-root"]) {
      assert.deepEqual(runHook({ hook_event_name }, { pluginRoot }).output, output);
    }
  }
});

test("SessionStart 的全部生命周期来源都发送相同加载要求", () => {
  const expected = runHook({ hook_event_name: "SessionStart" }).output;
  for (const source of ["startup", "resume", "clear", "compact"]) {
    assert.deepEqual(runHook({ hook_event_name: "SessionStart", source }).output, expected);
  }
});

test("子 Agent 加载要求不假定已继承父 Agent 的规则", () => {
  const { output } = runHook({ hook_event_name: "SubagentStart", agent_type: "worker" });
  assert.match(output.hookSpecificOutput.additionalContext, /不得假定.*父/);
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
