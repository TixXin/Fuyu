import assert from "node:assert/strict";
import test from "node:test";
import { browseList, capabilityItems, categoryCounts, hasUpdate, isFirstFromPublisher, matchesQuery, newListings, sortPlugins } from "../../src/windows/settings/pluginMarketModel.ts";

const caps = (more = {}) => ({ unreviewed: false, network: [], nodeApis: [], provides: [], replaces: [], slots: [], ...more });
const candidate = (version, more = {}) => ({ version, sha256: "a", size: 1, publishedAt: "2026-11-10T00:00:00Z", confirmation: caps(), ...more });
const plugin = (name, more = {}) => {
  const official = name.startsWith("@fuyu/");
  return {
    name, official, publisher: { github: official ? "TixXin" : name.split("/")[0].replace("@", ""), official },
    displayName: { "zh-CN": name, en: name }, description: { "zh-CN": "", en: "" }, categories: ["utilities"],
    installedVersion: null, enabled: false, source: null, revoked: false, install: candidate("1.0.0"), manual: null, autoUpdate: null, ...more,
  };
};

test("what a plugin does is listed from its manifest, with running programs, touching files and replacing services marked, with or without the node: prefix", () => {
  const items = capabilityItems(caps({ network: ["api.example.com"], nodeApis: ["node:child_process", "fs/promises", "node:crypto"], replaces: ["todos/v1"], slots: ["island.page/v1"] }));
  assert.deepEqual(items.map((item) => item.kind), ["replaces", "network", "runPrograms", "files", "nodeApis"]);
  const byKind = Object.fromEntries(items.map((item) => [item.kind, item]));
  assert.deepEqual(byKind.runPrograms, { kind: "runPrograms", detail: ["child_process"], sensitive: true });
  assert.deepEqual(byKind.files, { kind: "files", detail: ["fs/promises"], sensitive: true });
  assert.deepEqual(byKind.nodeApis, { kind: "nodeApis", detail: ["crypto"], sensitive: false });
  assert.deepEqual(byKind.network, { kind: "network", detail: ["api.example.com"], sensitive: false });
  assert.equal(byKind.replaces.sensitive, true);
});

test("a plugin that declares nothing lists nothing", () => {
  assert.deepEqual(capabilityItems(caps({ slots: ["island.page/v1"], provides: ["x/v1"], requiredPlugins: ["@fuyu/devices"] })), []);
});

test("the first-publisher notice only shows for a third-party publisher the user has nothing installed from", () => {
  const fresh = plugin("@ryo/clip-sync");
  assert.equal(isFirstFromPublisher(fresh, [fresh, plugin("@ryo/other")]), true);
  assert.equal(isFirstFromPublisher(fresh, [fresh, plugin("@ryo/other", { installedVersion: "1.0.0" })]), false);
  assert.equal(isFirstFromPublisher(plugin("@fuyu/rss"), []), false);
  assert.equal(isFirstFromPublisher(plugin("@ryo/clip-sync", { installedVersion: "1.0.0" }), []), false);
});

test("an update is only offered when the market has a different version the plugin can still run", () => {
  assert.equal(hasUpdate(plugin("@a/x", { installedVersion: "1.0.0", autoUpdate: candidate("1.1.0") })), true);
  assert.equal(hasUpdate(plugin("@a/x", { installedVersion: "1.1.0", autoUpdate: candidate("1.1.0") })), false);
  assert.equal(hasUpdate(plugin("@a/x", { installedVersion: "1.0.0", autoUpdate: candidate("1.1.0"), blocked: { reason: "engines" } })), false);
  assert.equal(hasUpdate(plugin("@a/x")), false);
});

test("browsing all lists every plugin once in one flat list, leaving updates to their own section", () => {
  const plugins = [
    plugin("@a/one", { categories: ["productivity", "utilities"] }),
    plugin("@a/two", { categories: ["productivity"] }),
    plugin("@a/updating", { categories: ["productivity"], installedVersion: "1.0.0", autoUpdate: candidate("2.0.0") }),
    plugin("@a/plain", { categories: [] }),
  ];
  assert.deepEqual(browseList(plugins, "recommended").map((item) => item.name), ["@a/one", "@a/two", "@a/plain"]);
  assert.deepEqual(categoryCounts(plugins), [{ id: "productivity", count: 3 }, { id: "utilities", count: 1 }]);
});

test("recommended order puts installable official plugins first and ones that cannot be installed last; recent sorts by release date", () => {
  const blocked = plugin("@a/old", { install: null, blocked: { reason: "engines" } });
  const third = plugin("@a/third", { install: candidate("1.0.0", { publishedAt: "2026-11-18T00:00:00Z" }) });
  const official = plugin("@fuyu/official", { install: candidate("1.0.0", { publishedAt: "2026-10-01T00:00:00Z" }) });
  assert.deepEqual(sortPlugins([blocked, third, official], "recommended").map((item) => item.name), ["@fuyu/official", "@a/third", "@a/old"]);
  assert.deepEqual(sortPlugins([official, blocked, third], "recent").map((item) => item.name), ["@a/third", "@fuyu/official", "@a/old"]);
});

test("search matches names, publishers and the shown category name, ignoring spaces and dashes", () => {
  const rss = plugin("@fuyu/rss", { displayName: { "zh-CN": "RSS 订阅", en: "RSS reader" }, categories: ["information"] });
  assert.equal(matchesQuery(rss, "rssreader"), true);
  assert.equal(matchesQuery(rss, "资讯", { information: "资讯" }), true);
  assert.equal(matchesQuery(rss, "tixxin"), true);
  assert.equal(matchesQuery(rss, "天气"), false);
});

test("newest sorts by when a plugin was first listed, not by its latest release", () => {
  const veteran = plugin("@a/veteran", { firstPublishedAt: "2026-09-01T00:00:00Z", install: candidate("3.0.0", { publishedAt: "2026-11-18T00:00:00Z" }) });
  const rookie = plugin("@a/rookie", { firstPublishedAt: "2026-11-12T00:00:00Z", install: candidate("1.0.0", { publishedAt: "2026-11-12T00:00:00Z" }) });
  const middle = plugin("@a/middle", { firstPublishedAt: "2026-10-01T00:00:00Z" });
  assert.deepEqual(sortPlugins([veteran, middle, rookie], "newest").map((item) => item.name), ["@a/rookie", "@a/middle", "@a/veteran"]);
  assert.deepEqual(sortPlugins([veteran, middle, rookie], "recent").map((item) => item.name), ["@a/veteran", "@a/rookie", "@a/middle"]);
});

const day = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-12-30T12:00:00Z");
const listedDaysAgo = (name, days) => plugin(name, { firstPublishedAt: new Date(now - days * day).toISOString() });

test("nothing is new until the market has been open a month, so a young market does not flag every plugin", () => {
  const plugins = [listedDaysAgo("@a/one", 1), listedDaysAgo("@a/two", 5)];
  assert.deepEqual([...newListings(plugins, new Date(now - 29 * day).toISOString(), now)], []);
  assert.deepEqual([...newListings(plugins, null, now)], []);
  assert.deepEqual([...newListings(plugins, new Date(now - 31 * day).toISOString(), now)].sort(), ["@a/one", "@a/two"]);
});

test("after the first month only plugins first listed in the last 14 days are new, whatever their latest release", () => {
  const since = new Date(now - 90 * day).toISOString();
  const plugins = [
    listedDaysAgo("@a/fresh", 13),
    listedDaysAgo("@a/stale", 15),
    plugin("@a/updated", { firstPublishedAt: new Date(now - 60 * day).toISOString(), install: candidate("2.0.0", { publishedAt: new Date(now - day).toISOString() }) }),
    plugin("@a/unknown", { firstPublishedAt: null }),
    listedDaysAgo("@a/future", -2),
  ];
  assert.deepEqual([...newListings(plugins, since, now)], ["@a/fresh"]);
});
