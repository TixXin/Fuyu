import assert from "node:assert/strict";
import test from "node:test";
import { reconcile, switchChanges, withSwitches } from "../../src/features/plugin-kernel/legacySwitches.ts";

const list = (enabled) => [{ id: "translation", kind: "builtin", enabled, background: [] }];
const fresh = new Set();
const done = new Set(["translationEnabled"]);

test("the island and settings read the switch table, and keep the stored value until it arrives", () => {
  assert.equal(withSwitches({ translationEnabled: true }, list(false)).translationEnabled, false);
  assert.equal(withSwitches({ translationEnabled: false }, null).translationEnabled, false);
  const same = { translationEnabled: true };
  assert.equal(withSwitches(same, list(true)), same);
});

test("writing a legacy field switches its built-in plugin", () => {
  assert.deepEqual(switchChanges({ translationEnabled: true }, { translationEnabled: false }), [["translation", false]]);
  assert.deepEqual(switchChanges({ translationEnabled: true }, { translationEnabled: true }), []);
});

test("an old setting that turned translation off is moved into plugins.yml once", () => {
  const first = reconcile({ translationEnabled: false }, list(true), null, fresh);
  assert.deepEqual(first.switch, [["translation", false]]);
  assert.deepEqual(first.migrated, ["translationEnabled"]);
  const on = reconcile({ translationEnabled: true }, list(true), null, fresh);
  assert.deepEqual([on.switch, on.mirror, on.migrated], [[], {}, ["translationEnabled"]]);
});

test("after the move the switch wins at start and is mirrored into the stored settings", () => {
  const result = reconcile({ translationEnabled: true }, list(false), null, done);
  assert.deepEqual([result.switch, result.mirror, result.migrated], [[], { translationEnabled: false }, []]);
});

test("a stored value changed while running (restore, sync, another window) wins over the switch", () => {
  const seen = { stored: { translationEnabled: true }, switched: { translationEnabled: true } };
  assert.deepEqual(reconcile({ translationEnabled: false }, list(true), seen, done).switch, [["translation", false]]);
  const flipped = reconcile({ translationEnabled: true }, list(false), seen, done);
  assert.deepEqual([flipped.switch, flipped.mirror], [[], { translationEnabled: false }]);
});

test("before the switch table arrives nothing is switched, mirrored or marked moved", () => {
  const result = reconcile({ translationEnabled: false }, [], null, fresh);
  assert.deepEqual([result.switch, result.mirror, result.migrated], [[], {}, []]);
});

test("a mirror or a switch settles after one more look, so the two sides never fight", () => {
  let settings = { translationEnabled: true };
  let enabled = false;
  let seen = null;
  const writes = [];
  for (let round = 0; round < 4; round += 1) {
    const result = reconcile(settings, list(enabled), seen, done);
    seen = result.seen;
    for (const [, on] of result.switch) { enabled = on; writes.push(`switch ${on}`); }
    if (Object.keys(result.mirror).length) { settings = { ...settings, ...result.mirror }; writes.push(`mirror ${settings.translationEnabled}`); }
  }
  assert.deepEqual(writes, ["mirror false"]);
  assert.deepEqual([settings.translationEnabled, enabled], [false, false]);
});

test("the settings window flips the switch and the island, seeing the stored value change, agrees without writing back", () => {
  let seen = reconcile({ translationEnabled: true }, list(true), null, done).seen;
  const changes = switchChanges({ translationEnabled: true }, { translationEnabled: false });
  assert.deepEqual(changes, [["translation", false]]);
  const beforeSwitch = reconcile({ translationEnabled: false }, list(true), seen, done);
  assert.deepEqual(beforeSwitch.switch, [["translation", false]]);
  seen = beforeSwitch.seen;
  const afterSwitch = reconcile({ translationEnabled: false }, list(false), seen, done);
  assert.deepEqual([afterSwitch.switch, afterSwitch.mirror], [[], {}]);
});
