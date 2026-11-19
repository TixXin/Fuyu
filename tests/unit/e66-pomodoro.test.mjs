import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { commandsV1 } from "../../packages/plugin-base/src/services.mjs";
import { installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { messagesV1, timersV1, todosV1 } from "../../packages/plugin-services/src/index.mjs";
import {
  DEFAULT_SETTINGS,
  isPaused,
  isTicking,
  msUntilNextDay,
  nextBreak,
  normalizeSettings,
  normalizeStored,
  phaseMinutes,
  settingsOf,
} from "../../plugins/v3/official/pomodoro/src/model.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/pomodoro", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-pomodoro-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("E66.1 pomodoro settings default, clamp, and keep 1.0.0 data", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.focusMinutes, 25);
  assert.equal(DEFAULT_SETTINGS.shortBreakMinutes, 5);
  assert.equal(DEFAULT_SETTINGS.longBreakMinutes, 15);
  assert.equal(DEFAULT_SETTINGS.roundsBeforeLong, 4);
  assert.equal(DEFAULT_SETTINGS.autoStartBreak, false);
  assert.equal(DEFAULT_SETTINGS.autoStartFocus, false);
  assert.equal(DEFAULT_SETTINGS.sound, false);
  assert.equal(DEFAULT_SETTINGS.dailyGoal, 0);
  assert.equal(DEFAULT_SETTINGS.todosExpanded, false);

  const clamped = normalizeSettings({ focusMinutes: 500, shortBreakMinutes: 0, dailyGoal: "3", sound: "yes", roundsBeforeLong: 2.6 });
  assert.equal(clamped.focusMinutes, 120);
  assert.equal(clamped.shortBreakMinutes, 1);
  assert.equal(clamped.dailyGoal, 3);
  assert.equal(clamped.sound, false);
  assert.equal(clamped.roundsBeforeLong, 3);
  assert.equal(normalizeSettings({ focusMinutes: "abc" }, { ...DEFAULT_SETTINGS, focusMinutes: 40 }).focusMinutes, 40);

  const legacy = normalizeStored(
    { date: "2026-11-19", rounds: 3, activeTimerId: "t-9", activeTodoId: "todo-1", activeLabel: "Write report" },
    "2026-11-19",
  );
  assert.equal(legacy.rounds, 3);
  assert.equal(legacy.phase, "focus");
  assert.equal(legacy.activeTimerId, "t-9");
  assert.equal(legacy.activeLabel, "Write report");
  assert.equal(legacy.streak, 0);
  assert.deepEqual(settingsOf(legacy), DEFAULT_SETTINGS);

  const yesterday = normalizeStored({ date: "2026-11-18", rounds: 6, streak: 2, breakDue: "long", focusMinutes: 50 }, "2026-11-19");
  assert.equal(yesterday.rounds, 0);
  assert.equal(yesterday.streak, 0);
  assert.equal(yesterday.breakDue, null);
  assert.equal(yesterday.focusMinutes, 50);
  assert.equal(normalizeStored("garbage", "2026-11-19").phase, null);
});

test("E66.1 pomodoro break order, durations, and timer states", () => {
  const settings = { ...DEFAULT_SETTINGS, roundsBeforeLong: 3 };
  assert.deepEqual([1, 2, 3, 4, 6].map((streak) => nextBreak(streak, settings)), ["short", "short", "long", "short", "long"]);
  assert.equal(nextBreak(0, settings), "short");
  assert.equal(phaseMinutes("focus", settings), 25);
  assert.equal(phaseMinutes("short", settings), 5);
  assert.equal(phaseMinutes("long", settings), 15);

  const running = { id: "a", kind: "countdown", durationMs: 60_000, elapsedMs: 0, runningSince: 1_000, alerted: false };
  const paused = { ...running, elapsedMs: 10_000, runningSince: null };
  assert.equal(isTicking(running, 2_000), true);
  assert.equal(isPaused(running, 2_000), false);
  assert.equal(isTicking(paused, 2_000), false);
  assert.equal(isPaused(paused, 2_000), true);
  assert.equal(isPaused({ ...paused, elapsedMs: 60_000 }, 2_000), false);

  const lateEvening = new Date(2026, 10, 19, 23, 59, 30);
  assert.equal(msUntilNextDay(lateEvening), 31_000);
});

function fakeTimers() {
  const items = new Map();
  let seq = 0;
  let provider = null;
  const list = () => ({ timers: [...items.values()], at: Date.now() });
  const changed = () => provider?.emit("changed", list());
  const impl = {
    list: async () => list(),
    start: async (params) => {
      seq += 1;
      const timer = { id: `t-${seq}`, kind: "countdown", durationMs: params.durationMs, elapsedMs: 0, runningSince: Date.now(), alerted: false };
      items.set(timer.id, timer);
      queueMicrotask(changed);
      return { timer };
    },
    pause: async ({ id }) => {
      const timer = items.get(id);
      timer.elapsedMs += Date.now() - timer.runningSince;
      timer.runningSince = null;
      queueMicrotask(changed);
      return { timer: { ...timer } };
    },
    resume: async ({ id }) => {
      const timer = items.get(id);
      timer.runningSince = Date.now();
      queueMicrotask(changed);
      return { timer: { ...timer } };
    },
    extend: async () => ({}),
    remove: async ({ id }) => {
      const removed = items.delete(id);
      queueMicrotask(changed);
      return { removed };
    },
    dismissRinging: async () => ({ removed: 0 }),
    adopt: async () => list(),
  };
  return {
    items,
    impl,
    bind(next) {
      provider = next;
    },
    fire(id) {
      const timer = items.get(id);
      timer.alerted = true;
      provider.emit("due", { timer: { ...timer }, at: Date.now() });
    },
  };
}

async function until(check, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return check();
}

test("E66.1 pomodoro commands, breaks, pause, and notification buttons in startHost", async () => {
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
  assert.equal(packed.manifest.version, "1.1.0");
  assert.deepEqual(packed.manifest.fuyu.commands.map((item) => item.id), ["start", "stop", "pause"]);
  const hostDir = join(scratch, "host");
  mkdirSync(hostDir, { recursive: true });
  installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });

  const timers = fakeTimers();
  const notices = [];
  let messagesProvider = null;
  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  try {
    timers.bind(host.ctx.services.provide(timersV1, timers.impl));
    host.ctx.services.provide(todosV1, {
      list: async () => ({ date: "2026-11-19", todos: [{ id: "todo-1", title: "Write report", completed: false }] }),
      days: async () => ({ days: [] }),
      add: async () => ({}),
      update: async () => ({}),
      remove: async () => ({}),
      note: async () => ({ date: "2026-11-19", note: "" }),
      setNote: async () => ({}),
    });
    messagesProvider = host.ctx.services.provide(messagesV1, {
      sources: async () => ({ sources: [] }),
      notify: async (notice) => {
        notices.push(notice);
        return { shown: true, receivedAt: Date.now() };
      },
      clear: async () => ({ ok: true }),
    });
    await host.settle();
    assert.equal(host.status().find((item) => item.id === "@fuyu/pomodoro")?.state, "running");

    let commands;
    await host.ctx.plugin({
      name: "e66-inspector",
      apply(ctx) {
        commands = ctx.services.get(commandsV1);
      },
    });
    const run = (command, args) => commands.run({ plugin: "@fuyu/pomodoro", command, args });
    const listed = await commands.list();
    const own = listed.items.filter((item) => item.pluginId === "@fuyu/pomodoro");
    assert.deepEqual(own.map((item) => item.active), [true, true, true]);
    assert.equal(own.find((item) => item.id === "pause").title.en, "Pause or resume pomodoro");

    const started = await run("start", { todoId: "todo-1" });
    assert.equal(started.phase, "focus");
    assert.equal(started.activeLabel, "Write report");
    assert.equal(started.timer.durationMs, 25 * 60_000);
    const focusId = started.timer.id;

    const pausedSnap = await run("pause");
    assert.equal(pausedSnap.timer.runningSince, null);
    const resumed = await run("start");
    assert.notEqual(resumed.timer.runningSince, null);
    assert.equal(resumed.timer.id, focusId);

    timers.fire(focusId);
    assert.ok(await until(() => notices.length === 1));
    assert.equal(notices[0].actions.length, 2);
    assert.match(notices[0].body, /Write report/);
    assert.equal(timers.items.has(focusId), false);

    messagesProvider.emit("action", { pluginId: "@fuyu/pomodoro", source: "@fuyu/pomodoro", action: notices[0].actions[0] });
    assert.ok(await until(() => [...timers.items.values()].some((timer) => timer.durationMs === 5 * 60_000)));
    const breakId = [...timers.items.keys()][0];

    timers.fire(breakId);
    assert.ok(await until(() => notices.length === 2));
    assert.equal(notices[1].actions.length, 1);
    messagesProvider.emit("action", { pluginId: "@fuyu/someone-else", source: "x", action: notices[1].actions[0] });
    messagesProvider.emit("action", { pluginId: "@fuyu/pomodoro", source: "@fuyu/pomodoro", action: notices[1].actions[0] });
    assert.ok(await until(() => [...timers.items.values()].some((timer) => timer.durationMs === 25 * 60_000)));
    assert.equal(timers.items.size, 1);

    const stopped = await run("stop");
    assert.equal(stopped.phase, null);
    assert.equal(stopped.rounds, 1);
    assert.equal(timers.items.size, 0);

    const saved = JSON.parse(readFileSync(join(hostDir, "data", "@fuyu", "pomodoro", "pomodoro.json"), "utf8"));
    assert.equal(saved.rounds, 1);
    assert.equal(saved.streak, 1);
    assert.equal(saved.focusMinutes, 25);
    assert.equal(saved.activeTimerId, null);
  } finally {
    await host.stop();
  }
});
