import assert from "node:assert/strict";
import test from "node:test";
import { runTodoApiCall } from "../../src/features/todos/apiCommands.ts";
import {
  carriedDaysCount,
  deadlineStatus,
  diffDays,
  effectiveCreatedAt,
  formatDeadlineBadge,
  nextCarriedFrom,
  pickDeadlineReminders,
} from "../../src/features/todos/deadline.ts";
import { formatTodosAsMarkdown, getTodoSignature } from "../../src/features/todos/markdown.ts";
import { normalizeTodo } from "../../src/features/todos/normalize.ts";
import { withTags } from "../../src/features/todos/tags.ts";
import { DEFAULT_TODO_PREFS, normalizeTodoPrefs, sortTodos } from "../../src/features/todos/todoPrefs.ts";

const FORMAT_TEXT = {
  dueToday: "今天截止",
  dueTomorrow: "明天截止",
  dueOn: (dateText) => `${dateText}截止`,
  overdue: (days) => `逾期 ${days} 天`,
};

test("deadlineStatus and formatDeadlineBadge produce normal, soon, and overdue tones", () => {
  assert.equal(diffDays("2026-11-25", "2026-11-27"), 2);
  assert.deepEqual(deadlineStatus("2026-11-27", "2026-11-25"), { daysLeft: 2, tone: "normal" });
  assert.deepEqual(deadlineStatus("2026-11-26", "2026-11-25"), { daysLeft: 1, tone: "soon" });
  assert.deepEqual(deadlineStatus("2026-11-25", "2026-11-25"), { daysLeft: 0, tone: "soon" });
  assert.deepEqual(deadlineStatus("2026-11-23", "2026-11-25"), { daysLeft: -2, tone: "overdue" });

  assert.deepEqual(formatDeadlineBadge("2026-11-25", "2026-11-25", "zh-CN", FORMAT_TEXT), { label: "今天截止", tone: "soon" });
  assert.deepEqual(formatDeadlineBadge("2026-11-26", "2026-11-25", "zh-CN", FORMAT_TEXT), { label: "明天截止", tone: "soon" });
  assert.deepEqual(formatDeadlineBadge("2026-11-23", "2026-11-25", "zh-CN", FORMAT_TEXT), { label: "逾期 2 天", tone: "overdue" });
  const future = formatDeadlineBadge("2026-11-27", "2026-11-25", "zh-CN", FORMAT_TEXT);
  assert.equal(future?.tone, "normal");
  assert.match(future?.label ?? "", /截止$/);
});

test("carriedDaysCount, nextCarriedFrom, and sortTodos createdDesc honor carriedFrom", () => {
  assert.equal(carriedDaysCount("2026-11-22", "2026-11-25"), 3);
  assert.equal(carriedDaysCount(undefined, "2026-11-25"), 0);
  assert.equal(nextCarriedFrom({}, "2026-11-25"), "2026-11-25");
  assert.equal(nextCarriedFrom({ carriedFrom: "2026-11-20" }, "2026-11-25"), "2026-11-20");

  const todayNew = { id: "new", createdAt: new Date("2026-11-25T09:00:00").getTime() };
  const carriedYesterday = { id: "c1", createdAt: new Date("2026-11-25T00:01:00").getTime(), carriedFrom: "2026-11-24" };
  const carriedOld = { id: "c3", createdAt: new Date("2026-11-25T10:00:00").getTime(), carriedFrom: "2026-11-21" };
  assert.ok(effectiveCreatedAt(todayNew) > effectiveCreatedAt(carriedYesterday));
  assert.ok(effectiveCreatedAt(carriedYesterday) > effectiveCreatedAt(carriedOld));
  assert.deepEqual(
    sortTodos([carriedOld, todayNew, carriedYesterday], "createdDesc").map((t) => t.id),
    ["new", "c1", "c3"],
  );
});

test("withTags, normalizeTodo, markdown export, and prefs handle deadline and carriedFrom", () => {
  const base = normalizeTodo({ id: "t1", title: "报销单据", createdAt: 1000, deadline: "2026-11-28", carriedFrom: "2026-11-22" });
  assert.equal(base.deadline, "2026-11-28");
  assert.equal(base.carriedFrom, "2026-11-22");

  const updated = withTags(base, { deadline: "2026-11-29" });
  assert.equal(updated.deadline, "2026-11-29");
  const cleared = withTags(updated, { deadline: undefined });
  assert.equal("deadline" in cleared, false);

  assert.equal(formatTodosAsMarkdown([base]), "- [ ] 报销单据 (截止 11-28)");
  assert.notEqual(getTodoSignature("2026-11-25", [base], ""), getTodoSignature("2026-11-25", [cleared], ""));

  assert.equal(DEFAULT_TODO_PREFS.showCarriedDays, true);
  assert.equal(DEFAULT_TODO_PREFS.deadlineReminder, "dayBefore");
  assert.equal(normalizeTodoPrefs({ showCarriedDays: false, deadlineReminder: "sameDay" }).showCarriedDays, false);
  assert.equal(normalizeTodoPrefs({ deadlineReminder: "sameDay" }).deadlineReminder, "sameDay");
  assert.equal(normalizeTodoPrefs({ deadlineReminder: "bogus" }).deadlineReminder, "dayBefore");
});

test("pickDeadlineReminders respects off, sameDay, and dayBefore modes without duplicating", () => {
  const todos = [
    { id: "today", title: "Today due", completed: false, deadline: "2026-11-25" },
    { id: "tomorrow", title: "Tomorrow due", completed: false, deadline: "2026-11-26" },
    { id: "later", title: "Later due", completed: false, deadline: "2026-11-28" },
    { id: "done", title: "Done due", completed: true, deadline: "2026-11-25" },
  ];
  assert.deepEqual(pickDeadlineReminders(todos, "2026-11-25", "off", new Set()), []);
  assert.deepEqual(pickDeadlineReminders(todos, "2026-11-25", "sameDay", new Set()).map((r) => r.todo.id), ["today"]);
  const seen = new Set();
  assert.deepEqual(pickDeadlineReminders(todos, "2026-11-25", "dayBefore", seen).map((r) => r.todo.id), ["today", "tomorrow"]);
  assert.deepEqual(pickDeadlineReminders(todos, "2026-11-25", "dayBefore", seen), []);
});

test("runTodoApiCall adds, updates, validates, and clears deadlines", () => {
  const state = { date: "2026-11-25", todos: [], scheduledTodos: [], activeTodoId: null, dailyNote: "", archives: [] };
  const added = runTodoApiCall("todos.add", { title: "Ship", deadline: "2026-11-29" }, state, { id: "a1", now: 100 });
  assert.equal(added.result.ok, true);
  assert.equal(added.change?.todos?.[0].deadline, "2026-11-29");

  const nextState = { ...state, todos: added.change?.todos ?? [] };
  const cleared = runTodoApiCall("todos.update", { id: "a1", deadline: null }, nextState, { id: "", now: 200 });
  assert.equal(cleared.result.ok, true);
  assert.equal(cleared.change?.todos?.[0].deadline, undefined);

  const bad = runTodoApiCall("todos.add", { title: "Bad", deadline: "2026-99-99" }, state, { id: "a2", now: 300 });
  assert.equal(bad.result.ok, false);
});
