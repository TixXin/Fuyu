import assert from "node:assert/strict";
import test from "node:test";
import { createWindowServices } from "@fuyu/plugin-base/client";
import { remindersV1 } from "@fuyu/plugin-services";
import { pickDueReminders } from "../../src/features/todos/dueReminders.ts";
import { DEFAULT_TODO_PREFS, normalizeTodoPrefs, parseClockTime } from "../../src/features/todos/todoPrefs.ts";
import { collectDueTimedTodoReminders, scheduledTodoTimeMs } from "../../src/features/todos/useTodoTimedReminders.ts";
import {
  WRAP_UP_REMINDER_WINDOW_MS,
  dispatchWrapUpReminder,
  dueWrapUpReminder,
} from "../../src/features/todos/useTodoWrapUpReminder.ts";

const DATE = "2026-11-18";
const MINUTE = 60_000;
const at = (hours, minutes = 0) => scheduledTodoTimeMs(DATE, hours, minutes);
const ahead = (minutes) => `${minutes} min`;
const call = { id: "call", title: "15:00 回电话", completed: false };

test("reminder prefs default to what the app did before and reject values outside the offered choices", () => {
  assert.equal(DEFAULT_TODO_PREFS.timedReminderLeadMinutes, 0);
  assert.equal(DEFAULT_TODO_PREFS.dueReminderScope, "high");
  assert.equal(DEFAULT_TODO_PREFS.wrapUpReminderEnabled, false);
  assert.equal(DEFAULT_TODO_PREFS.wrapUpReminderTime, "18:00");

  const fromOldVersion = normalizeTodoPrefs({ showElapsed: false, timedReminderEnabled: false });
  assert.equal(fromOldVersion.timedReminderLeadMinutes, 0);
  assert.equal(fromOldVersion.dueReminderScope, "high");
  assert.equal(fromOldVersion.wrapUpReminderEnabled, false);
  assert.equal(fromOldVersion.wrapUpReminderTime, "18:00");

  const saved = normalizeTodoPrefs({ timedReminderLeadMinutes: 15, dueReminderScope: "all", wrapUpReminderEnabled: true, wrapUpReminderTime: "21:30" });
  assert.equal(saved.timedReminderLeadMinutes, 15);
  assert.equal(saved.dueReminderScope, "all");
  assert.equal(saved.wrapUpReminderEnabled, true);
  assert.equal(saved.wrapUpReminderTime, "21:30");

  const broken = normalizeTodoPrefs({ timedReminderLeadMinutes: 7, dueReminderScope: "medium", wrapUpReminderEnabled: "yes", wrapUpReminderTime: "25:00" });
  assert.equal(broken.timedReminderLeadMinutes, 0);
  assert.equal(broken.dueReminderScope, "high");
  assert.equal(broken.wrapUpReminderEnabled, false);
  assert.equal(broken.wrapUpReminderTime, "18:00");

  assert.deepEqual(parseClockTime("07:05"), { hours: 7, minutes: 5 });
  assert.equal(parseClockTime("7:05"), null);
  assert.equal(parseClockTime("24:00"), null);
  assert.equal(parseClockTime(1800), null);
});

test("a timed todo reminds once, as early as the lead time, and says how long is left", () => {
  const seen = new Set();
  const check = (nowMs) =>
    collectDueTimedTodoReminders({ date: DATE, todos: [call], nowMs, bootedAtMs: at(9), seen, leadMinutes: 10, aheadText: ahead });

  assert.deepEqual(check(at(14, 50) - 1000), []);
  assert.deepEqual(check(at(14, 50)), [
    { id: "todos:2026-11-18:call:15:00", source: "todos", icon: "bell", title: "15:00 回电话", detail: "10 min", snoozable: true },
  ]);
  assert.deepEqual(check(at(15)), []);
});

test("a timed todo with no lead time keeps reminding on the minute, without a time-left line", () => {
  const seen = new Set();
  const check = (nowMs) => collectDueTimedTodoReminders({ date: DATE, todos: [call], nowMs, bootedAtMs: at(9), seen, aheadText: ahead });

  assert.deepEqual(check(at(14, 55)), []);
  assert.deepEqual(check(at(15)), [{ id: "todos:2026-11-18:call:15:00", source: "todos", icon: "bell", title: "15:00 回电话", snoozable: true }]);
});

test("a timed todo first seen inside the lead window says the minutes that are really left", () => {
  const startedLate = collectDueTimedTodoReminders({
    date: DATE,
    todos: [call],
    nowMs: at(14, 57) + 20_000,
    bootedAtMs: at(14, 57),
    seen: new Set(),
    leadMinutes: 10,
    aheadText: ahead,
  });
  assert.equal(startedLate[0]?.detail, "3 min");

  const afterTheTime = collectDueTimedTodoReminders({
    date: DATE,
    todos: [call],
    nowMs: at(15, 1),
    bootedAtMs: at(15),
    seen: new Set(),
    leadMinutes: 10,
    aheadText: ahead,
  });
  assert.equal(afterTheTime.length, 1);
  assert.equal("detail" in afterTheTime[0], false);
});

test("due reminders cover the priorities the scope names", () => {
  const due = [
    { id: "h", title: "交报告", date: DATE, createdAt: 1, priority: "high" },
    { id: "m", title: "订机票", date: DATE, createdAt: 2, priority: "medium" },
    { id: "l", title: "换灯泡", date: DATE, createdAt: 3, priority: "low" },
    { id: "n", title: "取快递", date: DATE, createdAt: 4 },
  ];
  const picked = (scope) => pickDueReminders(due, new Set(), scope).map((todo) => todo.id);

  assert.deepEqual(picked("off"), []);
  assert.deepEqual(picked("high"), ["h"]);
  assert.deepEqual(picked("highMedium"), ["h", "m"]);
  assert.deepEqual(picked("all"), ["h", "m", "l", "n"]);
  assert.deepEqual(pickDueReminders(due, new Set()).map((todo) => todo.id), ["h"]);
});

test("the wrap-up reminder fires once at its time and only when something is still open", () => {
  const todos = [{ completed: true }, { completed: false }, { completed: false }];
  const seen = new Set();
  const check = (nowMs, list = todos) => dueWrapUpReminder({ date: DATE, time: "18:00", todos: list, nowMs, armedAtMs: at(9), seen });

  assert.equal(check(at(18) - 1000), null);
  assert.deepEqual(check(at(18) + 20_000), { id: "todo-wrap-up:2026-11-18", openCount: 2 });
  assert.equal(check(at(18) + MINUTE), null);

  const quietDay = new Set();
  const allDone = [{ completed: true }];
  assert.equal(dueWrapUpReminder({ date: DATE, time: "18:00", todos: allDone, nowMs: at(18), armedAtMs: at(9), seen: quietDay }), null);
  assert.equal(
    dueWrapUpReminder({ date: DATE, time: "18:00", todos: [...allDone, { completed: false }], nowMs: at(18, 10), armedAtMs: at(9), seen: quietDay }),
    null,
  );
});

test("the wrap-up reminder is not made up for a time that passed before it was switched on or the app started", () => {
  const todos = [{ completed: false }];
  const fresh = () => new Set();

  assert.equal(dueWrapUpReminder({ date: DATE, time: "18:00", todos, nowMs: at(18, 10), armedAtMs: at(18, 10), seen: fresh() }), null);
  assert.deepEqual(dueWrapUpReminder({ date: DATE, time: "18:00", todos, nowMs: at(18, 1), armedAtMs: at(18, 1), seen: fresh() }), {
    id: "todo-wrap-up:2026-11-18",
    openCount: 1,
  });
  assert.equal(
    dueWrapUpReminder({ date: DATE, time: "18:00", todos, nowMs: at(18) + WRAP_UP_REMINDER_WINDOW_MS, armedAtMs: at(9), seen: fresh() }),
    null,
  );
  assert.equal(dueWrapUpReminder({ date: DATE, time: "6pm", todos, nowMs: at(18), armedAtMs: at(9), seen: fresh() }), null);
});

test("the wrap-up reminder reaches the island with the open count in its title", async () => {
  const services = createWindowServices();
  const pushed = [];
  services.provide(
    remindersV1,
    {
      push: (reminder) => {
        pushed.push(reminder);
        return { shown: true };
      },
    },
    { owner: "timer" },
  );
  const input = { services, date: DATE, time: "18:00", todos: [{ completed: false }, { completed: false }], armedAtMs: at(9), seen: new Set() };

  dispatchWrapUpReminder({ ...input, nowMs: at(18), title: (count) => `${count} open` });
  dispatchWrapUpReminder({ ...input, nowMs: at(18, 1), title: (count) => `${count} open` });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(pushed, [{ id: "todo-wrap-up:2026-11-18", source: "todo-wrap-up", icon: "bell", title: "2 open", snoozable: true }]);
});
