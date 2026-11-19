import assert from "node:assert/strict";
import test from "node:test";
import { browseList, capabilityItems, categoryCounts, hasUpdate, isFirstFromPublisher, matchesQuery, sortPlugins } from "../../src/windows/settings/pluginMarketModel.ts";

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
