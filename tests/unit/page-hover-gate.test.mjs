import assert from "node:assert/strict";
import test from "node:test";
import { createPageHoverGate, pageHoverMoved, pageHoverWait, PAGE_HOVER_INTENT_MS, PAGE_SWITCH_SETTLE_MS, settlePageHover } from "../../src/windows/island/pageHoverGate.ts";

test("a pointer that moves onto a page button counts", () => {
  const gate = createPageHoverGate();
  assert.equal(pageHoverMoved(gate, 10, 10), true);
  assert.equal(pageHoverMoved(gate, 14, 10), true);
});

test("a button sliding under a resting pointer does not switch pages back and forth", () => {
  const gate = createPageHoverGate();
  assert.equal(pageHoverMoved(gate, 100, 12), true);
  // The island resizes and another button arrives under the pointer: same spot, not a move.
  assert.equal(pageHoverMoved(gate, 100, 12), false);
  assert.equal(pageHoverMoved(gate, 103, 12), true);
});

test("a pointer passing over buttons must rest briefly before a page opens, even with no delay set", () => {
  const gate = createPageHoverGate();
  assert.equal(pageHoverWait(gate, 0, 5_000), PAGE_HOVER_INTENT_MS);
  assert.equal(pageHoverWait(gate, 400, 5_000), 400);
});

test("a move while the island still resizes waits for it to settle instead of being dropped", () => {
  const gate = createPageHoverGate();
  settlePageHover(gate, 1_000);
  assert.equal(pageHoverWait(gate, 0, 1_100), PAGE_SWITCH_SETTLE_MS - 100 + PAGE_HOVER_INTENT_MS);
  assert.equal(pageHoverWait(gate, 0, 1_000 + PAGE_SWITCH_SETTLE_MS + 5), PAGE_HOVER_INTENT_MS);
});
