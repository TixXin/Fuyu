import assert from "node:assert/strict";
import { test } from "node:test";
import { marketV1 } from "@fuyu/plugin-services";
import { apply } from "../../src/features/updater/host/index.mjs";
import { firstFetchStep, needsFirstFetch } from "../../src/windows/settings/marketFirstOpen.ts";
import { createMarketWorld } from "./market-v3-fixtures.mjs";

const EMPTY = { updatedAt: null, plugins: [] };
const FETCHED_EMPTY = { updatedAt: 1, plugins: [] };
const CACHED = { updatedAt: 1, plugins: [{ name: "@someone/clock" }] };

test("a market that was never fetched asks for one fetch, then waits for it instead of showing the empty page", () => {
  assert.equal(needsFirstFetch(EMPTY), true);
  assert.equal(needsFirstFetch(FETCHED_EMPTY), false);
  assert.equal(needsFirstFetch(CACHED), false);
  assert.equal(firstFetchStep("idle", EMPTY), "fetch");
  assert.equal(firstFetchStep("pending", EMPTY), "hold");
  assert.equal(firstFetchStep("failed", EMPTY), "keep-failure");
  assert.equal(firstFetchStep("done", EMPTY), "show");
});

test("a cached catalog is shown as is, whatever happened to the first fetch", () => {
  for (const phase of ["idle", "pending", "failed", "done"]) {
    assert.equal(firstFetchStep(phase, CACHED), "show");
    assert.equal(firstFetchStep(phase, FETCHED_EMPTY), "show");
  }
});

function fakeContext(world) {
  const timers = [];
  let provided = null;
  const ctx = {
    dataDir: world.dataDir,
    services: {
      provide: (definition, methods) => {
        assert.equal(definition, marketV1);
        provided = methods;
        return { emit: () => undefined };
      },
    },
    setTimeout: (fn, ms) => {
      timers.push({ kind: "timeout", ms });
      return () => undefined;
    },
    setInterval: (fn, ms) => {
      timers.push({ kind: "interval", ms });
      return () => undefined;
    },
    effect: () => undefined,
  };
  return { ctx, timers, methods: () => provided };
}

test("with no plugin installed the host fetches the catalog when the market page asks, and still does not poll", async () => {
  const world = createMarketWorld("fuyu-first-open-");
  try {
    world.putIndex(1, [{ name: "@someone/clock", versions: [world.version({ version: "1.0.0" })] }]);
    world.putRevoked(1, []);
    const { ctx, timers, methods } = fakeContext(world);
    apply(ctx, world.options);
    assert.deepEqual(timers, []);

    const settings = { window: "settings" };
    const before = await methods().catalog(undefined, settings);
    assert.equal(needsFirstFetch(before), true);

    const after = await methods().refresh(undefined, settings);
    assert.equal(needsFirstFetch(after), false);
    assert.deepEqual(after.plugins.map((plugin) => plugin.name), ["@someone/clock"]);
    assert.equal(after.updatedAt, world.clock.now);
    assert.deepEqual(timers, []);
  } finally {
    world.cleanup();
  }
});

test("once a market plugin is installed the host starts its background checks", async () => {
  const world = createMarketWorld("fuyu-first-open-polling-");
  try {
    world.putIndex(1, [{ name: "@someone/clock", versions: [world.version({ version: "1.0.0" })] }]);
    world.putRevoked(1, []);
    const { ctx, timers, methods } = fakeContext(world);
    apply(ctx, world.options);
    const settings = { window: "settings" };
    await methods().refresh(undefined, settings);
    await methods().installMarket({ name: "@someone/clock" }, settings);
    assert.deepEqual(timers.map((timer) => timer.kind), ["interval"]);
  } finally {
    world.cleanup();
  }
});
