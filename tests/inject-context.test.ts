import assert from "node:assert/strict";
import {
  cpSync,
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
const SCRIPT = path.join(PLUGIN_ROOT, "hooks", "inject-context.js");
const PLUGIN_VERSION = (
  JSON.parse(
    readFileSync(
      path.join(PLUGIN_ROOT, ".codex-plugin", "plugin.json"),
      "utf8",
    ),
  ) as { version: string }
).version;

type RunHookOptions = { pluginRoot?: string; script?: string };

const CORE_CONTEXT_BYTE_LIMIT = 6_000;
const CORE_CONTEXT_BYTE_TARGET = 5_800;
const PLUGIN_ROOT_BYTE_BUDGET = 128;

function budgetedContextBytes(context: string) {
  const budgetRoot = `/${"p".repeat(PLUGIN_ROOT_BYTE_BUDGET - 1)}`;
  assert.equal(Buffer.byteLength(budgetRoot, "utf8"), PLUGIN_ROOT_BYTE_BUDGET);

  const skillRoot = path.join(PLUGIN_ROOT, "skills", "stonefish-engineering");
  const skillPath = path.join(skillRoot, "SKILL.md");
  const budgetSkillRoot = path.join(
    budgetRoot,
    "skills",
    "stonefish-engineering",
  );
  const budgetSkillPath = path.join(budgetSkillRoot, "SKILL.md");
  const normalized = context
    .replace(skillPath, budgetSkillPath)
    .replace(skillRoot, budgetSkillRoot);

  return Buffer.byteLength(normalized, "utf8");
}

function runHook(input: unknown, options: RunHookOptions = {}) {
  const env = { ...process.env };
  if (Object.hasOwn(options, "pluginRoot")) {
    if (options.pluginRoot === undefined) delete env.PLUGIN_ROOT;
    else env.PLUGIN_ROOT = options.pluginRoot;
  } else {
    env.PLUGIN_ROOT = PLUGIN_ROOT;
  }

  const result = spawnSync(process.execPath, [options.script ?? SCRIPT], {
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
    assert.match(context, /references\/method-selection\.md/);
    assert.match(context, /references\/decision-summary\.md/);
    assert.doesNotMatch(context, /references\/methodology-index\.md/);
    assert.match(context, /^## 常驻工程执行契约$/m);
    assert.match(context, /必须共同参与每项工程决定的形成/);
    assert.match(context, /不得先形成方案再做方法论签到/);
    assert.match(context, /^## 公开决策说明$/m);
    assert.doesNotMatch(context, /^## 🧭/m);
    assert.match(context, /<!-- SF_END -->$/);
    assert.ok(
      budgetedContextBytes(context) <= CORE_CONTEXT_BYTE_TARGET,
      `核心注入在 ${PLUGIN_ROOT_BYTE_BUDGET}-byte 根路径预算下超过仓库目标 ${CORE_CONTEXT_BYTE_TARGET} bytes`,
    );
    assert.ok(
      Buffer.byteLength(context, "utf8") <= CORE_CONTEXT_BYTE_LIMIT,
      `核心注入超过 ${CORE_CONTEXT_BYTE_LIMIT} bytes`,
    );
  }
  assert.equal(contexts[0], contexts[1]);
});

test("生成的 .js Hook 可在独立插件缓存中保持 ESM 语义", (t) => {
  const cacheRoot = mkdtempSync(path.join(tmpdir(), "stonefish-plugin-cache-"));
  const installedPluginRoot = path.join(cacheRoot, "stonefish-engineering");
  cpSync(PLUGIN_ROOT, installedPluginRoot, { recursive: true });
  t.after(() => rmSync(cacheRoot, { recursive: true, force: true }));

  const { output } = runHook(
    { hook_event_name: "SessionStart", source: "startup" },
    {
      pluginRoot: installedPluginRoot,
      script: path.join(installedPluginRoot, "hooks", "inject-context.js"),
    },
  );

  assert.match(
    output.hookSpecificOutput.additionalContext,
    /STONEFISH ENGINEERING ACTIVE/,
  );
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
  const withoutPrompt = runHook({ hook_event_name: "UserPromptSubmit" });
  const arbitraryPromptShape = runHook({
    hook_event_name: "UserPromptSubmit",
    prompt: { ignored: true },
  });

  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /^石头鱼的工程规则/);
  assert.match(output.hookSpecificOutput.additionalContext, /完整常驻工程执行契约/);
  assert.match(output.hookSpecificOutput.additionalContext, /从理解、设计、实施到验证共同形成/);
  assert.match(output.hookSpecificOutput.additionalContext, /按真实信号采用条件方法/);
  assert.match(output.hookSpecificOutput.additionalContext, /不证明核心规则已送达/);
  assert.match(output.hookSpecificOutput.additionalContext, /不得退化为事后检查/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /已注入/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /仍然生效/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /第一性原则/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /KISS/);
  assert.doesNotMatch(
    output.hookSpecificOutput.additionalContext,
    /\$stonefish-engineering/,
  );
  assert.equal(
    output.hookSpecificOutput.additionalContext,
    second.output.hookSpecificOutput.additionalContext,
  );
  assert.equal(
    output.hookSpecificOutput.additionalContext,
    withoutPluginRoot.output.hookSpecificOutput.additionalContext,
  );
  assert.equal(
    output.hookSpecificOutput.additionalContext,
    withoutPrompt.output.hookSpecificOutput.additionalContext,
  );
  assert.equal(
    output.hookSpecificOutput.additionalContext,
    arbitraryPromptShape.output.hookSpecificOutput.additionalContext,
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
      result: runHook({ secret }),
      error: /Hook 事件不受支持/,
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
    {
      files: {
        skill: "---\nname: stonefish-engineering\n---\n   \n",
        manifest: JSON.stringify({ version: "0.0.0" }),
      },
      error: /规则正文无效/,
    },
    {
      files: {
        skill: "# 截断的规则",
        manifest: JSON.stringify({ version: "0.0.0" }),
      },
      error: /规则正文无效/,
    },
    {
      files: {
        skill: "# 石头鱼的工程规则\n\n## 工作顺序\n\n1. 尾部已截断",
        manifest: JSON.stringify({ version: "0.0.0" }),
      },
      error: /规则正文无效/,
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
