import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { commandsV1 } from "../../packages/plugin-base/src/services.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { messagesV1, todosV1 } from "../../packages/plugin-services/src/index.mjs";
import { buildDigest, placeBlock } from "../../plugins/v3/official/todo-digest/src/digest.ts";
import {
  DEFAULT_SETTINGS,
  autoWriteDue,
  normalizeSettings,
  normalizeStored,
} from "../../plugins/v3/official/todo-digest/src/model.ts";
import { textFor } from "../../plugins/v3/official/todo-digest/src/text.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/todo-digest", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-todo-digest-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const zh = textFor("zh-CN");
const en = textFor("en");
const todo = (id, title, completed = false, project) => ({ id, title, completed, ...(project ? { project } : {}) });
const at = (hh, mm) => new Date(2026, 10, 19, hh, mm).getTime();

test("todo-digest settings: defaults for new and 1.0.0 installs, junk ignored", () => {
  assert.deepEqual(normalizeStored(null).settings, DEFAULT_SETTINGS);
  assert.deepEqual(DEFAULT_SETTINGS, {
    autoWrite: false,
    autoTime: "22:00",
    scope: "open",
    format: "list",
    replace: true,
    writeWhenDone: true,
    notify: true,
  });
  const stored = normalizeStored({ settings: { scope: "all", autoTime: "25:00", notify: "no" }, lastWrite: { date: "x" }, lastAutoDate: 3 });
  assert.equal(stored.settings.scope, "all");
  assert.equal(stored.settings.autoTime, "22:00");
  assert.equal(stored.settings.notify, true);
  assert.equal(stored.lastWrite, null);
  assert.equal(stored.lastAutoDate, null);
  const patched = normalizeSettings({ format: "checkbox", autoTime: "07:30", scope: "week" }, stored.settings);
  assert.deepEqual([patched.format, patched.autoTime, patched.scope], ["checkbox", "07:30", "all"]);
});

test("todo-digest text: scope, item style and the all-done line", () => {
  const list = [todo("a", "Write report", true), todo("b", "Email Bob", false, "Work"), todo("c", "Buy milk")];
  assert.equal(buildDigest(list, DEFAULT_SETTINGS, zh, "22:00"), "[22:00] 待办摘要：未完成 2 条\n- [Work] Email Bob\n- Buy milk");
  assert.equal(
    buildDigest(list, { ...DEFAULT_SETTINGS, scope: "openCount" }, en, "22:00"),
    "[22:00] To-do digest: 2 open, 1 done\n- [Work] Email Bob\n- Buy milk",
  );
  assert.equal(
    buildDigest(list, { ...DEFAULT_SETTINGS, scope: "all", format: "checkbox" }, en, "08:05"),
    "[08:05] To-do digest: 2 open, 1 done\n- [ ] [Work] Email Bob\n- [ ] Buy milk\n- [x] Write report",
  );
  assert.equal(buildDigest(list, { ...DEFAULT_SETTINGS, scope: "all" }, zh, "08:05").split("\n").at(-1), "- Write report（已完成）");

  const done = [todo("a", "Write report", true)];
  assert.equal(buildDigest(done, DEFAULT_SETTINGS, zh, "22:00"), "[22:00] 待办摘要：未完成 0 条\n今日待办已全部完成");
  assert.equal(buildDigest([], DEFAULT_SETTINGS, en, "22:00"), "[22:00] To-do digest: 0 open\nNo to-dos today");
  assert.equal(buildDigest(done, { ...DEFAULT_SETTINGS, writeWhenDone: false }, zh, "22:00"), null);
});

test("todo-digest placement: replaces the earlier copy only when it is unchanged", () => {
  assert.deepEqual(placeBlock("", "B", null), { note: "B", replaced: false });
  assert.deepEqual(placeBlock("Notes\n\n", "B", null), { note: "Notes\n\nB", replaced: false });
  assert.deepEqual(placeBlock("Notes\n\nOLD\n\nAfter", "NEW", "OLD"), { note: "Notes\n\nNEW\n\nAfter", replaced: true });
  assert.deepEqual(placeBlock("Notes\n\nOLD edited", "NEW", "OLD\nline"), { note: "Notes\n\nOLD edited\n\nNEW", replaced: false });
});

test("todo-digest auto write: once a day after the set time", () => {
  const on = { ...DEFAULT_SETTINGS, autoWrite: true };
  assert.equal(autoWriteDue(DEFAULT_SETTINGS, null, at(23, 0)), false);
  assert.equal(autoWriteDue(on, null, at(21, 59)), false);
  assert.equal(autoWriteDue(on, null, at(22, 0)), true);
  assert.equal(autoWriteDue(on, "2026-11-19", at(23, 0)), false);
  assert.equal(autoWriteDue(on, "2026-11-18", at(22, 30)), true);
});

async function until(check, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return check();
}

test("todo-digest host: command writes without messages, rewrites replace, settings persist", async () => {
  const result = await check(PLUGIN_DIR, { official: true, allowExperimental: false });
  assert.deepEqual(result.errors, []);
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
  assert.equal(packed.manifest.version, "1.1.0");
  assert.deepEqual(packed.manifest.fuyu.inject, { required: ["todos/v1"], optional: ["messages/v1"] });
  assert.deepEqual(packed.manifest.fuyu.displayName, { "zh-CN": "待办摘要", en: "To-do digest" });
  assert.deepEqual(packed.manifest.fuyu.slots, ["settings.section/v1"]);

  const hostDir = join(scratch, "host");
  mkdirSync(hostDir, { recursive: true });
  installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });

  const items = [todo("a", "Write report", true), todo("b", "Email Bob")];
  let note = "Morning notes";
  const notices = [];
  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  try {
    host.ctx.services.provide(todosV1, {
      list: async () => ({ date: "2026-11-19", todos: items.map((item) => ({ ...item, createdAt: 0 })), scheduled: [], activeTodoId: null }),
      days: async () => ({ days: [] }),
      add: async () => ({}),
      update: async () => ({}),
      remove: async ({ id }) => ({ id }),
      note: async () => ({ date: "2026-11-19", note }),
      setNote: async (params) => {
        note = params.note;
        return { date: "2026-11-19", note };
      },
    });
    await host.settle();
    assert.ok(await until(() => host.status().find((entry) => entry.id === "@fuyu/todo-digest")?.state === "running"));

    let commands;
    await host.ctx.plugin({
      name: "e66-todo-digest-inspector",
      apply(ctx) {
        commands = ctx.services.get(commandsV1);
      },
    });
    const own = (await commands.list()).items.filter((item) => item.pluginId === "@fuyu/todo-digest");
    assert.deepEqual(own.map((item) => [item.id, item.active]), [["write-digest", true]]);

    const first = await commands.run({ plugin: "@fuyu/todo-digest", command: "write-digest" });
    assert.equal(first.lastOutcome, "written");
    assert.match(note, /^Morning notes\n\n\[\d\d:\d\d\] (待办摘要|To-do digest).*\n- Email Bob$/);

    items[1].completed = true;
    const second = await commands.run({ plugin: "@fuyu/todo-digest", command: "write-digest" });
    assert.equal(second.lastOutcome, "replaced");
    assert.equal(note.split("\n\n").length, 2);
    assert.match(note, /(全部完成|All to-dos done)/);

    const call = (method, params) => host.ctx.clients.call("@fuyu/todo-digest", method, params);
    await call("setSettings", { replace: false, writeWhenDone: false, scope: "all" });
    const skipped = await call("writeDigest");
    assert.equal(skipped.lastOutcome, "skipped");
    assert.equal(note.split("\n\n").length, 2);

    await call("setSettings", { writeWhenDone: true });
    host.ctx.services.provide(messagesV1, {
      sources: async () => ({ sources: [] }),
      notify: async (notice) => {
        notices.push(notice);
        return { shown: true, receivedAt: Date.now() };
      },
      clear: async () => ({ ok: true }),
    });
    await host.settle();
    assert.ok(await until(() => host.status().find((entry) => entry.id === "@fuyu/todo-digest")?.state === "running"));
    const third = await until(async () => (await call("writeDigest").catch(() => null))?.lastOutcome === "written");
    assert.ok(third);
    assert.equal(note.split("\n\n").length, 3);
    assert.ok(notices.length >= 1);
    assert.equal(notices[0].pluginId, "@fuyu/todo-digest");

    const saved = JSON.parse(readFileSync(join(hostDir, "data", "@fuyu", "todo-digest", "todo-digest.json"), "utf8"));
    assert.equal(saved.settings.replace, false);
    assert.equal(saved.settings.scope, "all");
    assert.equal(saved.lastWrite.date, "2026-11-19");
  } finally {
    await host.stop();
  }
});
