import assert from "node:assert/strict";
import test from "node:test";
import { firstLine, marketActionCandidate, pluginRowStatus } from "../../src/windows/settings/pluginRowStatus.ts";

const live = { live: true, runtime: "ready", builtins: [{ id: "todos", enabled: false }, { id: "music", enabled: true }] };
const plugin = (more = {}) => ({ id: "lin-dev/pomo-stats", name: "Pomo", state: "running", kind: "third-party", source: "market", ...more });
const candidate = (version, more = {}) => ({ version, sha256: "a", size: 1, publishedAt: "2026-11-18", confirmation: { unreviewed: false, network: [], nodeApis: [], provides: [], replaces: [], slots: [] }, ...more });
const market = (more = {}) => ({
  name: "lin-dev/pomo-stats", official: false, publisher: { github: "lin-dev", official: false },
  displayName: { "zh-CN": "专注统计", en: "Focus stats" }, description: { "zh-CN": "", en: "" }, categories: [],
  installedVersion: "0.4.2", enabled: true, source: "market", revoked: false, install: null, manual: null, autoUpdate: null, ...more,
});

test("a running plugin with nothing new is green and asks nothing", () => {
  assert.deepEqual(pluginRowStatus(plugin(), market(), live), { dot: "ok", label: null, note: null, attention: false });
});

test("a plugin that failed to start shows the first line of its last error and needs the user", () => {
  const status = pluginRowStatus(plugin({ state: "failed", lastError: { at: 1, text: "\nTypeError: x is undefined\n    at summarize (stats.mjs:42:18)" } }), market(), live);
  assert.equal(status.dot, "bad");
  assert.equal(status.label, "failed");
  assert.deepEqual(status.note, { kind: "failed", text: "TypeError: x is undefined" });
  assert.ok(status.attention);
});

test("a plugin paused after repeated errors says how many and over how long", () => {
  const status = pluginRowStatus(plugin({ state: "auto-disabled", blocked: { by: "errors", errors: 5, windowMs: 60000 } }), undefined, live);
  assert.deepEqual([status.dot, status.label, status.note], ["bad", "paused", { kind: "paused", errors: 5, seconds: 60 }]);
  assert.ok(status.attention);
});

test("a plugin waiting for a switched-off built-in feature names that feature", () => {
  const status = pluginRowStatus(plugin({ state: "waiting", waitingFor: ["todos/v1"] }), undefined, live);
  assert.deepEqual(status.note, { kind: "waiting", service: "todos/v1", provider: "todos", providerOff: true });
  assert.equal(status.dot, "wait");
  assert.ok(status.attention);
  const unknown = pluginRowStatus(plugin({ state: "waiting", waitingFor: ["weather/v1"] }), undefined, live);
  assert.deepEqual(unknown.note, { kind: "waiting", service: "weather/v1", provider: null, providerOff: false });
});

test("a switched-off plugin is grey and not something to fix, unless the market revoked it", () => {
  assert.deepEqual(pluginRowStatus(plugin({ state: "disabled" }), market(), live), { dot: "off", label: "off", note: null, attention: false });
  const revoked = pluginRowStatus(plugin({ state: "disabled" }), market({ revoked: true }), live);
  assert.deepEqual(revoked.note, { kind: "revoked" });
  assert.ok(revoked.attention);
});

test("while the plugin process is unreachable the last state is not trusted", () => {
  const status = pluginRowStatus(plugin({ state: "failed", error: "boom" }), market(), { ...live, live: false });
  assert.deepEqual([status.dot, status.label, status.attention], ["off", "unknown", false]);
});

test("plugins that are not running yet wait for the runtime download", () => {
  assert.equal(pluginRowStatus(plugin({ state: "loading" }), undefined, { ...live, runtime: "downloading" }).label, "waitingRuntime");
  assert.equal(pluginRowStatus(plugin({ state: "loading" }), undefined, live).label, "starting");
});

test("a newer market version is an update note; a changed signing key needs the user", () => {
  const update = pluginRowStatus(plugin(), market({ autoUpdate: candidate("0.5.0", { fresh: true }) }), live);
  assert.deepEqual(update.note, { kind: "update", version: "0.5.0", fresh: true });
  assert.equal(update.attention, false);
  const trust = pluginRowStatus(plugin(), market({ manual: candidate("0.5.0", { confirmation: { ...candidate("0").confirmation, trustChange: "unendorsed-key" } }) }), live);
  assert.deepEqual(trust.note, { kind: "trust", version: "0.5.0" });
  assert.ok(trust.attention);
  assert.equal(pluginRowStatus(plugin(), market({ manual: candidate("0.4.2") }), live).note, null);
});

test("a host problem wins over a market note on the same row", () => {
  const status = pluginRowStatus(plugin({ state: "failed", error: "Error: broken" }), market({ autoUpdate: candidate("0.5.0") }), live);
  assert.equal(status.note.kind, "failed");
});

test("the market offers install before install and update after", () => {
  assert.deepEqual(marketActionCandidate(market({ installedVersion: null, install: candidate("1.0.0") })), { candidate: candidate("1.0.0"), isUpdate: false });
  assert.equal(marketActionCandidate(market()), null);
  assert.equal(firstLine("  \n  only line \n"), "only line");
});
