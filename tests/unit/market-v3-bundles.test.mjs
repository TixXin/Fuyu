import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createMarketService } from "../../src/features/updater/host/market.mjs";
import { createMarketWorld } from "./market-v3-fixtures.mjs";

const text = (zh, en) => ({ "zh-CN": zh, en });
const bundle = (id, plugins, extra = {}) => ({ id, displayName: text("套装", "Bundle"), description: text("一起装", "Installed together"), plugins, ...extra });
const installedVersion = (root, name) => {
  const file = join(root, "packages", ...name.split("/"), "package.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).version : null;
};

function world(prefix) {
  const base = createMarketWorld(prefix);
  const reloads = [];
  const market = createMarketService({ ...base.options, onConfigChanged: () => reloads.push(1) });
  const entries = (names, edit = {}) => names.map((name) => {
    const entry = base.version({ name, version: "1.0.0" });
    return { name, versions: [edit[name] ? edit[name](entry) : entry] };
  });
  return { ...base, market, reloads, entries };
}

test("the catalog lists a bundle with the state of each member, and hides one with fewer than two usable members", async () => {
  const w = world("fuyu-market-bundles-view-");
  try {
    const names = ["@someone/focus", "@someone/ring", "@someone/digest", "@someone/winonly"];
    const plugins = w.entries(names, { "@someone/winonly": (entry) => ({ ...entry, platforms: ["windows"] }) });
    w.putIndex(1, plugins, {
      bundles: [
        bundle("flow", ["@someone/focus", "@someone/ring", "@someone/winonly"], { onboarding: true }),
        bundle("thin", ["@someone/digest", "@someone/winonly"]),
      ],
    });
    await w.market.refresh({ autoUpdate: false });
    await w.market.installMarket({ name: "@someone/ring" });
    await w.market.setEnabled({ id: "@someone/ring", enabled: false });

    const { bundles } = await w.market.catalog();
    assert.deepEqual(bundles.map((item) => item.id), ["flow"]);
    assert.equal(bundles[0].onboarding, true);
    assert.deepEqual(bundles[0].members, [
      { name: "@someone/focus", state: "available" },
      { name: "@someone/ring", state: "disabled" },
      { name: "@someone/winonly", state: "unavailable", reason: "platform" },
    ]);
  } finally {
    w.cleanup();
  }
});

test("an index without bundles gives an empty list", async () => {
  const w = world("fuyu-market-bundles-none-");
  try {
    w.putIndex(1, w.entries(["@someone/focus"]));
    await w.market.refresh({ autoUpdate: false });
    assert.deepEqual((await w.market.catalog()).bundles, []);
  } finally {
    w.cleanup();
  }
});

test("installing a bundle installs what is missing, leaves what is there alone, and reloads the plugins once", async () => {
  const w = world("fuyu-market-bundles-install-");
  try {
    w.putIndex(1, w.entries(["@someone/focus", "@someone/ring", "@someone/digest"]), { bundles: [bundle("flow", ["@someone/focus", "@someone/ring", "@someone/digest"])] });
    await w.market.refresh({ autoUpdate: false });
    await w.market.installMarket({ name: "@someone/ring" });
    w.reloads.length = 0;

    const result = await w.market.installBundle({ id: "flow" });
    assert.deepEqual(result, { id: "flow", installed: [{ name: "@someone/focus", version: "1.0.0" }, { name: "@someone/digest", version: "1.0.0" }], failed: [] });
    assert.equal(w.reloads.length, 1);
    assert.deepEqual((await w.market.catalog()).bundles[0].members.map((member) => member.state), ["installed", "installed", "installed"]);

    w.reloads.length = 0;
    assert.deepEqual(await w.market.installBundle({ id: "flow" }), { id: "flow", installed: [], failed: [] });
    assert.equal(w.reloads.length, 0);
  } finally {
    w.cleanup();
  }
});

test("a member that fails to download is reported and does not stop the others", async () => {
  const w = world("fuyu-market-bundles-partial-");
  try {
    const plugins = w.entries(["@someone/focus", "@someone/ring", "@someone/digest"]);
    w.putIndex(1, plugins, { bundles: [bundle("flow", ["@someone/focus", "@someone/ring", "@someone/digest"])] });
    await w.market.refresh({ autoUpdate: false });
    const ringUrl = plugins[1].versions[0].url;
    const serveRing = w.routes.get(ringUrl);
    w.routes.delete(ringUrl);

    const result = await w.market.installBundle({ id: "flow" });
    assert.deepEqual(result.installed.map((item) => item.name), ["@someone/focus", "@someone/digest"]);
    assert.deepEqual(result.failed.map((item) => item.name), ["@someone/ring"]);
    assert.equal(typeof result.failed[0].code, "string");
    assert.equal(installedVersion(w.root, "@someone/ring"), null);
    assert.equal(installedVersion(w.root, "@someone/focus"), "1.0.0");
    assert.deepEqual((await w.market.catalog()).bundles[0].members.map((member) => member.state), ["installed", "available", "installed"]);

    w.routes.set(ringUrl, serveRing);
    const retry = await w.market.installBundle({ id: "flow" });
    assert.deepEqual(retry, { id: "flow", installed: [{ name: "@someone/ring", version: "1.0.0" }], failed: [] });
  } finally {
    w.cleanup();
  }
});

test("installBundle refuses an unknown bundle and bad parameters", async () => {
  const w = world("fuyu-market-bundles-bad-");
  try {
    w.putIndex(1, w.entries(["@someone/focus", "@someone/ring"]), { bundles: [bundle("flow", ["@someone/focus", "@someone/ring"])] });
    await w.market.refresh({ autoUpdate: false });
    await assert.rejects(() => w.market.installBundle({ id: "other" }), { code: "not-found" });
    await assert.rejects(() => w.market.installBundle({}), { code: "bad-params" });
    assert.equal(installedVersion(w.root, "@someone/focus"), null);
  } finally {
    w.cleanup();
  }
});
