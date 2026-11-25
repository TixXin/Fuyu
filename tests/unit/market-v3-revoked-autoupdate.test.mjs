import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pluginRowStatus } from "../../src/windows/settings/pluginRowStatus.ts";
import { createMarketWorld } from "./market-v3-fixtures.mjs";

const versionOnDisk = (world, name) => JSON.parse(readFileSync(join(world.root, "packages", ...name.split("/"), "package.json"), "utf8")).version;
const ymlText = (world) => readFileSync(join(world.root, "plugins.yml"), "utf8");

test("a plugin disabled by revocation auto-updates to a safe fix and turns back on", async () => {
  const world = createMarketWorld("fuyu-market-revoked-fix-");
  try {
    const v100 = world.version({ name: "@someone/clock", version: "1.0.0", daysAgo: 20 });
    world.putIndex(1, [{ name: "@someone/clock", versions: [v100] }]);
    await world.market.refresh();
    await world.market.installMarket({ name: "@someone/clock", version: "1.0.0" });
    assert.equal(versionOnDisk(world, "@someone/clock"), "1.0.0");

    world.putRevoked(1, [{ id: "rev-1", name: "@someone/clock", version: "1.0.0", level: "disable", reason: { "zh-CN": "有严重问题", en: "Critical bug" } }]);
    await world.market.refresh();
    assert.match(ymlText(world), /disabled: true/);
    assert.equal((await world.market.catalog()).installed[0].enabled, false);

    const v101 = world.version({ name: "@someone/clock", version: "1.0.1", daysAgo: 5 });
    world.putIndex(2, [{ name: "@someone/clock", versions: [v100, v101] }]);
    const after = await world.market.refresh();
    assert.equal(versionOnDisk(world, "@someone/clock"), "1.0.1");
    assert.doesNotMatch(ymlText(world), /disabled: true/);
    assert.equal(after.installed[0].version, "1.0.1");
    assert.equal(after.installed[0].enabled, true);
  } finally {
    world.cleanup();
  }
});

test("a plugin disabled by the user does not auto-update even if its version is later revoked", async () => {
  const world = createMarketWorld("fuyu-market-user-disabled-");
  try {
    const v100 = world.version({ name: "@someone/clock", version: "1.0.0", daysAgo: 20 });
    world.putIndex(1, [{ name: "@someone/clock", versions: [v100] }]);
    await world.market.refresh();
    await world.market.installMarket({ name: "@someone/clock", version: "1.0.0" });
    await world.market.setEnabled({ id: "@someone/clock", enabled: false });

    world.putRevoked(1, [{ id: "rev-1", name: "@someone/clock", version: "1.0.0", level: "disable", reason: { "zh-CN": "有严重问题", en: "Critical bug" } }]);
    await world.market.refresh();

    const v101 = world.version({ name: "@someone/clock", version: "1.0.1", daysAgo: 5 });
    world.putIndex(2, [{ name: "@someone/clock", versions: [v100, v101] }]);
    const after = await world.market.refresh();
    assert.equal(versionOnDisk(world, "@someone/clock"), "1.0.0");
    assert.equal(after.installed[0].enabled, false);
  } finally {
    world.cleanup();
  }
});

test("a fix for a revoked plugin that asks for more capabilities is held and surfaces a review prompt on the plugin row", async () => {
  const world = createMarketWorld("fuyu-market-revoked-held-");
  try {
    const v100 = world.version({ name: "@someone/clock", version: "1.0.0", daysAgo: 20, nodeApis: ["node:os"] });
    world.putIndex(1, [{ name: "@someone/clock", versions: [v100] }]);
    await world.market.refresh();
    await world.market.installMarket({ name: "@someone/clock", version: "1.0.0" });

    world.putRevoked(1, [{ id: "rev-1", name: "@someone/clock", version: "1.0.0", level: "disable", reason: { "zh-CN": "有严重问题", en: "Critical bug" } }]);
    await world.market.refresh();

    const v110 = world.version({ name: "@someone/clock", version: "1.1.0", daysAgo: 5, nodeApis: ["node:os", "node:child_process"] });
    world.putIndex(2, [{ name: "@someone/clock", versions: [v100, v110] }]);
    const snap = await world.market.refresh();
    assert.equal(versionOnDisk(world, "@someone/clock"), "1.0.0");
    assert.equal(snap.installed[0].enabled, false);
    assert.equal(snap.plugins[0].autoUpdateHeld?.version, "1.1.0");

    const row = pluginRowStatus(
      { id: "@someone/clock", state: "disabled", kind: "third-party", source: "market" },
      snap.plugins[0],
      { live: true, runtime: "ready" },
      snap.plugins[0].revocation,
    );
    assert.equal(row.note?.kind, "revoked");
    assert.equal(row.note?.fixVersion, "1.1.0");
  } finally {
    world.cleanup();
  }
});
