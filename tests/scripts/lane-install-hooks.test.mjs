import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { hookCommand, installHooks, planHooks, settingsFile } from "../../scripts/lanes/install-hooks.mjs";

const MAIN = "E:\\Projects\\fuyu";
const other = { matcher: "", hooks: [{ type: "command", command: "vibe-island-hook start", timeout: 5 }] };

test("commands point at the main checkout, and on macOS run node through sh with Homebrew on PATH", () => {
  assert.equal(hookCommand(MAIN, "session-hint.mjs", "win32"), 'node "E:/Projects/fuyu/scripts/lanes/session-hint.mjs"');
  assert.equal(
    hookCommand("/Users/me/Fuyu", "session-end.mjs", "darwin"),
    `sh -c 'PATH="$PATH:/opt/homebrew/bin:/usr/local/bin" exec node "/Users/me/Fuyu/scripts/lanes/session-end.mjs"'`,
  );
  assert.throws(() => hookCommand("/Users/me/it's", "session-end.mjs", "darwin"), /引号/);
});

test("lane hooks are appended next to other tools' hooks, and a second run changes nothing", () => {
  const first = planHooks({ model: "x", hooks: { SessionStart: [other] } }, MAIN, "win32");
  assert.equal(first.changes.length, 2);
  assert.equal(first.settings.model, "x");
  assert.deepEqual(first.settings.hooks.SessionStart[0], other);
  assert.deepEqual(first.settings.hooks.SessionStart[1].hooks[0], { type: "command", command: 'node "E:/Projects/fuyu/scripts/lanes/session-hint.mjs"', timeout: 10 });
  assert.equal(first.settings.hooks.SessionEnd[0].hooks[0].timeout, 30);
  assert.deepEqual(planHooks(first.settings, MAIN, "win32").changes, []);
});

test("a hook left at an old checkout path is updated in place and duplicates are dropped", () => {
  const old = { type: "command", command: 'node "E:/Projects/fly-island/scripts/lanes/session-end.mjs"', timeout: 30 };
  const settings = { hooks: { SessionEnd: [{ hooks: [other.hooks[0], old] }, { hooks: [{ ...old }] }] } };
  const { settings: next, changes } = planHooks(settings, MAIN, "win32");
  assert.equal(next.hooks.SessionEnd.length, 1);
  assert.deepEqual(next.hooks.SessionEnd[0].hooks.map((hook) => hook.command), ["vibe-island-hook start", 'node "E:/Projects/fuyu/scripts/lanes/session-end.mjs"']);
  assert.ok(changes.some((change) => change.includes("重复")));
  assert.equal(settings.hooks.SessionEnd.length, 2);
});

test("install backs up the old file before writing, --check only reports, and broken JSON is left alone", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lane-hooks-"));
  try {
    const file = settingsFile({ CLAUDE_CONFIG_DIR: dir });
    assert.equal(file, path.join(dir, "settings.json"));
    const original = `${JSON.stringify({ hooks: { SessionStart: [other] } }, null, 2)}\n`;
    writeFileSync(file, original);
    const checked = installHooks({ main: MAIN, file, platform: "win32", check: true });
    assert.equal(checked.written, false);
    assert.equal(checked.changes.length, 2);
    assert.equal(readFileSync(file, "utf8"), original);
    const done = installHooks({ main: MAIN, file, platform: "win32", now: new Date(Date.UTC(2026, 10, 13, 9, 30)) });
    assert.equal(done.written, true);
    assert.equal(readFileSync(done.backup, "utf8"), original);
    assert.match(path.basename(done.backup), /^settings\.json\.bak-lane-hooks-20261113T093000$/);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).hooks.SessionStart.length, 2);
    assert.equal(installHooks({ main: MAIN, file, platform: "win32" }).written, false);
    assert.equal(readdirSync(dir).filter((name) => name.includes(".bak-")).length, 1);
    writeFileSync(file, "{ not json");
    assert.throws(() => installHooks({ main: MAIN, file, platform: "win32" }), /不是有效的 JSON/);
    assert.equal(readFileSync(file, "utf8"), "{ not json");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing settings file is created without a backup", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lane-hooks-"));
  try {
    const file = path.join(dir, "nested", "settings.json");
    const done = installHooks({ main: "/Users/me/Fuyu", file, platform: "darwin" });
    assert.equal(done.backup, null);
    assert.match(JSON.parse(readFileSync(file, "utf8")).hooks.SessionEnd[0].hooks[0].command, /^sh -c /);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
