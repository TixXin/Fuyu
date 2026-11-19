import assert from "node:assert/strict";
import { test } from "node:test";
import { dismissAutoUpdated, mergeAutoUpdated, normalizeAutoUpdated } from "../../src/features/updater/host/marketAutoUpdated.mjs";
import { changelogBetween, compareReleaseVersions } from "../../src/windows/settings/marketAutoUpdated.ts";
import { DAY, createMarketWorld } from "./market-v3-fixtures.mjs";

const CLOCK = "@someone/clock";
const ALARM = "@someone/alarm";
const named = (name) => ({ "zh-CN": name, en: name });

async function installed(world, plugins) {
  world.putIndex(1, plugins.map((name) => ({ name, versions: [world.version({ name, version: "1.0.0" })] })));
  world.putRevoked(1, []);
  await world.market.refresh();
  for (const name of plugins) await world.market.installMarket({ name });
}

function publish(world, serial, versions) {
  world.putIndex(serial, Object.entries(versions).map(([name, list]) => ({ name, versions: list.map((version) => world.version({ name, version })) })));
}

test("a silent update is reported in the snapshot with the plugin, both versions and the time", async () => {
  const world = createMarketWorld("fuyu-auto-updated-");
  try {
    await installed(world, [CLOCK, ALARM]);
    assert.equal((await world.market.catalog()).autoUpdated, null);

    world.clock.now += DAY;
    publish(world, 2, { [CLOCK]: ["1.0.0", "1.1.0"], [ALARM]: ["1.0.0"] });
    const first = await world.market.refresh();
    assert.deepEqual(first.autoUpdated, { at: world.clock.now, plugins: [{ name: CLOCK, displayName: named(CLOCK), from: "1.0.0", to: "1.1.0" }] });
    assert.equal(first.installed.find((item) => item.id === CLOCK).version, "1.1.0");
    assert.deepEqual((await world.market.catalog()).autoUpdated, first.autoUpdated);
  } finally {
    world.cleanup();
  }
});

test("updates that arrive before the notice is closed join it, and each plugin keeps the version it started from", async () => {
  const world = createMarketWorld("fuyu-auto-updated-merge-");
  try {
    await installed(world, [CLOCK, ALARM]);
    world.clock.now += DAY;
    publish(world, 2, { [CLOCK]: ["1.0.0", "1.1.0"], [ALARM]: ["1.0.0"] });
    await world.market.refresh();

    world.clock.now += DAY;
    publish(world, 3, { [CLOCK]: ["1.0.0", "1.1.0", "1.2.0"], [ALARM]: ["1.0.0", "1.0.1"] });
    const second = await world.market.refresh();
    assert.equal(second.autoUpdated.at, world.clock.now);
    assert.deepEqual(second.autoUpdated.plugins.map((item) => [item.name, item.from, item.to]).sort(), [[ALARM, "1.0.0", "1.0.1"], [CLOCK, "1.0.0", "1.2.0"]]);

    world.clock.now += DAY;
    const quiet = await world.market.refresh();
    assert.deepEqual(quiet.autoUpdated, second.autoUpdated);
  } finally {
    world.cleanup();
  }
});

test("closing the notice removes that batch for good, but not one that arrived after the window last looked", async () => {
  const world = createMarketWorld("fuyu-auto-updated-dismiss-");
  try {
    await installed(world, [CLOCK]);
    world.clock.now += DAY;
    publish(world, 2, { [CLOCK]: ["1.0.0", "1.1.0"] });
    const seen = (await world.market.refresh()).autoUpdated;

    world.clock.now += DAY;
    publish(world, 3, { [CLOCK]: ["1.0.0", "1.1.0", "1.2.0"] });
    const newer = (await world.market.refresh()).autoUpdated;
    let changed = 0;
    world.market.subscribe(() => (changed += 1));

    assert.deepEqual(await world.market.dismissAutoUpdated({ at: seen.at }), { dismissed: true });
    assert.deepEqual((await world.market.catalog()).autoUpdated, newer);
    await world.market.dismissAutoUpdated({ at: newer.at });
    assert.equal((await world.market.catalog()).autoUpdated, null);
    assert.equal(changed, 2);

    world.clock.now += DAY;
    assert.equal((await world.market.refresh()).autoUpdated, null);
    await assert.rejects(() => world.market.dismissAutoUpdated({}), (error) => error.code === "bad-params");
  } finally {
    world.cleanup();
  }
});

test("a damaged record in the state file is dropped instead of reaching the window", () => {
  assert.equal(normalizeAutoUpdated(null), null);
  assert.equal(normalizeAutoUpdated({ at: "yesterday", plugins: [] }), null);
  assert.equal(normalizeAutoUpdated({ at: 1, plugins: [{ name: CLOCK, from: "1.0.0" }, { name: 3, from: "1", to: "2" }] }), null);
  assert.deepEqual(normalizeAutoUpdated({ at: 1, plugins: [{ name: CLOCK, displayName: { en: "Clock", zh: 3 }, from: "1.0.0", to: "1.1.0", extra: true }, "junk"] }), {
    at: 1,
    plugins: [{ name: CLOCK, displayName: { en: "Clock" }, from: "1.0.0", to: "1.1.0" }],
  });
  assert.equal(mergeAutoUpdated(null, [], 5), null);
  assert.deepEqual(mergeAutoUpdated(null, [{ name: CLOCK, displayName: "Clock", from: "1.0.0", to: "1.1.0" }], 5), { at: 5, plugins: [{ name: CLOCK, from: "1.0.0", to: "1.1.0" }] });
  assert.equal(dismissAutoUpdated({ at: 5, plugins: [{ name: CLOCK, from: "1.0.0", to: "1.1.0" }] }, 5), null);
});

const CHANGELOG = [
  "# 更新记录 · Changelog",
  "",
  "## 1.2.0",
  "",
  "- 默认停留 3 秒。",
  "- Notices stay for 3 seconds.",
  "",
  "## 1.1.1",
  "",
  "- 修了漏歌。",
  "",
  "## [1.1.0] - 2026-11-01",
  "",
  "- 新图标。",
  "",
  "## 1.0.0",
  "",
  "- 第一版。",
].join("\r\n");

test("the notice shows only the changelog entries between the old and the new version", () => {
  assert.equal(changelogBetween(CHANGELOG, "1.1.0", "1.2.0"), "## 1.2.0\n\n- 默认停留 3 秒。\n- Notices stay for 3 seconds.\n\n## 1.1.1\n\n- 修了漏歌。");
  assert.equal(changelogBetween(CHANGELOG, "1.0.0", "1.1.0"), "## [1.1.0] - 2026-11-01\n\n- 新图标。");
  assert.equal(changelogBetween(CHANGELOG, "1.2.0", "1.3.0"), null);
  assert.equal(changelogBetween("### v2.0.0-beta.2\nFaster.\n### 2.0.0-beta.1\nFirst beta.", "2.0.0-beta.1", "2.0.0-beta.2"), "### v2.0.0-beta.2\nFaster.");
  assert.equal(changelogBetween("Just some notes without versions.", "1.0.0", "1.1.0"), null);
  assert.equal(changelogBetween(null, "1.0.0", "1.1.0"), null);
});

test("versions are compared by number, and a pre-release comes before its release", () => {
  assert.equal(compareReleaseVersions("1.10.0", "1.9.0") > 0, true);
  assert.equal(compareReleaseVersions("1.0.0-beta.2", "1.0.0-beta.10") < 0, true);
  assert.equal(compareReleaseVersions("1.0.0-beta.2", "1.0.0") < 0, true);
  assert.equal(compareReleaseVersions("v1.2.3", "1.2.3"), 0);
  assert.equal(compareReleaseVersions("latest", "1.0.0"), null);
});
