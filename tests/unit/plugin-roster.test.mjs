import assert from "node:assert/strict";
import test from "node:test";
import { createRosterSync } from "../../src/features/updater/pluginRosterSync.ts";
import {
  MAX_ROSTER_CONFIG_BYTES,
  dismissRosterItems,
  keepLocalConfig,
  normalizeRoster,
  parseRoster,
  reconcileRoster,
  rosterGaps,
  rosterItemOf,
} from "../../src/lib/plugin-roster/roster.ts";
import { BACKUP_KEYS } from "../../src/lib/settings-backup/backup.ts";
import { applyRosterConfig, installRosterItem, planMissing } from "../../src/windows/settings/pluginRosterModel.ts";

const EMPTY = { seen: {}, dismissed: [] };
const weather = (config = { city: "Hangzhou" }, enabled = true) => ({ id: "@fuyu/weather", source: "market", enabled, config });

test("the roster travels with the settings backup", () => {
  assert.ok(BACKUP_KEYS.includes("fuyu-market-plugins"));
  assert.ok(!BACKUP_KEYS.includes("fuyu-market-plugins-local"));
});

test("a roster entry leaves out secrets, and a plugin installed from a file carries only its name", () => {
  const item = rosterItemOf(weather({ city: "Hangzhou", apiKey: "k", nested: { access_token: "t", units: "celsius" }, Password: "p" }));
  assert.deepEqual(item, { id: "@fuyu/weather", source: "market", enabled: true, config: { city: "Hangzhou", nested: { units: "celsius" } } });
  assert.deepEqual(rosterItemOf({ id: "@me/gadget", source: "manual", enabled: false, config: { city: "x" } }), { id: "@me/gadget", source: "manual", enabled: false });
});

test("settings over the size limit stay on this device and the entry says so", () => {
  const item = rosterItemOf(weather({ blob: "a".repeat(MAX_ROSTER_CONFIG_BYTES) }));
  assert.deepEqual(item, { id: "@fuyu/weather", source: "market", enabled: true, configOmitted: "tooLarge" });
  assert.deepEqual(normalizeRoster([item]), [item]);
});

test("a roster from a backup or another device is cleaned before use", () => {
  const roster = parseRoster(JSON.stringify([
    { id: "@fuyu/weather", enabled: false, config: { city: "x", token: "t" }, version: "9" },
    { id: "todos", enabled: true },
    { id: "@fuyu/../escape", enabled: true },
    { id: "@fuyu/weather", enabled: true },
    "nonsense",
  ]));
  assert.deepEqual(roster, [{ id: "@fuyu/weather", source: "market", enabled: false, config: { city: "x" } }]);
  assert.deepEqual(parseRoster("{broken"), []);
  assert.deepEqual(parseRoster(null), []);
});

test("the first look lists what is installed; a later change on this device updates its entry", () => {
  const first = reconcileRoster([], EMPTY, [weather()]);
  assert.deepEqual(first.roster, [weather()]);
  assert.equal(first.rosterChanged, true);
  const same = reconcileRoster(first.roster, first.local, [weather()]);
  assert.equal(same.rosterChanged, false);
  assert.equal(same.localChanged, false);
  const changed = reconcileRoster(first.roster, first.local, [weather({ city: "Suzhou" }, false)]);
  assert.deepEqual(changed.roster, [weather({ city: "Suzhou" }, false)]);
});

test("an entry that came from another device is not overwritten until this device changes", () => {
  const mine = reconcileRoster([], EMPTY, [weather()]);
  const theirs = [weather({ city: "Beijing" })];
  const kept = reconcileRoster(theirs, mine.local, [weather()]);
  assert.deepEqual(kept.roster, theirs);
  assert.equal(kept.rosterChanged, false);
  const fresh = reconcileRoster(theirs, EMPTY, [weather()]);
  assert.deepEqual(fresh.roster, theirs);
});

test("uninstalling here drops the entry and stops suggesting it; a device that still has it lists it again", () => {
  const mine = reconcileRoster([], EMPTY, [weather()]);
  const gone = reconcileRoster(mine.roster, mine.local, []);
  assert.deepEqual(gone.roster, []);
  assert.deepEqual(gone.local, { seen: {}, dismissed: ["@fuyu/weather"] });
  assert.deepEqual(rosterGaps([weather()], gone.local, []).missing, []);

  const other = reconcileRoster([], mine.local, [weather()]);
  assert.deepEqual(other.roster, [weather()]);

  const back = reconcileRoster([weather()], gone.local, [weather()]);
  assert.deepEqual(back.local.dismissed, []);
});

test("plugins this device lacks are offered once; file-installed ones are only named", () => {
  const roster = [weather(), { id: "@me/gadget", source: "manual", enabled: true }, { id: "@fuyu/pomodoro", source: "market", enabled: false }];
  const gaps = rosterGaps(roster, EMPTY, [{ id: "@fuyu/pomodoro", source: "market", enabled: true, config: {} }]);
  assert.deepEqual(gaps.missing.map((item) => item.id), ["@fuyu/weather"]);
  assert.deepEqual(gaps.manual.map((item) => item.id), ["@me/gadget"]);
  assert.deepEqual(gaps.differing, []);
  const dismissed = dismissRosterItems(EMPTY, ["@fuyu/weather", "@me/gadget", "todos"]);
  assert.deepEqual(dismissed.dismissed, ["@fuyu/weather", "@me/gadget"]);
  assert.deepEqual(rosterGaps(roster, dismissed, []).missing.map((item) => item.id), ["@fuyu/pomodoro"]);
});

test("settings differ only where the other device's values are not the ones here", () => {
  const roster = [weather({ city: "Beijing", units: "celsius" })];
  const differing = (config) => rosterGaps(roster, EMPTY, [{ id: "@fuyu/weather", source: "market", enabled: true, config }]).differing.length;
  assert.equal(differing({ city: "Hangzhou", units: "celsius" }), 1);
  assert.equal(differing({ city: "Beijing", units: "celsius", extra: 1, apiKey: "local" }), 0);
  assert.equal(differing({}), 1);
  assert.equal(differing(null), 0);
  const kept = keepLocalConfig(roster, [weather({ city: "Hangzhou", units: "celsius" })], ["@fuyu/weather"]);
  assert.deepEqual(kept, [weather({ city: "Hangzhou", units: "celsius" })]);
});

test("when the host cannot be asked, the roster is left alone", async () => {
  const saved = [];
  const deps = {
    installed: async () => [{ id: "@fuyu/weather", source: "market", enabled: true }],
    config: async () => {
      throw new Error("offline");
    },
    loadRoster: () => [weather()],
    saveRoster: (items) => saved.push(items),
    loadLocal: () => ({ seen: { "@fuyu/weather": "x", "@fuyu/pomodoro": "y" }, dismissed: [] }),
    saveLocal: (local) => saved.push(local),
  };
  await createRosterSync(deps).run();
  assert.deepEqual(saved, []);
  await createRosterSync({ ...deps, config: async () => ({ city: "Suzhou" }) }).run();
  assert.deepEqual(saved[0], [weather({ city: "Suzhou" })]);
  assert.deepEqual(saved[1].dismissed, ["@fuyu/pomodoro"]);
});

const candidate = (more = {}) => ({ version: "1.0.0", confirmation: { unreviewed: false }, ...more });
const listed = (name, more = {}) => ({ name, revoked: false, install: candidate(), manual: null, ...more });

test("one click installs only reviewed, unchanged, installable plugins", () => {
  const ids = ["@fuyu/weather", "@x/unreviewed", "@x/new-key", "@x/revoked", "@x/blocked", "@x/gone", "@x/warned"];
  const missing = ids.map((id) => ({ id, source: "market", enabled: true }));
  const plugins = [
    listed("@fuyu/weather"),
    listed("@x/unreviewed", { install: null, manual: candidate({ confirmation: { unreviewed: true } }) }),
    listed("@x/new-key", { install: candidate({ trustChange: "unendorsed-key" }) }),
    listed("@x/revoked", { revoked: true }),
    listed("@x/blocked", { blocked: { reason: "platform" } }),
    listed("@x/warned", { revocation: { level: "warn", reasons: [] } }),
  ];
  const plan = planMissing(missing, plugins, true);
  assert.deepEqual(plan.install.map((item) => item.id), ["@fuyu/weather"]);
  assert.deepEqual(plan.review.map((item) => item.id), ["@x/unreviewed", "@x/new-key", "@x/warned"]);
  assert.deepEqual(plan.unavailable.map((item) => item.id), ["@x/revoked", "@x/blocked", "@x/gone"]);
  assert.deepEqual(planMissing(missing.slice(5, 6), [], false).install.map((item) => item.id), ["@x/gone"]);
});

function recordingClients(entry = { schema: null, values: {} }, failing = []) {
  const calls = [];
  const step = (name) => async (...args) => {
    calls.push([name, ...args]);
    if (failing.includes(name)) throw new Error(name);
    return name === "getConfig" ? entry : null;
  };
  return { calls, clients: { getConfig: step("getConfig"), setConfig: step("setConfig"), install: step("install"), setEnabled: step("setEnabled") } };
}

test("installing from the roster writes the settings first, installs from the market, then matches the on/off state", async () => {
  const { calls, clients } = recordingClients();
  await installRosterItem(clients, weather({ city: "Beijing" }, false));
  assert.deepEqual(calls, [["setConfig", "@fuyu/weather", { city: "Beijing" }], ["install", "@fuyu/weather"], ["setEnabled", "@fuyu/weather", false]]);

  const plain = recordingClients({ schema: null, values: {} }, ["setConfig"]);
  await installRosterItem(plain.clients, weather());
  assert.deepEqual(plain.calls.map(([name]) => name), ["setConfig", "install"]);

  const broken = recordingClients({ schema: null, values: {} }, ["install"]);
  await assert.rejects(installRosterItem(broken.clients, weather({ city: "x" }, false)));
  assert.ok(!broken.calls.some(([name]) => name === "setEnabled"));
});

test("taking the other device's settings goes through the plugin's form when it has one, and restarts it when it has none", async () => {
  const schema = { properties: { city: { type: "string" }, units: { type: "string" } } };
  const form = recordingClients({ schema, values: { city: "Hangzhou", units: "celsius" } });
  await applyRosterConfig(form.clients, weather({ city: "Beijing", units: "celsius", removedField: 1 }), true);
  assert.deepEqual(form.calls.slice(1), [["setConfig", "@fuyu/weather", { city: "Beijing" }]]);

  const own = recordingClients({ schema: null, values: {} });
  await applyRosterConfig(own.clients, weather({ city: "Beijing" }), true);
  assert.deepEqual(own.calls.slice(1), [["setConfig", "@fuyu/weather", { city: "Beijing" }], ["setEnabled", "@fuyu/weather", false], ["setEnabled", "@fuyu/weather", true]]);

  const off = recordingClients({ schema: null, values: {} });
  await applyRosterConfig(off.clients, weather({ city: "Beijing" }), false);
  assert.deepEqual(off.calls.map(([name]) => name), ["getConfig", "setConfig"]);
});
