import assert from "node:assert/strict";
import { test } from "node:test";
import { readReminder } from "../../src/features/timer/reminderParams.ts";
import { DEFAULT_TIMER_SHORTCUT, timerConfig } from "../../src/features/timer/timerConfig.ts";

test("the timer's config in plugins.yml falls back to a sound and Ctrl+Alt+K", () => {
  assert.deepEqual(timerConfig({}), { sound: true, shortcut: DEFAULT_TIMER_SHORTCUT });
  assert.deepEqual(timerConfig({ sound: false, shortcut: " Ctrl+Shift+T " }), { sound: false, shortcut: "Ctrl+Shift+T" });
  assert.deepEqual(timerConfig({ sound: "no", shortcut: "" }), { sound: true, shortcut: "" });
  assert.deepEqual(timerConfig({ shortcut: 3 }), { sound: true, shortcut: DEFAULT_TIMER_SHORTCUT });
});

test("a reminder pushed through reminders/v1 is checked before it reaches the island", () => {
  assert.deepEqual(readReminder({ id: "due-1", source: "todos.due", icon: "flag", title: "Due", detail: "Ship", extra: 1 }), { id: "due-1", source: "todos.due", icon: "flag", title: "Due", detail: "Ship" });
  assert.deepEqual(readReminder({ id: "a", source: "b", icon: "bell", title: "c", snoozable: false }), { id: "a", source: "b", icon: "bell", title: "c", snoozable: false });
  assert.equal(readReminder({ id: "a", source: "b", icon: "rocket", title: "c" }), null);
  assert.equal(readReminder({ id: "", source: "b", icon: "bell", title: "c" }), null);
  assert.equal(readReminder({ source: "b", icon: "bell", title: "c" }), null);
  assert.equal(readReminder(null), null);
  assert.equal(readReminder("flag"), null);
});
