import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { todosV1 } from "../../packages/plugin-services/src/index.mjs";
import {
  DEFAULT_SETTINGS,
  buildProgress,
  msUntilNextDay,
  normalizeSettings,
  normalizeStored,
  shiftDate,
} from "../../plugins/v3/official/todo-ring/src/model.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/todo-ring", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-todo-ring-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const todo = (id, title, completed = false) => ({ id, title, completed, createdAt: 0 });

test("todo-ring settings: defaults for new and old installs, clamps and ignores junk", () => {
  assert.deepEqual(normalizeStored(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.clickToComplete, false);
  assert.equal(DEFAULT_SETTINGS.showCount, 3);
  assert.equal(DEFAULT_SETTINGS.scope, "today");
  assert.equal(DEFAULT_SETTINGS.barStyle, "ring-count");
  assert.equal(DEFAULT_SETTINGS.showInBar, true);
  assert.equal(DEFAULT_SETTINGS.doneColor, true);

  const stored = normalizeStored({ settings: { clickToComplete: true, showCount: 99, scope: "week", barStyle: "left" } });
  assert.equal(stored.clickToComplete, true);
  assert.equal(stored.showCount, 8);
  assert.equal(stored.scope, "today");
  assert.equal(stored.barStyle, "left");

  const patched = normalizeSettings({ showCount: -2, doneColor: "no" }, stored);
  assert.equal(patched.showCount, 0);
  assert.equal(patched.doneColor, true);
  assert.equal(patched.clickToComplete, true);
});

test("todo-ring progress: today only, and today plus overdue without carried-over duplicates", () => {
  const today = { date: "2026-11-19", todos: [todo("a", "Write report", true), todo("b", "Email Bob"), todo("c", "Buy milk")] };
  const past = [
    { date: "2026-11-18", todos: [todo("p1", "Email Bob"), todo("p2", "Fix bike"), todo("p3", "Call mom", true)] },
    { date: "2026-11-17", todos: [todo("q1", "Fix bike"), todo("q2", "Book flight")] },
  ];

  const onlyToday = buildProgress(today, past, "today");
  assert.deepEqual([onlyToday.done, onlyToday.total], [1, 3]);
  assert.deepEqual(onlyToday.next.map((item) => item.id), ["b", "c"]);

  const withOverdue = buildProgress(today, past, "overdue");
  assert.deepEqual([withOverdue.done, withOverdue.total], [1, 5]);
  assert.deepEqual(
    withOverdue.next.map((item) => [item.title, item.overdueFrom ?? null]),
    [
      ["Fix bike", "2026-11-17"],
      ["Book flight", "2026-11-17"],
      ["Email Bob", null],
      ["Buy milk", null],
    ],
  );

  const empty = buildProgress({ date: "2026-11-19", todos: [] }, [], "overdue");
  assert.deepEqual([empty.done, empty.total, empty.next.length], [0, 0, 0]);
});

test("todo-ring dates: shift across months and wait until just after local midnight", () => {
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2026-11-19", -7), "2026-11-12");
  const now = new Date(2026, 10, 19, 23, 59, 0).getTime();
  assert.equal(msUntilNextDay(now), 61_000);
  assert.ok(msUntilNextDay(new Date(2026, 10, 19, 0, 0, 1).getTime()) > 23 * 3600_000);
});

test("todo-ring host: click to complete is off until turned on, undo reopens, settings persist", async () => {
  const result = await check(PLUGIN_DIR, { official: true, allowExperimental: false });
  assert.deepEqual(result.errors, []);
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
  assert.equal(packed.manifest.version, "1.1.1");
  assert.deepEqual(packed.manifest.fuyu.slots, ["island.page/v1", "island.collapsed/v1", "settings.section/v1"]);

  const hostDir = join(scratch, "host");
  mkdirSync(hostDir, { recursive: true });
  installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });

  const items = [todo("a", "Write report", true), todo("b", "Email Bob")];
  const updates = [];
  let host = null;
  let provider = null;
  try {
    host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
    provider = host.ctx.services.provide(todosV1, {
      list: async ({ date } = {}) =>
        date ? { date, todos: [todo("old", "Fix bike")], scheduled: [], activeTodoId: null } : { date: "2026-11-19", todos: items, scheduled: [], activeTodoId: null },
      days: async () => ({ days: [{ date: "2026-11-18", total: 1, completed: 0, hasNote: false, archived: true }] }),
      add: async () => ({}),
      update: async ({ id, completed }) => {
        updates.push([id, completed]);
        const item = items.find((entry) => entry.id === id);
        item.completed = completed;
        return item;
      },
      remove: async ({ id }) => ({ id }),
      note: async () => ({ date: "2026-11-19", note: "" }),
      setNote: async () => ({ date: "2026-11-19", note: "" }),
    });
    await host.settle();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && host.status().find((entry) => entry.id === "@fuyu/todo-ring")?.state !== "running") {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const call = (method, params) => host.ctx.clients.call("@fuyu/todo-ring", method, params);

    const first = await call("snapshot");
    assert.deepEqual([first.done, first.total, first.error], [1, 2, null]);
    assert.equal(first.settings.clickToComplete, false);

    await call("complete", { id: "b" });
    assert.deepEqual(updates, []);

    await call("set-settings", { clickToComplete: true });
    const done = await call("complete", { id: "b" });
    assert.deepEqual([done.done, done.total], [2, 2]);
    const reopened = await call("reopen", { id: "b" });
    assert.deepEqual([reopened.done, reopened.total], [1, 2]);
    assert.deepEqual(updates, [["b", true], ["b", false]]);

    const overdue = await call("set-settings", { scope: "overdue" });
    assert.equal(overdue.total, 3);
    assert.equal(overdue.next[0].overdueFrom, "2026-11-18");
    await call("complete", { id: "old" });
    assert.equal(updates.length, 2);

    const saved = JSON.parse(readFileSync(join(hostDir, "data", "@fuyu", "todo-ring", "todo-ring.json"), "utf8"));
    assert.equal(saved.settings.clickToComplete, true);
    assert.equal(saved.settings.scope, "overdue");
  } finally {
    if (provider) await provider.dispose();
    if (host) await host.stop();
  }
});
