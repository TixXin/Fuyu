import assert from "node:assert/strict";
import test from "node:test";
import { migrateLegacySwitches, switchOf, withSwitches } from "../../src/features/plugin-kernel/legacySwitches.ts";

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
  assert.deepEqual(first.switch, [["translation", false]]);
  assert.deepEqual(first.migrated, ["todoEnabled", "translationEnabled"]);

  const second = migrateLegacySwitches({ translationEnabled: false }, list(true), new Set(first.migrated));
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
