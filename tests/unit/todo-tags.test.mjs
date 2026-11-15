import assert from "node:assert/strict";
import test from "node:test";
import { formatTodosAsMarkdown, getTodoSignature } from "../../src/features/todos/markdown.ts";
import { parseScheduledTodos, parseTodoArchives, parseTodos } from "../../src/features/todos/normalize.ts";
import { toTodoItems } from "../../src/features/todos/schedule.ts";
import { readTags, withTags } from "../../src/features/todos/tags.ts";
import { dueReminderId, pickDueReminders } from "../../src/features/todos/dueReminders.ts";

test("old todos without priority or color read back unchanged", () => {
  const old = [{ id: "a", title: "写周报", completed: false, createdAt: 1 }];
  assert.deepEqual(parseTodos(JSON.stringify(old)), old);
  const scheduled = [{ id: "s", title: "牙医", date: "2026-11-20", createdAt: 2, project: "家" }];
  assert.deepEqual(parseScheduledTodos(JSON.stringify(scheduled)), scheduled);
  const archives = [{ date: "2026-11-01", todos: old, dailyNote: "", savedAt: 0, savedToDisk: true }];
  assert.deepEqual(parseTodoArchives(JSON.stringify(archives))[0].todos, old);
});

test("priority and color are kept when valid and dropped when not", () => {
  const [todo, odd] = parseTodos(JSON.stringify([
    { id: "a", title: "交报销", completed: false, createdAt: 1, priority: "high", color: "red" },
    { id: "b", title: "买菜", completed: false, createdAt: 2, priority: "urgent", color: "#ff0000" },
  ]));
  assert.equal(todo.priority, "high");
  assert.equal(todo.color, "red");
  assert.equal("priority" in odd, false);
  assert.equal("color" in odd, false);
  const [scheduled] = parseScheduledTodos(JSON.stringify([{ id: "s", title: "牙医", date: "2026-11-20", createdAt: 0, priority: "low", color: "blue" }]));
  assert.deepEqual(readTags(scheduled), { priority: "low", color: "blue" });
});

test("a scheduled todo keeps its tags when it becomes today's", () => {
  const [item] = toTodoItems([{ id: "s", title: "牙医", date: "2026-11-20", createdAt: 0, priority: "high", color: "green" }]);
  assert.deepEqual(item, { id: "s", title: "牙医", completed: false, createdAt: 0, priority: "high", color: "green" });
});

test("withTags sets one tag at a time and undefined clears it", () => {
  const todo = { id: "a", title: "x", priority: "high", color: "red" };
  assert.deepEqual(withTags(todo, { color: "blue" }), { id: "a", title: "x", priority: "high", color: "blue" });
  assert.deepEqual(withTags(todo, { priority: undefined }), { id: "a", title: "x", color: "red" });
  assert.deepEqual(withTags({ id: "b", title: "y" }, { priority: "nope" }), { id: "b", title: "y" });
});

test("the Markdown export and its signature do not change with tags", () => {
  const plain = [{ id: "a", title: "写周报", completed: true, createdAt: 0 }];
  const tagged = [{ ...plain[0], priority: "high", color: "red" }];
  assert.equal(formatTodosAsMarkdown(tagged), formatTodosAsMarkdown(plain));
  assert.equal(getTodoSignature("2026-11-15", tagged, ""), getTodoSignature("2026-11-15", plain, ""));
});

test("only high-priority due todos are reminded, each once a day", () => {
  const due = [
    { id: "a", title: "交报销", date: "2026-11-15", createdAt: 0, priority: "high" },
    { id: "b", title: "买菜", date: "2026-11-15", createdAt: 0, priority: "medium" },
    { id: "c", title: "牙医", date: "2026-11-14", createdAt: 0, priority: "high" },
    { id: "d", title: "看书", date: "2026-11-15", createdAt: 0 },
  ];
  const seen = new Set();
  assert.deepEqual(pickDueReminders(due, seen).map((todo) => todo.id), ["a", "c"]);
  assert.deepEqual(pickDueReminders(due, seen), []);
  assert.equal(dueReminderId(due[0]), "todo-due:2026-11-15:a");
  assert.deepEqual(pickDueReminders([{ ...due[0], date: "2026-11-22" }], seen).map((todo) => todo.id), ["a"]);
});
