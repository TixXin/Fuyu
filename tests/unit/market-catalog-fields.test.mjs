import assert from "node:assert/strict";
import { test } from "node:test";
import { firstPublishedAt, marketSince, packageIcon, pluginIcon, pluginKeywords, pluginScreenshots, versionScreenshots } from "../../src/features/updater/host/marketListing.mjs";
import { createMarketWorld } from "./market-v3-fixtures.mjs";

const icon = (name) => ({ url: `https://example.com/${name}.svg`, sha256: "a".repeat(64) });
const version = (v, publishedAt, more = {}) => ({ version: v, publishedAt, ...more });

test("a plugin's first listing is its earliest published version, in whatever order the index lists them", () => {
  const plugin = { versions: [version("1.2.0", "2026-11-19T12:02:26Z"), version("1.0.0", "2026-11-02T08:00:00Z"), version("1.1.0", "2026-11-10T08:00:00Z")] };
  assert.equal(firstPublishedAt(plugin), "2026-11-02T08:00:00Z");
  assert.equal(firstPublishedAt({ versions: [version("1.0.0", "not a date")] }), null);
  assert.equal(firstPublishedAt({}), null);
});

test("the market opened when its earliest version across all plugins was published", () => {
  const doc = { plugins: [
    { versions: [version("1.0.0", "2026-11-18T07:18:16Z")] },
    { versions: [version("1.1.0", "2026-11-19T12:02:26Z"), version("1.0.0", "2026-11-18T07:00:00Z")] },
  ] };
  assert.equal(marketSince(doc), "2026-11-18T07:00:00Z");
  assert.equal(marketSince(null), null);
});

test("the market icon comes from the offered version and falls back to any version that has one", () => {
  const plugin = { versions: [version("2.0.0", "2026-11-19T00:00:00Z"), version("1.0.0", "2026-11-01T00:00:00Z", { icon: icon("old") })] };
  assert.equal(pluginIcon(plugin, version("3.0.0", "2026-11-20T00:00:00Z", { icon: icon("new") })), "https://example.com/new.svg");
  assert.equal(pluginIcon(plugin, plugin.versions[0]), "https://example.com/old.svg");
  assert.equal(pluginIcon({ versions: [version("1.0.0", "x", { icon: { url: "http://insecure.example/i.svg" } })] }, null), null);
});

test("an installed package's icon path stays inside the package", () => {
  assert.equal(packageIcon("assets/icon.svg"), "assets/icon.svg");
  assert.equal(packageIcon("./assets/icon.svg"), "assets/icon.svg");
  for (const bad of ["../data/secret.svg", "/etc/icon.svg", "C:/icon.svg", "assets\\icon.svg", "assets//icon.svg", "", 42, undefined]) {
    assert.equal(packageIcon(bad), undefined, String(bad));
  }
});

test("market screenshots come from the offered version, fall back to any version that has some, and stop at six", () => {
  const shot = (name, caption) => ({ url: `https://example.com/${name}.png`, sha256: "b".repeat(64), ...(caption ? { caption } : {}) });
  const plugin = { versions: [version("2.0.0", "2026-11-19T00:00:00Z"), version("1.0.0", "2026-11-01T00:00:00Z", { screenshots: [shot("old")] })] };
  assert.deepEqual(pluginScreenshots(plugin, version("3.0.0", "x", { screenshots: [shot("new", { "zh-CN": "预报", en: "Forecast", fr: 3 })] })), [{ url: "https://example.com/new.png", caption: { "zh-CN": "预报", en: "Forecast" } }]);
  assert.deepEqual(pluginScreenshots(plugin, plugin.versions[0]), [{ url: "https://example.com/old.png" }]);
  assert.deepEqual(versionScreenshots({ screenshots: [{ url: "http://insecure.example/a.png" }, "nope", shot("ok")] }), [{ url: "https://example.com/ok.png" }]);
  assert.equal(versionScreenshots({ screenshots: Array.from({ length: 9 }, (_, i) => shot(`s${i}`)) }).length, 6);
  assert.deepEqual(pluginScreenshots({}, null), []);
});

test("keywords are read trimmed, and anything that is not a word is dropped", () => {
  assert.deepEqual(pluginKeywords([" clock ", "world time", 7, "", "  ", null]), ["clock", "world time"]);
  assert.deepEqual(pluginKeywords("clock"), []);
  assert.deepEqual(pluginKeywords(undefined), []);
});

test("a catalog entry carries the keywords of the offered version, trimmed", async () => {
  const world = createMarketWorld("fuyu-catalog-keywords-");
  try {
    const tagged = world.version({ name: "@someone/clock", version: "1.0.0" });
    tagged.manifest.keywords = [" clock ", "world time"];
    const loose = world.version({ name: "@someone/alarm", version: "1.0.0" });
    loose.keywords = ["wake up"];
    world.putIndex(1, [
      { name: "@someone/clock", versions: [tagged] },
      { name: "@someone/alarm", versions: [loose] },
      { name: "@someone/plain", versions: [world.version({ name: "@someone/plain", version: "1.0.0" })] },
    ]);
    world.putRevoked(1, []);
    const { plugins } = await world.market.refresh();
    assert.deepEqual(Object.fromEntries(plugins.map((plugin) => [plugin.name, plugin.keywords])), {
      "@someone/clock": ["clock", "world time"],
      "@someone/alarm": ["wake up"],
      "@someone/plain": [],
    });
  } finally {
    world.cleanup();
  }
});
