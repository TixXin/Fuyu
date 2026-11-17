import assert from "node:assert/strict";
import { test } from "node:test";
import { visibilityInterval } from "../../src/lib/useVisibilityInterval.ts";

function installDom(initiallyHidden = false) {
  let nextId = 1;
  const timers = new Map();
  const listeners = new Set();
  const doc = {
    hidden: initiallyHidden,
    addEventListener(type, fn) {
      if (type === "visibilitychange") listeners.add(fn);
    },
    removeEventListener(type, fn) {
      if (type === "visibilitychange") listeners.delete(fn);
    },
  };
  const win = {
    setInterval(fn, ms) {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
  };
  globalThis.document = doc;
  globalThis.window = win;
  return {
    timers,
    listeners,
    tick() {
      for (const entry of [...timers.values()]) entry.fn();
    },
    setHidden(hidden) {
      doc.hidden = hidden;
      for (const fn of [...listeners]) fn();
    },
  };
}

test("visibilityInterval starts when visible, pauses when hidden, and refreshes immediately on show", () => {
  const dom = installDom(false);
  let calls = 0;
  const stop = visibilityInterval(() => {
    calls += 1;
  }, 1000);

  assert.equal(dom.timers.size, 1);
  assert.equal(calls, 0);

  dom.tick();
  assert.equal(calls, 1);

  dom.setHidden(true);
  assert.equal(dom.timers.size, 0);
  dom.tick();
  assert.equal(calls, 1);

  dom.setHidden(false);
  assert.equal(calls, 2);
  assert.equal(dom.timers.size, 1);

  dom.tick();
  assert.equal(calls, 3);

  stop();
  assert.equal(dom.timers.size, 0);
  assert.equal(dom.listeners.size, 0);
});

test("visibilityInterval does not arm a timer while initially hidden until shown", () => {
  const dom = installDom(true);
  let calls = 0;
  const stop = visibilityInterval(() => {
    calls += 1;
  }, 500);

  assert.equal(dom.timers.size, 0);
  dom.tick();
  assert.equal(calls, 0);

  dom.setHidden(false);
  assert.equal(calls, 1);
  assert.equal(dom.timers.size, 1);

  stop();
  assert.equal(dom.timers.size, 0);
});
