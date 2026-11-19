import assert from "node:assert/strict";
import { test } from "node:test";
import { packageReach } from "../../src/features/updater/host/marketListing.mjs";
import { pluginIslandPage, readIslandPluginPageRequest } from "../../src/features/plugin-kernel/islandPageRequest.ts";
import { compareLooseVersions, newestMarketVersion, pluginPlaces, pluginSettingsKnown, versionStanding } from "../../src/windows/settings/pluginReach.ts";

const reach = (slots, services = [], config = false) => ({ slots, services, config });

test("the market service reads where an installed plugin shows up from its manifest", () => {
  assert.deepEqual(packageReach({ slots: ["island.page/v1", 3, ""], inject: { required: ["messages/v1"], optional: ["todos/v1"] }, config: "config.json" }), reach(["island.page/v1"], ["messages/v1", "todos/v1"], true));
  assert.deepEqual(packageReach({ inject: ["translator.engines"] }), reach([], ["translator.engines"], false));
  assert.deepEqual(packageReach({}), reach([], [], false));
  assert.deepEqual(packageReach(undefined), reach([], [], false));
});

test("a plugin has settings when it registers a settings section or has a config schema, and is unknown without a manifest", () => {
  assert.equal(pluginSettingsKnown(reach(["settings.section/v1"]), false), true);
  assert.equal(pluginSettingsKnown(reach([], [], true), false), true);
  assert.equal(pluginSettingsKnown(reach(["island.page/v1"]), false), false);
  assert.equal(pluginSettingsKnown(null, false), null);
  assert.equal(pluginSettingsKnown(null, true), true);
  assert.equal(pluginSettingsKnown(reach([]), true), true);
});

test("place tags follow the island page, collapsed bar, alerts, translation and settings, in that order", () => {
  assert.deepEqual(pluginPlaces(reach(["settings.section/v1", "island.collapsed/v1", "island.page/v1"], ["messages/v1"]), true), ["page", "bar", "alerts", "settings"]);
  assert.deepEqual(pluginPlaces(reach([], ["translator.engines"]), false), ["translate"]);
  assert.deepEqual(pluginPlaces(null, null), []);
  assert.deepEqual(pluginPlaces(null, true), ["settings"]);
});

test("versions compare by number, and a prerelease is older than its release", () => {
  assert.equal(compareLooseVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareLooseVersions("1.1.0-beta.1", "1.1.0"), -1);
  assert.equal(compareLooseVersions("v2.0.0", "2.0.0"), 0);
  assert.equal(compareLooseVersions("nightly", "1.0.0"), null);
  assert.equal(versionStanding("1.1.0", "1.0.0"), "newer");
  assert.equal(versionStanding("1.0.0", "1.1.0"), "older");
  assert.equal(versionStanding("1.0.0", "1.0.0"), "same");
  assert.equal(versionStanding("1.0.0", null), null);
});

test("the market's newest version is the higher of the install and manual candidates", () => {
  const candidate = (version) => ({ version });
  assert.equal(newestMarketVersion({ install: candidate("1.0.0"), manual: candidate("1.2.0") }), "1.2.0");
  assert.equal(newestMarketVersion({ install: candidate("1.3.0"), manual: null }), "1.3.0");
  assert.equal(newestMarketVersion({ install: null, manual: null }), null);
  assert.equal(newestMarketVersion(undefined), null);
});

test("the island opens the plugin's first own page, or the one asked for only if that plugin owns it", () => {
  const pages = [
    { id: "todo", owner: "builtin", external: false },
    { id: "weather-main", owner: "@fuyu/weather", external: true },
    { id: "weather-radar", owner: "@fuyu/weather", external: true },
    { id: "clock", owner: "@someone/clock", external: true },
  ];
  assert.equal(pluginIslandPage({ pluginId: "@fuyu/weather" }, pages), "weather-main");
  assert.equal(pluginIslandPage({ pluginId: "@fuyu/weather", page: "weather-radar" }, pages), "weather-radar");
  assert.equal(pluginIslandPage({ pluginId: "@fuyu/weather", page: "clock" }, pages), null);
  assert.equal(pluginIslandPage({ pluginId: "builtin" }, pages), null);
  assert.equal(pluginIslandPage({ pluginId: "@me/none" }, pages), null);
});

test("only well-formed open requests reach the island", () => {
  assert.deepEqual(readIslandPluginPageRequest({ pluginId: "@fuyu/weather" }), { pluginId: "@fuyu/weather" });
  assert.deepEqual(readIslandPluginPageRequest({ pluginId: "@fuyu/weather", page: "radar" }), { pluginId: "@fuyu/weather", page: "radar" });
  assert.deepEqual(readIslandPluginPageRequest({ pluginId: "@fuyu/weather", page: 3 }), { pluginId: "@fuyu/weather" });
  assert.equal(readIslandPluginPageRequest({ pluginId: "" }), null);
  assert.equal(readIslandPluginPageRequest("@fuyu/weather"), null);
  assert.equal(readIslandPluginPageRequest(null), null);
});
