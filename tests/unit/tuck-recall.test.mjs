import assert from "node:assert/strict";
import test from "node:test";
import { nextTuckSource, shouldRecallIdleTuck } from "../../src/windows/island/tuckRecall.ts";

const tucked = { isTucked: true, tuckSource: "idle", hold: true, autoTuck: true };

const replay = (...events) => events.reduce((source, event) => nextTuckSource(source, event), null);

test("an idle-tucked island comes back when a hold condition turns on", () => {
  assert.equal(shouldRecallIdleTuck(tucked), true);
});

test("an island the user tucked away stays tucked while held", () => {
  assert.equal(shouldRecallIdleTuck({ ...tucked, tuckSource: replay("tuckIsland") }), false);
  assert.equal(shouldRecallIdleTuck({ ...tucked, tuckSource: replay("minimizeToEdge") }), false);
});

test("nothing happens without a hold, when not tucked, or with idle tucking off", () => {
  assert.equal(shouldRecallIdleTuck({ ...tucked, hold: false }), false);
  assert.equal(shouldRecallIdleTuck({ ...tucked, isTucked: false }), false);
  assert.equal(shouldRecallIdleTuck({ ...tucked, autoTuck: false }), false);
  assert.equal(shouldRecallIdleTuck({ ...tucked, tuckSource: null }), false);
});

test("re-tucking after a peek keeps the original source", () => {
  assert.equal(replay("idleTuck", "endPeek"), "idle");
  assert.equal(replay("minimizeToEdge", "endPeek"), "manual");
});

test("a later tuck replaces the source and opening the island clears it", () => {
  assert.equal(replay("idleTuck", "tuckIsland"), "manual");
  assert.equal(replay("tuckIsland", "idleTuck"), "idle");
  for (const event of ["reveal", "collapse", "setMode"]) {
    assert.equal(replay("idleTuck", event), null);
  }
});
