import assert from "node:assert/strict";
import { test } from "node:test";
import { readState } from "../../src/features/updater/host/marketStore.mjs";
import { DAY, createMarketWorld, revocation, textRes } from "./market-v3-fixtures.mjs";

async function installedWorld(prefix) {
  const world = createMarketWorld(prefix);
  const v100 = world.version({ name: "@someone/clock", version: "1.0.0" });
  world.putIndex(1, [{ name: "@someone/clock", versions: [v100] }]);
  world.putRevoked(1, [revocation("rev-old", "@someone/gone", "*", "disable")]);
  await world.market.refresh();
  await world.market.installMarket({ name: "@someone/clock", version: "1.0.0" });
  return { world, v100 };
}

async function refreshWithNewPlugin(world, v100, serial, extra = {}) {
  const timer = world.version({ name: "@someone/timer", version: "1.0.0" });
  world.putIndex(serial, [{ name: "@someone/clock", versions: [v100] }, { name: "@someone/timer", versions: [timer] }], extra);
  return world.market.refresh();
}

test("an unreachable revocation list only warns: the index still updates and saved revocations stay", async () => {
  const { world, v100 } = await installedWorld("fuyu-revoked-net-");
  try {
    world.failRevoked(503);
    const snap = await refreshWithNewPlugin(world, v100, 2);
    assert.equal(snap.revocationWarning, "network");
    assert.ok(snap.plugins.some((plugin) => plugin.name === "@someone/timer"));
    assert.equal(readState(world.dataDir).lastIndexSerial, 2);
    assert.equal(readState(world.dataDir).revocations.entries[0]?.id, "rev-old");

    world.routes.set("https://market.example/revoked.v3.json", () => {
      throw new Error("offline");
    });
    assert.equal((await refreshWithNewPlugin(world, v100, 3)).revocationWarning, "network");
  } finally {
    world.cleanup();
  }
});

test("a rejected revocation list only warns, whether the signature is wrong or the serial went back", async () => {
  const { world, v100 } = await installedWorld("fuyu-revoked-bad-");
  try {
    world.putRevoked(2, [revocation("rev-clock", "@someone/clock", "1.0.0", "disable")], { signer: world.otherKey() });
    const badSig = await refreshWithNewPlugin(world, v100, 2);
    assert.equal(badSig.revocationWarning, "bad-signature");
    assert.equal(badSig.installed.find((item) => item.id === "@someone/clock")?.enabled, true);
    assert.equal(readState(world.dataDir).lastIndexSerial, 2);

    world.routes.set("https://market.example/revoked.v3.json.sig", () => textRes("not json"));
    assert.equal((await refreshWithNewPlugin(world, v100, 3)).revocationWarning, "bad-signature");

    world.putRevoked(0, []);
    assert.equal((await refreshWithNewPlugin(world, v100, 4)).revocationWarning, "older-serial");
  } finally {
    world.cleanup();
  }
});

test("an expired revocation list is still merged and applied, with a warning", async () => {
  const { world, v100 } = await installedWorld("fuyu-revoked-expired-");
  try {
    world.putRevoked(2, [revocation("rev-clock", "@someone/clock", "1.0.0", "disable")], {
      generatedAt: world.clock.now - 100 * DAY,
      expires: world.clock.now - DAY,
    });
    const snap = await refreshWithNewPlugin(world, v100, 2);
    assert.equal(snap.revocationWarning, "expired");
    assert.equal(snap.installed.find((item) => item.id === "@someone/clock")?.enabled, false);
    assert.deepEqual(readState(world.dataDir).revocations.entries.map((entry) => entry.id), ["rev-old", "rev-clock"]);
  } finally {
    world.cleanup();
  }
});

test("a warning clears on the next good refresh, and an index ahead of the saved list says so", async () => {
  const { world, v100 } = await installedWorld("fuyu-revoked-behind-");
  try {
    world.failRevoked(500);
    assert.equal((await refreshWithNewPlugin(world, v100, 2)).revocationWarning, "network");
    world.putRevoked(2, []);
    assert.equal((await refreshWithNewPlugin(world, v100, 3)).revocationWarning, null);
    assert.equal((await refreshWithNewPlugin(world, v100, 4, { revokedSerial: 5 })).revocationWarning, "behind");
    assert.equal((await world.market.catalog()).revocationWarning, "behind");
  } finally {
    world.cleanup();
  }
});

test("a plugin revoked with disable cannot be turned back on, and both levels come with their reasons", async () => {
  const world = createMarketWorld("fuyu-revoked-levels-");
  try {
    const clock = world.version({ name: "@someone/clock", version: "1.0.0" });
    const timer = world.version({ name: "@someone/timer", version: "1.0.0" });
    world.putIndex(1, [{ name: "@someone/clock", versions: [clock] }, { name: "@someone/timer", versions: [timer] }]);
    await world.market.refresh();
    await world.market.installMarket({ name: "@someone/clock", version: "1.0.0" });
    await world.market.installMarket({ name: "@someone/timer", version: "1.0.0" });

    world.putRevoked(1, [
      revocation("rev-clock", "@someone/clock", "1.0.0", "disable", "恶意代码"),
      revocation("rev-timer", "@someone/timer", "*", "warn", "耗电"),
    ]);
    world.putIndex(2, [{ name: "@someone/clock", versions: [clock] }, { name: "@someone/timer", versions: [timer] }]);
    const snap = await world.market.refresh();
    const installed = Object.fromEntries(snap.installed.map((item) => [item.id, item]));
    assert.deepEqual(installed["@someone/clock"].revocation, { level: "disable", reasons: [{ "zh-CN": "恶意代码", en: "恶意代码 (en)" }] });
    assert.deepEqual(installed["@someone/timer"].revocation, { level: "warn", reasons: [{ "zh-CN": "耗电", en: "耗电 (en)" }] });
    assert.equal(installed["@someone/clock"].enabled, false);
    assert.equal(installed["@someone/timer"].enabled, true);
    const plugins = Object.fromEntries(snap.plugins.map((item) => [item.name, item]));
    assert.equal(plugins["@someone/clock"].revocation.level, "disable");
    assert.equal(plugins["@someone/clock"].revoked, true);
    assert.equal(plugins["@someone/timer"].revocation.level, "warn");
    assert.equal(plugins["@someone/timer"].revoked, false);

    await assert.rejects(() => world.market.setEnabled({ id: "@someone/clock", enabled: true }), (error) => error.code === "revoked" && error.data.reasons.length === 1);
    assert.equal((await world.market.catalog()).installed.find((item) => item.id === "@someone/clock").enabled, false);
    assert.deepEqual(await world.market.setEnabled({ id: "@someone/clock", enabled: false }), { id: "@someone/clock", enabled: false });
    assert.deepEqual(await world.market.setEnabled({ id: "@someone/timer", enabled: false }), { id: "@someone/timer", enabled: false });
    assert.deepEqual(await world.market.setEnabled({ id: "@someone/timer", enabled: true }), { id: "@someone/timer", enabled: true });
  } finally {
    world.cleanup();
  }
});
