import assert from "node:assert/strict";
import { test } from "node:test";
import { activeRevocations, mergeRevoked, revocationOf, validateRevoked } from "../src/index.mjs";
import { reason, revoked } from "./fixtures.mjs";

const name = "@someone/weather";
const entry = (id, version, level) => ({ id, name, version, level, reason: reason("原因", "reason") });

test("a well-formed revocation list has no problems", () => {
  const list = revoked([entry("r1", "1.0.0", "warn"), entry("r2", "*", "disable")], { withdrawn: [{ id: "r1", reason: reason("误报", "mistake") }] });
  assert.deepEqual(validateRevoked(list), []);
});

test("bad revocation entries are reported by path", () => {
  const list = revoked([
    { id: "R 1", name: "weather", version: "1", level: "uninstall", reason: { en: "x" } },
    entry("r2", "1.0.0", "warn"),
    entry("r2", "1.0.1", "warn"),
  ], { withdrawn: [{ id: "missing", reason: reason("a", "b") }] });
  assert.deepEqual(
    validateRevoked(list).map((p) => p.path),
    ["entries[0].id", "entries[0].name", "entries[0].version", "entries[0].level", "entries[0].reason", "entries[2]", "withdrawn[0].id"],
  );
  assert.deepEqual(validateRevoked({ ...revoked([]), withdrawn: undefined }).map((p) => p.path), ["withdrawn"]);
});

test("merging only adds: a later list that drops an entry keeps it", () => {
  const first = mergeRevoked(null, revoked([entry("r1", "1.0.0", "disable")], { serial: 1 }));
  assert.deepEqual(first.added, ["r1"]);
  const second = mergeRevoked(first.state, revoked([entry("r2", "1.1.0", "warn")], { serial: 2 }));
  assert.equal(second.ok, true);
  assert.deepEqual(second.added, ["r2"]);
  assert.deepEqual(second.state.entries.map((e) => e.id), ["r1", "r2"]);
  assert.equal(revocationOf(second.state, name, "1.0.0").level, "disable");
  assert.equal(second.state.serial, 2);
});

test("an older list cannot be merged", () => {
  const { state } = mergeRevoked(null, revoked([entry("r1", "1.0.0", "disable")], { serial: 5 }));
  const result = mergeRevoked(state, revoked([], { serial: 4 }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "older-serial");
  assert.equal(result.state, state);
});

test("an entry id is fixed: a later list cannot soften it", () => {
  const { state } = mergeRevoked(null, revoked([entry("r1", "1.0.0", "disable")], { serial: 1 }));
  const next = mergeRevoked(state, revoked([entry("r1", "1.0.0", "warn")], { serial: 2 }));
  assert.equal(revocationOf(next.state, name, "1.0.0").level, "disable");
});

test("only an explicit withdrawal lifts a revocation, and it stays withdrawn", () => {
  const { state } = mergeRevoked(null, revoked([entry("r1", "1.0.0", "disable")], { serial: 1 }));
  const lifted = mergeRevoked(state, revoked([entry("r1", "1.0.0", "disable")], { serial: 2, withdrawn: [{ id: "r1", reason: reason("误报", "mistake") }] }));
  assert.deepEqual(lifted.withdrawn, ["r1"]);
  assert.equal(revocationOf(lifted.state, name, "1.0.0"), null);
  const later = mergeRevoked(lifted.state, revoked([entry("r1", "1.0.0", "disable")], { serial: 3 }));
  assert.equal(revocationOf(later.state, name, "1.0.0"), null);
  const again = mergeRevoked(later.state, revoked([entry("r1", "1.0.0", "disable"), entry("r9", "1.0.0", "disable")], { serial: 4, withdrawn: [{ id: "r1", reason: reason("误报", "mistake") }] }));
  assert.equal(revocationOf(again.state, name, "1.0.0").level, "disable");
});

test("the stronger level wins and * covers every version", () => {
  const { state } = mergeRevoked(null, revoked([entry("r1", "1.0.0", "warn"), entry("r2", "*", "warn"), entry("r3", "1.0.0", "disable")]));
  assert.equal(revocationOf(state, name, "1.0.0").level, "disable");
  assert.equal(revocationOf(state, name, "2.0.0").level, "warn");
  assert.equal(revocationOf(state, "@other/thing", "1.0.0"), null);
  assert.equal(activeRevocations(state).length, 3);
  assert.equal(revocationOf(null, name, "1.0.0"), null);
});
