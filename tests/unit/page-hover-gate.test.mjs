import assert from "node:assert/strict";
import test from "node:test";
import { blockSlidPage, createPageHoverGate, leavePageHover, pageHoverBlocked, pageHoverMoved, pageHoverRestarts, pageHoverWait, PAGE_HOVER_INTENT_MS, PAGE_SWITCH_SETTLE_MS, settlePageHover } from "../../src/windows/island/pageHoverGate.ts";

test("a pointer that moves onto a page button counts", () => {
  const gate = createPageHoverGate();
  assert.equal(pageHoverMoved(gate, 10, 10), true);
  assert.equal(pageHoverMoved(gate, 14, 10), true);
});

test("a button sliding under a resting pointer does not switch pages back and forth", () => {
  const gate = createPageHoverGate();
  assert.equal(pageHoverMoved(gate, 100, 12), true);
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

test("a pointer sweeping across a page button on its way to the panel does not open it", () => {
  const gate = createPageHoverGate();
  assert.equal(pageHoverRestarts(gate, 100, 10), true);
  assert.equal(pageHoverRestarts(gate, 103, 12), false);
  assert.equal(pageHoverRestarts(gate, 106, 16), true);
  assert.equal(pageHoverRestarts(gate, 108, 18), false);
  assert.equal(pageHoverRestarts(gate, 112, 25), true);
});

test("after a page of another width opens, the button that slid under the pointer waits until the pointer leaves it", () => {
  const gate = createPageHoverGate();
  settlePageHover(gate, 1_000, new Map([["fuyu", 20], ["todo", 100], ["music", 140]]));
  blockSlidPage(gate, { page: "fuyu", left: 98 }, "todo");
  assert.equal(pageHoverBlocked(gate, "fuyu"), true);
  assert.equal(pageHoverBlocked(gate, "music"), false);
  leavePageHover(gate, "fuyu");
  assert.equal(pageHoverBlocked(gate, "fuyu"), false);
});

test("pages of the same width keep hover switching from one button to the next", () => {
  const gate = createPageHoverGate();
  settlePageHover(gate, 1_000, new Map([["todo", 100], ["music", 140]]));
  blockSlidPage(gate, { page: "music", left: 140 }, "todo");
  assert.equal(pageHoverBlocked(gate, "music"), false);
  blockSlidPage(gate, { page: "todo", left: 60 }, "todo");
  assert.equal(pageHoverBlocked(gate, "todo"), false);
});

test("a new page change forgets the button blocked by the previous one", () => {
  const gate = createPageHoverGate();
  settlePageHover(gate, 1_000, new Map([["fuyu", 20]]));
  blockSlidPage(gate, { page: "fuyu", left: 98 }, "todo");
  settlePageHover(gate, 3_000, new Map([["fuyu", 98]]));
  assert.equal(pageHoverBlocked(gate, "fuyu"), false);
});
