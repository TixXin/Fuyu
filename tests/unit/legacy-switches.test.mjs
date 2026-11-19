import assert from "node:assert/strict";
import test from "node:test";
import { migrateLegacySwitches, runLegacyMigration, switchOf, withSwitches } from "../../src/features/plugin-kernel/legacySwitches.ts";

const list = (enabled) => [{ id: "translation", kind: "builtin", enabled, background: [], config: {} }];
const messages = (config) => [{ id: "messages", kind: "builtin", enabled: true, background: [], config }];

test("in-memory settings projection reads the built-in switch table and falls back until it arrives", () => {
  assert.equal(switchOf(list(false), "translationEnabled"), false);
  assert.equal(switchOf(null, "translationEnabled"), undefined);
  assert.equal(withSwitches({ translationEnabled: true }, list(false)).translationEnabled, false);
  assert.equal(withSwitches({ translationEnabled: false }, null).translationEnabled, false);
  const same = { translationEnabled: true };
  assert.equal(withSwitches(same, list(true)), same);
});

test("mailEnabled in-memory projection reads messages.config.mail when boolean", () => {
  assert.equal(withSwitches({ mailEnabled: true }, messages({ mail: false })).mailEnabled, false);
  assert.equal(withSwitches({ mailEnabled: true }, messages({ mail: "off" })).mailEnabled, true);
});

test("an old stored false switch is migrated into plugins.yml once and never re-migrated", () => {
  const first = migrateLegacySwitches({ translationEnabled: false, todoEnabled: true }, [
    ...list(true),
    { id: "todos", kind: "builtin", enabled: true, background: [], config: {} },
  ], new Set());
  assert.deepEqual(first.switch, [{ field: "translationEnabled", id: "translation", on: false }]);
  assert.deepEqual(first.migrated, ["todoEnabled"]);

  const second = migrateLegacySwitches({ translationEnabled: false }, list(true), new Set([...first.migrated, "translationEnabled"]));
  assert.deepEqual(second, { switch: [], migrated: [] });
});

test("before the switch table has the plugin entry, nothing is migrated or marked done", () => {
  const empty = migrateLegacySwitches({ translationEnabled: false }, [], new Set());
  assert.deepEqual(empty, { switch: [], migrated: [] });
});

test("once migrated, built-in switches win without mirroring back into stored settings", () => {
  const after = migrateLegacySwitches({ translationEnabled: true }, list(false), new Set(["translationEnabled"]));
  assert.deepEqual(after, { switch: [], migrated: [] });
  assert.equal(withSwitches({ translationEnabled: true }, list(false)).translationEnabled, false);
});

function memoryStore(switchPlugin, saved = { marks: new Set() }) {
  const calls = [];
  return {
    calls,
    saved,
    marks: () => [...saved.marks].sort(),
    load: () => new Set(saved.marks),
    save: (fields) => {
      saved.marks = new Set(fields);
    },
    switchPlugin: async (id, on) => {
      calls.push([id, on]);
      await switchPlugin(id, on);
    },
    onError: () => {},
  };
}

const todosOn = { id: "todos", kind: "builtin", enabled: true, background: [], config: {} };

test("a stored false switch is only marked migrated after the plugin was actually switched off", async () => {
  const store = memoryStore(async () => {});
  await runLegacyMigration({ translationEnabled: false, todoEnabled: true }, [...list(true), todosOn], store, new Set());
  assert.deepEqual(store.calls, [["translation", false]]);
  assert.deepEqual(store.marks(), ["todoEnabled", "translationEnabled"]);
});

test("when switching a plugin off fails, that switch stays unmarked and is tried again on the next start, not in this one", async () => {
  const failing = memoryStore(async (id) => {
    if (id === "translation") throw new Error("the plugin host is not connected");
  });
  const tried = new Set();
  const settings = { translationEnabled: false, todoEnabled: false };
  await runLegacyMigration(settings, [...list(true), todosOn], failing, tried);
  assert.deepEqual(failing.marks(), ["todoEnabled"]);

  await runLegacyMigration(settings, [...list(true), todosOn], failing, tried);
  assert.deepEqual(failing.calls, [["todos", false], ["translation", false]]);

  const nextStart = memoryStore(async () => {}, failing.saved);
  await runLegacyMigration(settings, [...list(true), { ...todosOn, enabled: false }], nextStart, new Set());
  assert.deepEqual(nextStart.calls, [["translation", false]]);
  assert.deepEqual(nextStart.marks(), ["todoEnabled", "translationEnabled"]);
});
