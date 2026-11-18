import assert from "node:assert/strict";
import test from "node:test";
import { createWindowServices } from "@fuyu/plugin-base/client";
import { remindersV1, timersV1 } from "@fuyu/plugin-services";
import { formatTodoDocumentAsMarkdown, formatTodosAsMarkdown, getTodoSignature } from "../../src/features/todos/markdown.ts";
import {
  addTodoFocusMinutes,
  addTodoSubtask,
  deleteTodoSubtask,
  normalizeTodo,
  toggleTodoSubtask,
  updateTodoNote,
} from "../../src/features/todos/normalize.ts";
import { DEFAULT_TODO_PREFS, normalizeTodoPrefs } from "../../src/features/todos/todoPrefs.ts";
import { createFocusTimerTracker } from "../../src/features/todos/useTodoFocusTimer.ts";
import {
  TIMED_REMINDER_STARTUP_GRACE_MS,
  TIMED_REMINDER_WINDOW_MS,
  collectDueTimedTodoReminders,
  dispatchTimedTodoReminders,
  parseLeadingTodoTime,
  scheduledTodoTimeMs,
} from "../../src/features/todos/useTodoTimedReminders.ts";

function makeTodo(overrides = {}) {
  return {
    id: "todo-1",
    title: "整理设计方案",
    completed: false,
    createdAt: 1_760_000_000_000,
    ...overrides,
  };
}

test("subtasks add, toggle, delete and optionally auto-complete the parent todo", () => {
  let item = makeTodo({ startedAt: 1_760_000_060_000 });
  item = addTodoSubtask(item, "  梳理需求  ", "s1");
  item = addTodoSubtask(item, "补齐测试", "s2");
  item = addTodoSubtask(item, "   ", "ignored");
  assert.equal(item.subtasks?.length, 2);
  assert.deepEqual(item.subtasks?.[0], { id: "s1", title: "梳理需求", completed: false });

  const firstToggle = toggleTodoSubtask(item, "s1", true);
  assert.equal(firstToggle.autoCompleted, false);
  assert.equal(firstToggle.todo.completed, false);
  assert.equal(firstToggle.todo.subtasks?.[0].completed, true);

  const withoutAuto = toggleTodoSubtask(firstToggle.todo, "s2", false);
  assert.equal(withoutAuto.autoCompleted, false);
  assert.equal(withoutAuto.todo.completed, false);
  assert.equal(withoutAuto.todo.subtasks?.[1].completed, true);

  const withAuto = toggleTodoSubtask(firstToggle.todo, "s2", true);
  assert.equal(withAuto.autoCompleted, true);
  assert.equal(withAuto.todo.completed, true);
  assert.equal(withAuto.todo.startedAt, undefined);

  const afterRemoveOne = deleteTodoSubtask(withAuto.todo, "s1");
  assert.deepEqual(afterRemoveOne.subtasks?.map((s) => s.id), ["s2"]);
  const afterRemoveAll = deleteTodoSubtask(afterRemoveOne, "s2");
  assert.equal("subtasks" in afterRemoveAll, false);
});

test("normalizeTodo and note/focus helpers sanitize bounds and omit empty fields", () => {
  const dirty = normalizeTodo({
    id: "t1",
    title: "  周报  ",
    completed: false,
    createdAt: 10,
    note: "  第一行\n第二行  ",
    focusMinutes: 50.8,
    subtasks: [
      { id: "a", title: " 有效步骤 ", completed: true },
      { id: "b", title: "   ", completed: false },
    ],
  });
  assert.equal(dirty.note, "第一行 第二行");
  assert.equal(dirty.focusMinutes, 50);
  assert.deepEqual(dirty.subtasks, [{ id: "a", title: "有效步骤", completed: true }]);

  const clearedNote = updateTodoNote(dirty, "   ");
  assert.equal("note" in clearedNote, false);

  const longNote = updateTodoNote(dirty, "备".repeat(1200));
  assert.equal(Array.from(longNote.note ?? "").length, 1000);

  const credited = addTodoFocusMinutes(makeTodo(), 25);
  assert.equal(addTodoFocusMinutes(credited, 15).focusMinutes, 40);
  assert.equal(normalizeTodo({ id: "t2", title: "x", completed: false, createdAt: 1, focusMinutes: 0 }).focusMinutes, undefined);
});

test("Markdown export formats indented notes, subtasks and optional focusMinutes", () => {
  const base = Date.UTC(2026, 10, 18, 9, 0, 0);
  const todos = [
    makeTodo({
      id: "1",
      title: "写引言",
      project: "论文",
      priority: "high",
      note: "先搭骨架再填数据",
      focusMinutes: 50,
      startedAt: base,
      subtasks: [
        { id: "s1", title: "阅读三篇参考文献", completed: true },
        { id: "s2", title: "完成摘要草稿", completed: false },
      ],
    }),
    makeTodo({ id: "2", title: "买咖啡豆", completed: true }),
  ];

  assert.equal(
    formatTodosAsMarkdown(todos),
    [
      "- [ ] [论文] 写引言",
      "  > 先搭骨架再填数据",
      "  - [x] 阅读三篇参考文献",
      "  - [ ] 完成摘要草稿",
      "- [x] 买咖啡豆",
    ].join("\n"),
  );

  assert.equal(
    formatTodoDocumentAsMarkdown(todos, "今日总结", {
      markdownPriority: true,
      markdownElapsed: true,
      now: base + 10 * 60_000,
    }),
    [
      "- [ ] [论文] [!高] 写引言 (专注 50m · 10m)",
      "  > 先搭骨架再填数据",
      "  - [x] 阅读三篇参考文献",
      "  - [ ] 完成摘要草稿",
      "- [x] 买咖啡豆",
      "",
      "今日总结",
    ].join("\n"),
  );

  const sigBefore = getTodoSignature("2026-11-18", todos, "", { markdownElapsed: true });
  const sigAfterSubtask = getTodoSignature(
    "2026-11-18",
    [{ ...todos[0], subtasks: [{ id: "s1", title: "阅读三篇参考文献", completed: false }] }, todos[1]],
    "",
    { markdownElapsed: true },
  );
  assert.notEqual(sigBefore, sigAfterSubtask);
});

test("focus timer tracker starts countdown via timers/v1 and credits focusMinutes once on due", async () => {
  const services = createWindowServices();
  const startedCalls = [];
  const provider = services.provide(
    timersV1,
    {
      list: () => ({ timers: [], at: 0 }),
      start: (params) => {
        startedCalls.push(params);
        return {
          timer: {
            id: `timer-${startedCalls.length}`,
            kind: "countdown",
            durationMs: params.kind === "countdown" ? params.durationMs : 0,
            elapsedMs: 0,
            runningSince: 1000,
            alerted: false,
          },
        };
      },
      pause: () => { throw new Error("unused"); },
      resume: () => { throw new Error("unused"); },
      extend: () => { throw new Error("unused"); },
      remove: () => ({ removed: true }),
      dismissRinging: () => ({ removed: 0 }),
      adopt: () => ({ timers: [], added: 0, at: 0 }),
    },
    { owner: "timer" },
  );

  const completed = [];
  const tracker = createFocusTimerTracker({
    services,
    isTimerPluginEnabled: () => true,
    onFocusCompleted: (todoId, minutes) => completed.push({ todoId, minutes }),
  });

  const timerId = await tracker.startFocus("todo-alpha", 30);
  assert.equal(timerId, "timer-1");
  assert.deepEqual(startedCalls, [{ kind: "countdown", durationMs: 30 * 60_000 }]);

  provider.emit("due", {
    timer: { id: "unrelated-timer", kind: "countdown", durationMs: 60_000, elapsedMs: 60_000, runningSince: null, alerted: true },
    at: 2000,
  });
  assert.deepEqual(completed, []);

  provider.emit("due", {
    timer: { id: "timer-1", kind: "countdown", durationMs: 30 * 60_000, elapsedMs: 30 * 60_000, runningSince: null, alerted: true },
    at: 3000,
  });
  provider.emit("due", {
    timer: { id: "timer-1", kind: "countdown", durationMs: 30 * 60_000, elapsedMs: 30 * 60_000, runningSince: null, alerted: true },
    at: 3001,
  });
  assert.deepEqual(completed, [{ todoId: "todo-alpha", minutes: 30 }]);

  tracker.dispose();
  await provider.dispose();
});

test("leading HH:mm parser and timed todo reminders respect window, startup grace and deduplication", async () => {
  assert.deepEqual(parseLeadingTodoTime("15:00 给客户回电话"), {
    hours: 15,
    minutes: 0,
    timeKey: "15:00",
    label: "给客户回电话",
  });
  assert.deepEqual(parseLeadingTodoTime("9：30-10：00 晨会同步"), {
    hours: 9,
    minutes: 30,
    timeKey: "09:30",
    label: "晨会同步",
  });
  assert.equal(parseLeadingTodoTime("24:00 越界时刻"), null);
  assert.equal(parseLeadingTodoTime("15:00   "), null);
  assert.equal(parseLeadingTodoTime("下午 15:00 不在行首"), null);

  const date = "2026-11-18";
  const nineThirty = scheduledTodoTimeMs(date, 9, 30);
  const fifteen = scheduledTodoTimeMs(date, 15, 0);
  assert.ok(typeof nineThirty === "number" && typeof fifteen === "number");

  const todos = [
    { id: "old", title: "09:30 晨会", completed: false },
    { id: "due", title: "15:00 回电话", completed: false },
    { id: "done", title: "15:00 已完成事项", completed: true },
  ];

  const seen = new Set();
  const bootedAtMs = nineThirty + TIMED_REMINDER_STARTUP_GRACE_MS + 30_000;

  const atMorningBoot = collectDueTimedTodoReminders({
    date,
    todos,
    nowMs: bootedAtMs,
    bootedAtMs,
    seen,
  });
  assert.deepEqual(atMorningBoot, []);

  const beforeFifteen = collectDueTimedTodoReminders({
    date,
    todos,
    nowMs: fifteen - 1000,
    bootedAtMs,
    seen,
  });
  assert.deepEqual(beforeFifteen, []);

  const services = createWindowServices();
  const pushed = [];
  const provider = services.provide(
    remindersV1,
    {
      push: (reminder) => {
        pushed.push(reminder);
        return { shown: true };
      },
    },
    { owner: "timer" },
  );

  const triggered = dispatchTimedTodoReminders({
    services,
    date,
    todos,
    nowMs: fifteen + 60_000,
    bootedAtMs,
    seen,
  });
  assert.equal(triggered.length, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(pushed, [
    {
      id: "todos:2026-11-18:due:15:00",
      source: "todos",
      icon: "bell",
      title: "15:00 回电话",
      snoozable: true,
    },
  ]);

  const duplicate = dispatchTimedTodoReminders({
    services,
    date,
    todos,
    nowMs: fifteen + 2 * 60_000,
    bootedAtMs,
    seen,
  });
  assert.deepEqual(duplicate, []);

  const expiredWindow = collectDueTimedTodoReminders({
    date,
    todos: [{ id: "late", title: "15:00 迟到检查", completed: false }],
    nowMs: fifteen + TIMED_REMINDER_WINDOW_MS,
    bootedAtMs,
    seen: new Set(),
  });
  assert.deepEqual(expiredWindow, []);

  await provider.dispose();
});

test("normalizeTodoPrefs clamps focusTimerMinutes and defaults new C114.4 fields safely", () => {
  assert.equal(DEFAULT_TODO_PREFS.autoCompleteFromSubtasks, false);
  assert.equal(DEFAULT_TODO_PREFS.focusTimerEnabled, false);
  assert.equal(DEFAULT_TODO_PREFS.focusTimerMinutes, 25);
  assert.equal(DEFAULT_TODO_PREFS.timedReminderEnabled, true);

  assert.equal(normalizeTodoPrefs({ focusTimerMinutes: 1 }).focusTimerMinutes, 5);
  assert.equal(normalizeTodoPrefs({ focusTimerMinutes: 500 }).focusTimerMinutes, 120);
  assert.equal(normalizeTodoPrefs({ focusTimerMinutes: Number.NaN }).focusTimerMinutes, 25);
  assert.equal(normalizeTodoPrefs({ focusTimerMinutes: "30" }).focusTimerMinutes, 25);

  const custom = normalizeTodoPrefs({
    autoCompleteFromSubtasks: true,
    focusTimerEnabled: true,
    focusTimerMinutes: 45,
    timedReminderEnabled: false,
  });
  assert.equal(custom.autoCompleteFromSubtasks, true);
  assert.equal(custom.focusTimerEnabled, true);
  assert.equal(custom.focusTimerMinutes, 45);
  assert.equal(custom.timedReminderEnabled, false);
});
