import assert from "node:assert/strict";
import test from "node:test";
import { createWindowServices } from "@fuyu/plugin-base/client";
import { timersV1 } from "@fuyu/plugin-services";
import { addTodoFocusMinutes, creditFocus, withoutFocus } from "../../src/features/todos/normalize.ts";
import { createFocusTimerTracker } from "../../src/features/todos/useTodoFocusTimer.ts";

const MINUTE = 60_000;

function makeTodo(overrides = {}) {
  return {
    id: "todo-1",
    title: "整理设计方案",
    completed: false,
    createdAt: 1_760_000_000_000,
    ...overrides,
  };
}

test("a todo never gains more focus time than has passed since it was last credited", () => {
  const start = 1_760_000_000_000;
  const first = addTodoFocusMinutes(makeTodo(), 25, start);
  const overlapping = addTodoFocusMinutes(first, 25, start + MINUTE);
  assert.deepEqual([overlapping.focusMinutes, overlapping.focusedAt], [26, start + MINUTE]);
  assert.equal(addTodoFocusMinutes(first, 25, start), first);
  assert.equal(addTodoFocusMinutes(first, 25, start + 25 * MINUTE - 2000).focusMinutes, 50);
  assert.equal(addTodoFocusMinutes(first, 25, start + 90 * MINUTE).focusMinutes, 50);
  assert.equal(addTodoFocusMinutes({ ...first, focusedAt: start + 60 * MINUTE }, 25, start).focusMinutes, 50);
  assert.equal(addTodoFocusMinutes(makeTodo(), 5000, start).focusMinutes, 600);
  assert.equal(addTodoFocusMinutes(makeTodo(), Number.NaN, start).focusMinutes, undefined);
});

test("a countdown that runs out only counts while its todo is still in progress, a stopped one counts either way", () => {
  const now = 1_760_000_000_000;
  const todos = [makeTodo({ id: "doing", startedAt: now - 25 * MINUTE }), makeTodo({ id: "idle" }), makeTodo({ id: "done", completed: true })];
  assert.equal(creditFocus(todos, "doing", 25, "due", now)[0].focusMinutes, 25);
  assert.equal(creditFocus(todos, "idle", 25, "due", now), todos);
  assert.equal(creditFocus(todos, "done", 25, "due", now), todos);
  assert.equal(creditFocus(todos, "gone", 25, "stopped", now), todos);
  assert.equal(creditFocus(todos, "idle", 12, "stopped", now)[1].focusMinutes, 12);
  assert.equal(creditFocus(todos, "done", 12, "stopped", now)[2].focusMinutes, 12);
});

test("a todo carried to the next day leaves its focus time behind", () => {
  const carried = withoutFocus(makeTodo({ focusMinutes: 50, focusedAt: 1_760_000_000_000, note: "keep" }));
  assert.deepEqual(carried, makeTodo({ note: "keep" }));
  const plain = makeTodo();
  assert.equal(withoutFocus(plain), plain);
});

function fakeTimerService(services) {
  const startedCalls = [];
  const removed = [];
  const timers = new Map();
  const state = { at: 1000 };
  const provider = services.provide(
    timersV1,
    {
      list: () => ({ timers: [...timers.values()], at: state.at }),
      start: (params) => {
        startedCalls.push(params);
        const timer = {
          id: `timer-${startedCalls.length}`,
          kind: "countdown",
          durationMs: params.kind === "countdown" ? params.durationMs : 0,
          elapsedMs: 0,
          runningSince: state.at,
          alerted: false,
        };
        timers.set(timer.id, timer);
        return { timer };
      },
      pause: () => { throw new Error("unused"); },
      resume: () => { throw new Error("unused"); },
      extend: () => { throw new Error("unused"); },
      remove: ({ id }) => {
        removed.push(id);
        return { removed: timers.delete(id) };
      },
      dismissRinging: () => ({ removed: 0 }),
      adopt: () => ({ timers: [], added: 0, at: 0 }),
    },
    { owner: "timer" },
  );
  return { provider, startedCalls, removed, timers, state };
}

test("stopping or finishing a todo removes its countdown and credits the whole minutes spent, deleting it credits nothing", async () => {
  const services = createWindowServices();
  const { provider, removed, timers, state } = fakeTimerService(services);
  const completed = [];
  const tracker = createFocusTimerTracker({
    services,
    isTimerPluginEnabled: () => true,
    onFocusCompleted: (todoId, minutes, kind) => completed.push({ todoId, minutes, kind }),
  });

  await tracker.startFocus("todo-a", 25);
  state.at += 12 * MINUTE + 40_000;
  await tracker.stopFocus("todo-a", "stopped");
  assert.deepEqual(completed, [{ todoId: "todo-a", minutes: 12, kind: "stopped" }]);
  assert.deepEqual([removed, timers.size, tracker.activeCount()], [["timer-1"], 0, 0]);

  await tracker.startFocus("todo-a", 25);
  timers.set("timer-2", { ...timers.get("timer-2"), elapsedMs: 3 * MINUTE, runningSince: null });
  state.at += 50 * MINUTE;
  await tracker.stopFocus("todo-a", "completed");
  assert.deepEqual(completed.at(-1), { todoId: "todo-a", minutes: 3, kind: "stopped" });

  await tracker.startFocus("todo-b", 25);
  state.at += 10 * MINUTE;
  await tracker.stopFocus("todo-b", "removed");
  await tracker.stopFocus("todo-b", "stopped");
  assert.equal(completed.length, 2);
  assert.deepEqual(removed, ["timer-1", "timer-2", "timer-3"]);

  provider.emit("due", { timer: { id: "timer-1", kind: "countdown", durationMs: 25 * MINUTE, elapsedMs: 25 * MINUTE, runningSince: null, alerted: true }, at: state.at });
  assert.equal(completed.length, 2);

  tracker.dispose();
  await provider.dispose();
});

test("starting a todo again keeps a single countdown, and a stop that arrives before the countdown exists cancels it", async () => {
  const services = createWindowServices();
  const { provider, removed, timers, state } = fakeTimerService(services);
  const completed = [];
  const tracker = createFocusTimerTracker({
    services,
    isTimerPluginEnabled: () => true,
    onFocusCompleted: (todoId, minutes, kind) => completed.push({ todoId, minutes, kind }),
  });

  await tracker.startFocus("todo-a", 25);
  state.at += 5 * MINUTE;
  await tracker.startFocus("todo-a", 25);
  assert.deepEqual([removed, [...timers.keys()], tracker.activeCount()], [["timer-1"], ["timer-2"], 1]);
  assert.deepEqual(completed, []);

  const pending = tracker.startFocus("todo-c", 25);
  await tracker.stopFocus("todo-c", "stopped");
  assert.equal(await pending, null);
  assert.deepEqual([[...timers.keys()], tracker.activeCount()], [["timer-2"], 1]);
  assert.deepEqual(completed, []);

  tracker.dispose();
  await provider.dispose();
});

test("focus timer tracker starts countdown via timers/v1 and credits focusMinutes once on due", async () => {
  const services = createWindowServices();
  const { provider, startedCalls } = fakeTimerService(services);

  const completed = [];
  const tracker = createFocusTimerTracker({
    services,
    isTimerPluginEnabled: () => true,
    onFocusCompleted: (todoId, minutes, kind) => completed.push({ todoId, minutes, kind }),
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
  assert.deepEqual(completed, [{ todoId: "todo-alpha", minutes: 30, kind: "due" }]);

  tracker.dispose();
  await provider.dispose();
});
