import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createMarketWorld } from "./market-v3-fixtures.mjs";

const installedVersion = (root, scope, name) => JSON.parse(readFileSync(join(root, "packages", scope, name, "package.json"), "utf8")).version;
const stagingEntries = (root) => (existsSync(join(root, "packages", ".staging")) ? readdirSync(join(root, "packages", ".staging")) : []);

test("installMarket refuses a package whose own name or version differs from the index entry", async () => {
  const world = createMarketWorld("fuyu-market-guard-");
  try {
    const renamed = world.version({ name: "@someone/clock", version: "1.0.0", packageName: "@someone/other" });
    const bumped = world.version({ name: "@someone/timer", version: "1.0.0", packageVersion: "9.9.9" });
    world.putIndex(1, [{ name: "@someone/clock", versions: [renamed] }, { name: "@someone/timer", versions: [bumped] }]);
    await world.market.refresh();

    await assert.rejects(() => world.market.installMarket({ name: "@someone/clock" }), { code: "name-mismatch" });
    await assert.rejects(() => world.market.installMarket({ name: "@someone/timer" }), { code: "version-mismatch" });
    assert.equal(existsSync(join(world.root, "packages", "@someone")), false);
    assert.deepEqual(stagingEntries(world.root), []);
  } finally {
    world.cleanup();
  }
});

test("a plugin and the dependency it pulls in are swapped in together, or not at all", async () => {
  const world = createMarketWorld("fuyu-market-atomic-");
  try {
    const base100 = world.version({ name: "@someone/base", version: "1.0.0" });
    const app100 = world.version({ name: "@other/app", version: "1.0.0" });
    world.putIndex(1, [{ name: "@someone/base", versions: [base100] }, { name: "@other/app", versions: [app100] }]);
    await world.market.refresh({ autoUpdate: false });
    await world.market.installMarket({ name: "@someone/base", version: "1.0.0" });
    const ymlBefore = readFileSync(join(world.root, "plugins.yml"), "utf8");

    const base200 = world.version({ name: "@someone/base", version: "2.0.0" });
    const app200 = { ...world.version({ name: "@other/app", version: "2.0.0" }) };
    app200.manifest = { ...app200.manifest, requires: { "@someone/base": "^2.0.0" } };
    world.putIndex(2, [{ name: "@someone/base", versions: [base100, base200] }, { name: "@other/app", versions: [app100, app200] }]);
    await world.market.refresh({ autoUpdate: false });

    writeFileSync(join(world.root, "packages", "@other"), "not a folder");
    await assert.rejects(() => world.market.installMarket({ name: "@other/app", version: "2.0.0" }), (error) => ["EEXIST", "ENOTDIR", "ENOENT"].includes(error.code));
    assert.equal(installedVersion(world.root, "@someone", "base"), "1.0.0");
    assert.equal(readFileSync(join(world.root, "plugins.yml"), "utf8"), ymlBefore);
    assert.deepEqual(stagingEntries(world.root), []);
  } finally {
    world.cleanup();
  }
});
