import assert from "node:assert/strict";
import test from "node:test";
import { filterInstalledPlugins, installedCounts, pluginHealth } from "../../src/features/plugins/installedFilter.ts";

const plugin = (extra) => ({
  id: "dev.example.a",
  builtin: false,
  dev: false,
  name: { "zh-CN": "示例", en: "Example" },
  description: null,
  author: "Ann",
  enabled: true,
  needsApproval: false,
  hasProcess: true,
  status: "running",
  error: null,
  invalidReason: null,
  revoked: null,
  updateAvailable: null,
  autoUpdated: null,
  keybindingConflicts: [],
  ...extra,
});

const running = plugin({ id: "a" });
const update = plugin({ id: "b", enabled: false, status: "stopped", updateAvailable: "2.0.0" });
const autoUpdated = plugin({ id: "c", updateAvailable: "1.1.0", autoUpdated: "1.1.0" });
const broken = plugin({ id: "d", invalidReason: "bad manifest", enabled: false, name: null });
const crashed = plugin({ id: "e", status: "crashed", name: { "zh-CN": "天气", en: "Weather" } });
const all = [running, update, autoUpdated, broken, crashed];

test("counts each filter", () => {
  assert.deepEqual(installedCounts(all, true), { all: 5, running: 2, updates: 1, attention: 2 });
});

test("third-party plugins that are on but not allowed need attention and do not run", () => {
  assert.deepEqual(installedCounts([running], false), { all: 1, running: 0, updates: 0, attention: 1 });
  assert.equal(installedCounts([plugin({ builtin: true })], false).running, 1);
});

test("filters by kind and by words in any language", () => {
  assert.deepEqual(filterInstalledPlugins(all, "attention", "", true).map((item) => item.id), ["d", "e"]);
  assert.deepEqual(filterInstalledPlugins(all, "all", "weather", true).map((item) => item.id), ["e"]);
  assert.deepEqual(filterInstalledPlugins(all, "all", "天气", true).map((item) => item.id), ["e"]);
  assert.deepEqual(filterInstalledPlugins(all, "updates", "ann", true).map((item) => item.id), ["b"]);
});

test("health follows status, switch and permission", () => {
  assert.equal(pluginHealth(running, true), "running");
  assert.equal(pluginHealth(update, true), "off");
  assert.equal(pluginHealth(broken, true), "error");
  assert.equal(pluginHealth(crashed, true), "error");
  assert.equal(pluginHealth(running, false), "error");
  assert.equal(pluginHealth(plugin({ status: "restarting" }), true), "busy");
  assert.equal(pluginHealth(plugin({ hasProcess: false }), true), "idle");
});
