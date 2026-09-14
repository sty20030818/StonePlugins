import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLUGIN_ROOT = path.join(REPO_ROOT, "plugins", "stoneplugins");
const SCRIPT = path.join(PLUGIN_ROOT, "hooks", "inject-context.js");
const SKILL_PATH = path.join(PLUGIN_ROOT, "skills", "engineering", "SKILL.md");
const EVENTS = ["SessionStart", "SubagentStart", "UserPromptSubmit"];
const SECRET = "TOKEN_SENTINEL_MUST_NOT_LEAK";

type RunHookOptions = { pluginRoot?: string; script?: string; cwd?: string };

function runHook(input: unknown, options: RunHookOptions = {}) {
  const env = { ...process.env };
  if (options.pluginRoot === undefined) delete env.PLUGIN_ROOT;
  else env.PLUGIN_ROOT = options.pluginRoot;

  const result = spawnSync(process.execPath, [options.script ?? SCRIPT], {
    encoding: "utf8",
    env,
    cwd: options.cwd,
    input: typeof input === "string" ? input : JSON.stringify(input),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return { output: JSON.parse(result.stdout), raw: result.stdout };
}

function coreBody(skillPath = SKILL_PATH) {
  const skill = readFileSync(skillPath, "utf8");
  assert.ok(skill.startsWith("---\n"));
  const end = skill.indexOf("\n---\n", 4);
  assert.notEqual(end, -1);
  return skill.slice(end + "\n---\n".length).replace(/^\n/, "");
}

function installedFixture(t: TestContext) {
  const cacheRoot = mkdtempSync(path.join(tmpdir(), "stoneplugins-hook-test-"));
  t.after(() => rmSync(cacheRoot, { recursive: true, force: true }));
  const pluginRoot = path.join(cacheRoot, "plugin with spaces");
  cpSync(PLUGIN_ROOT, pluginRoot, { recursive: true });
  return {
    pluginRoot,
    script: path.join(pluginRoot, "hooks", "inject-context.js"),
    skillPath: path.join(pluginRoot, "skills", "engineering", "SKILL.md"),
  };
}

function assertCompleteContext(output: ReturnType<typeof runHook>["output"], event: string, skillPath = SKILL_PATH) {
  assert.deepEqual(Object.keys(output), ["hookSpecificOutput"]);
  assert.equal(output.hookSpecificOutput.hookEventName, event);
  const context = output.hookSpecificOutput.additionalContext as string;
  const body = coreBody(skillPath);
  assert.ok(context.includes(skillPath));
  assert.ok(context.includes(path.join(path.dirname(skillPath), "references")));
  assert.equal(context.slice(context.indexOf(body)), body);
  assert.equal(context.indexOf(body), context.lastIndexOf(body));
  assert.doesNotMatch(context, /^name: engineering$/m);
  assert.ok(Buffer.byteLength(context, "utf8") <= 8_000);
}

test("所有 SessionStart 来源及子 Agent 完整收到同包核心和当前资源位置", () => {
  for (const source of [undefined, "startup", "resume", "clear", "compact", "future-source"]) {
    const { output } = runHook({ hook_event_name: "SessionStart", source });
    assertCompleteContext(output, "SessionStart");
  }
  const { output } = runHook({ hook_event_name: "SubagentStart", agent_type: "worker" });
  assertCompleteContext(output, "SubagentStart");
});

test("frontmatter 字段换序或 name 加引号不改变完整正文送达", (t) => {
  const fixture = installedFixture(t);
  const original = readFileSync(fixture.skillPath, "utf8");
  const body = coreBody(fixture.skillPath);
  const description = original.match(/^description: .+$/m)![0];
  for (const metadata of [
    `${description}\nname: engineering`,
    `name: "engineering"\n${description}`,
    `${description}\nname: 'engineering'`,
  ]) {
    writeFileSync(fixture.skillPath, `---\n${metadata}\n---\n\n${body}`);
    assert.equal(coreBody(fixture.skillPath), body);
    for (const hook_event_name of ["SessionStart", "SubagentStart"]) {
      const { output } = runHook({ hook_event_name }, { script: fixture.script });
      assertCompleteContext(output, hook_event_name, fixture.skillPath);
    }
  }
});

test("每轮只发送工程执行提醒，不重复展开核心", () => {
  const { output } = runHook({ hook_event_name: "UserPromptSubmit" });
  assert.deepEqual(Object.keys(output), ["hookSpecificOutput"]);
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  const context = output.hookSpecificOutput.additionalContext as string;
  assert.match(context, /工程/);
  assert.match(context, /stoneplugins:engineering/);
  assert.doesNotMatch(context, /^# 石头鱼的工程规则$/m);
  assert.ok(Buffer.byteLength(context, "utf8") <= 300);
});

test("读取实际脚本所在安装包，不依赖 cwd 或 PLUGIN_ROOT 环境变量", () => {
  for (const hook_event_name of EVENTS) {
    const expected = runHook({ hook_event_name }).output;
    for (const pluginRoot of [PLUGIN_ROOT, "relative-plugin-root", "/missing-plugin-root"]) {
      assert.deepEqual(
        runHook({ hook_event_name }, { pluginRoot, cwd: tmpdir() }).output,
        expected,
      );
    }
  }
});

test("完整插件移到含空格缓存后以 ESM 运行，核心和全部细则均来自该副本", (t) => {
  const fixture = installedFixture(t);
  // manifest 不参与运行时路径或版本解析。
  rmSync(path.join(fixture.pluginRoot, ".codex-plugin"), { recursive: true });
  writeFileSync(fixture.skillPath, `${readFileSync(fixture.skillPath, "utf8")}\n缓存副本独有正文。\n`);

  for (const hook_event_name of ["SessionStart", "SubagentStart"]) {
    const { output, raw } = runHook({ hook_event_name }, { script: fixture.script, cwd: tmpdir() });
    assertCompleteContext(output, hook_event_name, fixture.skillPath);
    assert.ok(!raw.includes(PLUGIN_ROOT));
    const body = coreBody(fixture.skillPath);
    const references = [...body.matchAll(/\]\((references\/[^)]+)\)/g)];
    assert.equal(references.length, 5);
    for (const [, relativePath] of references) {
      assert.ok(relativePath);
      const resource = path.resolve(path.dirname(fixture.skillPath), relativePath);
      assert.ok(resource.startsWith(`${fixture.pluginRoot}${path.sep}`));
      assert.ok(realpathSync(resource).startsWith(`${realpathSync(fixture.pluginRoot)}${path.sep}`));
      assert.ok(readFileSync(resource, "utf8").length > 0);
    }
  }
  assert.deepEqual(
    runHook({ hook_event_name: "UserPromptSubmit" }, { script: fixture.script }).output,
    runHook({ hook_event_name: "UserPromptSubmit" }).output,
  );
});

test("核心缺失、不可读、结构损坏、逃逸或超限时安全暂停，prompt 不读取核心", (t) => {
  const fixture = installedFixture(t);
  const original = readFileSync(fixture.skillPath, "utf8");
  const frontmatter = original.slice(0, original.indexOf("\n---\n", 4) + "\n---\n".length);
  const invalidCores = [
    { name: "缺失", content: undefined },
    { name: "不可读目录", content: null },
    { name: "软链接逃逸", content: false },
    { name: "无 frontmatter", content: coreBody() },
    { name: "frontmatter 未闭合", content: `---\nname: engineering\n${SECRET}` },
    { name: "frontmatter 缺 name", content: original.replace(/^name: .*\n/m, "") },
    { name: "frontmatter 缺 description", content: original.replace(/^description: .*\n/m, "") },
    { name: "frontmatter 错 name", content: original.replace(/^name: .*$/m, "name: other") },
    { name: "frontmatter 重复 name", content: original.replace(/^name: .*$/m, "name: engineering\nname: engineering") },
    { name: "空正文", content: `${frontmatter}\n \n` },
    { name: "缺必要结构", content: original.replace("## 常驻工程执行契约", "") },
    { name: "超过预算", content: `${original}\n${SECRET}\n${"规则".repeat(8_000)}` },
  ];

  for (const { name, content } of invalidCores) {
    rmSync(fixture.skillPath, { recursive: true, force: true });
    if (content === null) mkdirSync(fixture.skillPath);
    else if (content === false) {
      const outside = path.join(path.dirname(fixture.pluginRoot), "outside-SKILL.md");
      writeFileSync(outside, original);
      symlinkSync(outside, fixture.skillPath);
    } else if (typeof content === "string") writeFileSync(fixture.skillPath, content);

    for (const hook_event_name of ["SessionStart", "SubagentStart"]) {
      const { output, raw } = runHook(
        { hook_event_name, prompt: SECRET, transcript_path: SECRET },
        { script: fixture.script },
      );
      assert.match(output.systemMessage, /暂停工程决定/, name);
      assert.equal(output.hookSpecificOutput.hookEventName, hook_event_name, name);
      assert.match(output.hookSpecificOutput.additionalContext, /暂停工程决定/, name);
      assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /^# 石头鱼的工程规则$/m, name);
      assert.ok(!raw.includes(SECRET), name);
      assert.ok(!raw.includes(fixture.skillPath), name);
    }

    assert.deepEqual(
      runHook({ hook_event_name: "UserPromptSubmit" }, { script: fixture.script }).output,
      runHook({ hook_event_name: "UserPromptSubmit" }).output,
      name,
    );
  }
});

test("所有事件忽略 prompt、transcript 和未知字段，不泄漏或依赖其内容", () => {
  for (const hook_event_name of EVENTS) {
    const expected = runHook({ hook_event_name }).output;
    for (const prompt of [SECRET, "完全不同的架构讨论", { ignored: SECRET }]) {
      const { output, raw } = runHook({
        hook_event_name,
        prompt,
        transcript_path: SECRET,
        unknown: { private: SECRET },
      });
      assert.deepEqual(output, expected);
      assert.ok(!raw.includes(SECRET));
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

test("无效输入与非法原型事件仅返回安全 systemMessage，不伪造事件", () => {
  const cases = [
    { input: `{"token":"${SECRET}"`, error: "输入不是有效 JSON" },
    { input: "", error: "输入不是有效 JSON" },
    ...[null, [], true, 42, JSON.stringify(SECRET)].map((input) => ({
      input,
      error: "输入必须是 JSON 对象",
    })),
    ...[undefined, "UnknownEvent", "constructor", "__proto__", 42].map((hook_event_name) => ({
      input: { hook_event_name, secret: SECRET },
      error: "Hook 事件不受支持",
    })),
  ];

  for (const { input, error } of cases) {
    const { output, raw } = runHook(input);
    assert.deepEqual(Object.keys(output), ["systemMessage"]);
    assert.ok(output.systemMessage.includes(error));
    assert.match(output.systemMessage, /暂停工程决定/);
    assert.ok(!raw.includes(SECRET));
  }
});
