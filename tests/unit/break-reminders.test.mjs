import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBreaks,
  AWAY_AFTER_SECONDS,
  DEFAULT_BREAK_REMINDERS,
  MAX_ITEMS,
  MAX_MINUTES,
  MAX_STEP_MS,
  nextBreakIcon,
  normalizeBreakReminders,
  snoozedProgress,
  SNOOZE_MS,
} from "../../src/features/timer/breakReminders.ts";
import { withoutReminder, withReminder, withSource } from "../../src/features/timer/reminderQueue.ts";

const here = { idleSeconds: 3, locked: false };
const on = { ...DEFAULT_BREAK_REMINDERS, enabled: true };
const minute = 60_000;

function run(settings, minutes, presence = here) {
  let progress = {};
  let due = [];
  for (let i = 0; i < minutes; i += 1) ({ progress, due } = advanceBreaks(settings, progress, minute, presence));
  return { progress, due };
}

test("defaults are off with a 60-minute sit and a 20-minute eye reminder", () => {
  assert.equal(DEFAULT_BREAK_REMINDERS.enabled, false);
  assert.deepEqual(DEFAULT_BREAK_REMINDERS.items.map(({ id, icon, minutes }) => [id, icon, minutes]), [["sit", "stand", 60], ["eyes", "eye", 20]]);
  assert.deepEqual(normalizeBreakReminders(undefined), DEFAULT_BREAK_REMINDERS);
  assert.deepEqual(normalizeBreakReminders("broken"), DEFAULT_BREAK_REMINDERS);
});

test("stored settings are cleaned up", () => {
  const items = Array.from({ length: MAX_ITEMS + 2 }, (_, index) => ({ id: `a${index}`, minutes: 10 }));
  const settings = normalizeBreakReminders({
    enabled: true,
    items: [{ id: "x", name: "y".repeat(80), icon: "rocket", minutes: 9999, enabled: false }, { id: "x" }, null, { name: "no id" }, ...items],
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.items.length, MAX_ITEMS);
  assert.deepEqual(settings.items[0], { id: "x", name: "y".repeat(40), icon: "bell", minutes: MAX_MINUTES, enabled: false });
  assert.deepEqual(normalizeBreakReminders({ enabled: true, items: [] }).items, []);
  assert.equal(normalizeBreakReminders({ enabled: "yes" }).enabled, false);
});

test("nothing counts while turned off", () => {
  assert.deepEqual(run(DEFAULT_BREAK_REMINDERS, 120), { progress: {}, due: [] });
});

test("each reminder comes due after its own interval", () => {
  assert.deepEqual(run(on, 19).due, []);
  assert.deepEqual(run(on, 20).due.map((item) => item.id), ["eyes"]);
  assert.deepEqual(run(on, 60).due.map((item) => item.id), ["sit", "eyes"]);
});

test("a due reminder stays due without counting past its interval", () => {
  const { progress } = run(on, 90);
  assert.equal(progress.eyes, 20 * minute);
  assert.equal(progress.sit, 60 * minute);
});

test("time does not count while locked or away", () => {
  assert.deepEqual(run(on, 30, { idleSeconds: 0, locked: true }).progress, { sit: 0, eyes: 0 });
  assert.deepEqual(run(on, 30, { idleSeconds: AWAY_AFTER_SECONDS, locked: false }).progress, { sit: 0, eyes: 0 });
  assert.equal(run(on, 30, { idleSeconds: AWAY_AFTER_SECONDS - 1, locked: false }).progress.sit, 30 * minute);
  assert.equal(run(on, 30, { idleSeconds: null, locked: false }).progress.sit, 30 * minute);
});

test("a long gap such as sleep counts at most one step", () => {
  const { progress } = advanceBreaks(on, {}, 3 * 60 * minute, here);
  assert.equal(progress.sit, MAX_STEP_MS);
  assert.equal(advanceBreaks(on, { sit: 5 }, -1000, here).progress.sit, 5);
});

test("disabled and removed reminders drop their progress", () => {
  const settings = { enabled: true, items: [{ ...on.items[0], enabled: false }] };
  assert.deepEqual(advanceBreaks(settings, { sit: 10, eyes: 10, gone: 10 }, minute, here).progress, {});
});

test("snoozing brings the reminder back after five more minutes", () => {
  const eyes = on.items[1];
  let progress = { ...run(on, 20).progress, eyes: snoozedProgress(eyes) };
  assert.equal(progress.eyes, 20 * minute - SNOOZE_MS);
  let due = [];
  for (let i = 0; i < 4; i += 1) ({ progress, due } = advanceBreaks(on, progress, minute, here));
  assert.deepEqual(due, []);
  ({ due } = advanceBreaks(on, progress, minute, here));
  assert.deepEqual(due.map((item) => item.id), ["eyes"]);
  assert.equal(snoozedProgress({ ...eyes, minutes: 2 }), 0);
});

test("icons cycle through the whole set", () => {
  assert.equal(nextBreakIcon("stand"), "eye");
  assert.equal(nextBreakIcon("bell"), "stand");
});

test("the reminder queue keeps order, replaces by id and syncs by source", () => {
  const a = { id: "a", source: "break", icon: "eye", title: "A" };
  const b = { id: "b", source: "todo", icon: "flag", title: "B" };
  let queue = withReminder(withReminder([], a), b);
  assert.deepEqual(queue.map((entry) => entry.id), ["a", "b"]);
  assert.equal(withReminder(queue, { ...a }), queue);
  queue = withReminder(queue, { ...a, title: "A2" });
  assert.deepEqual(queue.map((entry) => entry.title), ["A2", "B"]);
  assert.equal(withoutReminder(queue, "zzz"), queue);
  assert.deepEqual(withoutReminder(queue, "a").map((entry) => entry.id), ["b"]);
  assert.deepEqual(withSource(queue, "break", []).map((entry) => entry.id), ["b"]);
  const c = { id: "c", source: "break", icon: "stand", title: "C" };
  assert.deepEqual(withSource(queue, "break", [queue[0], c]).map((entry) => entry.id), ["a", "b", "c"]);
  assert.equal(withSource(queue, "break", [queue[0]]), queue);
});
