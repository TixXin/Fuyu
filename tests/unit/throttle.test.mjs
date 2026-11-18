import assert from "node:assert/strict";
import test from "node:test";
import { throttle } from "../../src/utils/throttle.ts";

function fakeClock() {
  let current = 1000;
  let nextId = 1;
  const tasks = new Map();
  return {
    now: () => current,
    schedule: (callback, delayMs) => {
      const id = nextId++;
      tasks.set(id, { runAt: current + delayMs, callback });
      return id;
    },
    clear: (id) => {
      tasks.delete(id);
    },
    advance: (ms) => {
      const target = current + ms;
      while (true) {
        let earliestId = null;
        let earliest = null;
        for (const [id, task] of tasks) {
          if (task.runAt <= target && (!earliest || task.runAt < earliest.runAt)) {
            earliestId = id;
            earliest = task;
          }
        }
        if (!earliest) break;
        tasks.delete(earliestId);
        current = earliest.runAt;
        earliest.callback();
      }
      current = target;
    },
    pendingCount: () => tasks.size,
  };
}

test("throttle runs leading call immediately and coalesces burst to latest trailing value", () => {
  const clock = fakeClock();
  const seen = [];
  const push = throttle((value) => seen.push([clock.now(), value]), 16, clock);

  push("a");
  push("b");
  clock.advance(5);
  push("c");
  assert.deepEqual(seen, [[1000, "a"]]);
  assert.equal(clock.pendingCount(), 1);

  clock.advance(11);
  assert.deepEqual(seen, [
    [1000, "a"],
    [1016, "c"],
  ]);
  assert.equal(clock.pendingCount(), 0);
});

test("throttle flush delivers pending value immediately and cancel drops queued trailing call", () => {
  const clock = fakeClock();
  const seen = [];
  const push = throttle((value) => seen.push(value), 20, clock);

  push(1);
  push(2);
  push.flush();
  assert.deepEqual(seen, [1, 2]);
  assert.equal(clock.pendingCount(), 0);

  push(3);
  assert.deepEqual(seen, [1, 2]);
  push.cancel();
  clock.advance(50);
  assert.deepEqual(seen, [1, 2]);
});
