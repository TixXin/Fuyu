import assert from "node:assert/strict";
import test from "node:test";
import { adoptActiveTodo, isInProgress, latestStartedId, toggleStarted } from "../../src/features/todos/activeTodos.ts";
import { normalizeTodo } from "../../src/features/todos/normalize.ts";

const todo = (id, fields = {}) => ({ id, title: id, completed: false, createdAt: 0, ...fields });

test("starting one todo leaves the others in progress, and the newest is the active one", () => {
  let todos = [todo("a"), todo("b"), todo("c")];
  todos = toggleStarted(todos, "a", 10);
  todos = toggleStarted(todos, "b", 20);
  assert.deepEqual(todos.filter(isInProgress).map((item) => item.id), ["a", "b"]);
  assert.equal(latestStartedId(todos), "b");
  todos = toggleStarted(todos, "b", 30);
  assert.equal(todos[1].startedAt, undefined);
  assert.equal("startedAt" in todos[1], false);
  assert.equal(latestStartedId(todos), "a");
  assert.equal(latestStartedId(toggleStarted(todos, "a", 40)), null);
});

test("done todos are never in progress and cannot be started", () => {
  const todos = [todo("a", { completed: true, startedAt: 5 }), todo("b", { startedAt: 3 })];
  assert.equal(latestStartedId(todos), "b");
  assert.deepEqual(toggleStarted(todos, "a", 9), todos);
});

test("an active todo from older data or another version becomes in progress", () => {
  const todos = [todo("a", { startedAt: 50 }), todo("b")];
  const adopted = adoptActiveTodo(todos, "b", 10);
  assert.equal(adopted[1].startedAt, 51);
  assert.equal(latestStartedId(adopted), "b");
  assert.equal(adoptActiveTodo(todos, "a", 10), todos);
  assert.equal(adoptActiveTodo(todos, "zzz", 10), todos);
  assert.equal(adoptActiveTodo(todos, null, 10), todos);
});

test("normalize keeps the start time only on open todos", () => {
  assert.equal(normalizeTodo(todo("a", { startedAt: 7 })).startedAt, 7);
  assert.equal("startedAt" in normalizeTodo(todo("a", { startedAt: 7, completed: true })), false);
  assert.equal("startedAt" in normalizeTodo(todo("a", { startedAt: "7" })), false);
});
