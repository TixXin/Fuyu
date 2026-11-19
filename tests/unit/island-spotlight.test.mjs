import assert from "node:assert/strict";
import test from "node:test";
import {
  SPOTLIGHT_HOLD_MS,
  SPOTLIGHT_WAIT_MS,
  createSpotlightStore,
  readIslandSpotlightRequest,
  showsOnIsland,
} from "../../src/features/plugin-kernel/islandSpotlight.ts";

function fakeClock() {
  let now = 0;
  let next = 1;
  const timers = new Map();
  return {
    setTimer: (run, ms) => {
      const id = next;
      next += 1;
      timers.set(id, { run, at: now + ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at > now) continue;
        timers.delete(id);
        timer.run();
      }
    },
    pending: () => timers.size,
  };
}

test("a spotlight request needs a plugin id, anything else is ignored", () => {
  assert.deepEqual(readIslandSpotlightRequest({ pluginId: "@fuyu/weather", extra: 1 }), { pluginId: "@fuyu/weather" });
  for (const payload of [null, undefined, "@fuyu/weather", {}, { pluginId: "" }, { pluginId: 3 }]) {
    assert.equal(readIslandSpotlightRequest(payload), null);
  }
});

test("only a plugin with a place on the island is pointed out", () => {
  assert.equal(showsOnIsland(["island.collapsed/v1"]), true);
  assert.equal(showsOnIsland(["settings.section/v1", "island.page/v1"]), true);
  assert.equal(showsOnIsland(["settings.section/v1"]), false);
  assert.equal(showsOnIsland([]), false);
  assert.equal(showsOnIsland(undefined), false);
});

test("a plugin that never shows up on the island is forgotten after the wait, so nothing lights up later", () => {
  const clock = fakeClock();
  const store = createSpotlightStore(clock);
  let changes = 0;
  store.subscribe(() => {
    changes += 1;
  });
  store.request("@fuyu/weather");
  assert.equal(store.owner(), "@fuyu/weather");
  clock.advance(SPOTLIGHT_WAIT_MS - 1);
  assert.equal(store.owner(), "@fuyu/weather");
  clock.advance(1);
  assert.equal(store.owner(), null);
  assert.equal(changes, 2);
  assert.equal(clock.pending(), 0);
});

test("once the highlight has run it is over, and a late timer does not clear the next plugin's", () => {
  const clock = fakeClock();
  const store = createSpotlightStore(clock);
  store.request("@fuyu/weather");
  store.end("@fuyu/weather");
  assert.equal(store.owner(), null);
  assert.equal(clock.pending(), 0);
  store.request("@fuyu/alarm");
  clock.advance(SPOTLIGHT_WAIT_MS - 1);
  assert.equal(store.owner(), "@fuyu/alarm");
});

test("a highlight that starts just before the wait runs out is not cut off, but cannot hang on forever", () => {
  const clock = fakeClock();
  const store = createSpotlightStore(clock);
  store.request("@fuyu/weather");
  clock.advance(SPOTLIGHT_WAIT_MS - 10);
  store.hold("@fuyu/weather");
  clock.advance(SPOTLIGHT_HOLD_MS - 1);
  assert.equal(store.owner(), "@fuyu/weather");
  clock.advance(1);
  assert.equal(store.owner(), null);
});

test("a newer install replaces the one waiting, and the older plugin's events no longer count", () => {
  const clock = fakeClock();
  const store = createSpotlightStore(clock);
  store.request("@fuyu/weather");
  clock.advance(5_000);
  store.request("@fuyu/alarm");
  store.end("@fuyu/weather");
  store.hold("@fuyu/weather");
  assert.equal(store.owner(), "@fuyu/alarm");
  clock.advance(SPOTLIGHT_WAIT_MS - 1);
  assert.equal(store.owner(), "@fuyu/alarm");
  clock.advance(1);
  assert.equal(store.owner(), null);
});
