import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createMarketWorld } from "./market-v3-fixtures.mjs";

const versionOnDisk = (world, name) => JSON.parse(readFileSync(join(world.root, "packages", ...name.split("/"), "package.json"), "utf8")).version;

test("an update that would do more (new Node modules, sites or replaced services) waits for the user instead of installing silently", async () => {
  const world = createMarketWorld("fuyu-market-caps-");
  try {
    const v100 = world.version({ name: "@someone/clock", version: "1.0.0", daysAgo: 20, nodeApis: ["node:os"], network: ["api.example.com"] });
    world.putIndex(1, [{ name: "@someone/clock", versions: [v100] }]);
    await world.market.refresh();
    await world.market.installMarket({ name: "@someone/clock", version: "1.0.0" });

    const v110 = world.version({ name: "@someone/clock", version: "1.1.0", daysAgo: 10, nodeApis: ["node:os"], network: [] });
    world.putIndex(2, [{ name: "@someone/clock", versions: [v100, v110] }]);
    const fewer = await world.market.refresh();
    assert.equal(versionOnDisk(world, "@someone/clock"), "1.1.0");
    assert.equal(fewer.plugins[0].autoUpdateHeld, null);

    const v200 = world.version({ name: "@someone/clock", version: "2.0.0", daysAgo: 5, nodeApis: ["node:os", "node:child_process"], network: ["api.example.com"], replaces: ["lyrics/v1"] });
    world.putIndex(3, [{ name: "@someone/clock", versions: [v100, v110, v200] }]);
    const held = await world.market.refresh();
    const plugin = held.plugins[0];
    assert.equal(versionOnDisk(world, "@someone/clock"), "1.1.0");
    assert.equal(plugin.installedVersion, "1.1.0");
    assert.equal(plugin.autoUpdate, null);
    assert.deepEqual(plugin.autoUpdateHeld, {
      version: "2.0.0",
      reason: "new-capabilities",
      newCapabilities: { nodeApis: ["node:child_process"], network: ["api.example.com"], replaces: ["lyrics/v1"] },
    });
    assert.deepEqual(plugin.manual.newCapabilities, plugin.autoUpdateHeld.newCapabilities);
    assert.deepEqual((await world.market.autoUpdate()).plugins[0].installedVersion, "1.1.0");

    const manual = await world.market.installMarket({ name: "@someone/clock", version: "2.0.0" });
    assert.equal(manual.version, "2.0.0");
    const after = await world.market.catalog();
    assert.equal(after.plugins[0].autoUpdateHeld, null);
  } finally {
    world.cleanup();
  }
});

test("the package's own manifest is compared too, not only what the index says", async () => {
  const world = createMarketWorld("fuyu-market-caps-pkg-");
  try {
    const v100 = world.version({ name: "@someone/clock", version: "1.0.0", daysAgo: 20 });
    world.putIndex(1, [{ name: "@someone/clock", versions: [v100] }]);
    await world.market.refresh();
    await world.market.installMarket({ name: "@someone/clock", version: "1.0.0" });

    const sneaky = world.version({ name: "@someone/clock", version: "1.1.0", daysAgo: 10, nodeApis: ["node:child_process"] });
    sneaky.manifest = { ...sneaky.manifest, nodeApis: [] };
    world.putIndex(2, [{ name: "@someone/clock", versions: [v100, sneaky] }]);
    const snap = await world.market.refresh();
    assert.equal(versionOnDisk(world, "@someone/clock"), "1.0.0");
    assert.equal(snap.plugins[0].installedVersion, "1.0.0");
  } finally {
    world.cleanup();
  }
});
