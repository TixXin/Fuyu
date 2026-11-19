import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateContributions } from "../../src/features/plugin-kernel/islandContributions.ts";
import { heldOnHover, remainingAtHover } from "../../src/features/messages/island/heldPreview.ts";
import { BAR_HEIGHT, FIT_ROUNDS, fitGrow, INITIAL_FIT, MAX_GROWN_HEIGHT, stepFit } from "../../src/features/messages/island/summaryFit.ts";

const fits = { deficit: 0, available: 300, chrome: 0, content: 0 };

test("a message that fits on one line leaves the bar alone", () => {
  assert.equal(stepFit(INITIAL_FIT, fits), INITIAL_FIT);
  assert.equal(fitGrow(INITIAL_FIT), null);
});

test("a cut-off message widens the bar by what was cut, then stops once it fits", () => {
  const wider = stepFit(INITIAL_FIT, { ...fits, deficit: 57.4 });
  assert.equal(wider.wrap, false);
  assert.ok(wider.extra >= 58);
  assert.deepEqual(fitGrow(wider), { width: wider.extra, height: BAR_HEIGHT });
  assert.equal(stepFit(wider, { ...fits, available: 358 }), wider);
});

test("when the bar stops getting wider the message wraps instead", () => {
  const asked = stepFit(INITIAL_FIT, { ...fits, deficit: 400 });
  const capped = stepFit(asked, { ...fits, deficit: 220, available: 300 });
  assert.equal(capped.wrap, true);
  assert.equal(capped.extra, asked.extra);
});

test("a bar that keeps widening a little still wraps after a few rounds", () => {
  let state = INITIAL_FIT;
  for (let round = 0; round < FIT_ROUNDS; round++) state = stepFit(state, { ...fits, deficit: 40, available: 300 + round * 50 });
  assert.equal(state.wrap, false);
  assert.equal(stepFit(state, { ...fits, deficit: 40, available: 600 }).wrap, true);
});

test("a wrapped message grows the bar to its text and scrolls past the ceiling", () => {
  const wrapped = { ...INITIAL_FIT, extra: 180, wrap: true, rounds: 1 };
  const twoLines = stepFit(wrapped, { ...fits, chrome: 18, content: 36.4 });
  assert.equal(twoLines.height, 55);
  assert.equal(stepFit(twoLines, { ...fits, chrome: 18, content: 36.4 }), twoLines);
  assert.equal(stepFit(wrapped, { ...fits, chrome: 18, content: 400 }).height, MAX_GROWN_HEIGHT);
  assert.equal(stepFit(wrapped, { ...fits, chrome: 18, content: 10 }), wrapped);
});

test("the summary's grown size reaches the shell and an equal one keeps the same object", () => {
  const grow = { width: 120, height: 74 };
  const first = aggregateContributions([[{ kind: "summary", item: "messages.summary", grow }]], true);
  assert.deepEqual(first.summaryGrow, grow);
  const again = aggregateContributions([[{ kind: "summary", item: "messages.summary", grow: { ...grow } }]], true, first);
  assert.equal(again, first);
  assert.equal(aggregateContributions([[{ kind: "summary", item: "messages.summary" }]], true, first).summaryGrow, null);
});

test("a preview dropped while hovered keeps the time it had left when the hover began", () => {
  assert.equal(remainingAtHover(9_000, 6_000, 5_000), 3_000);
  assert.equal(remainingAtHover(9_000, 6_000, 7_500), 1_500);
  assert.equal(remainingAtHover(5_000, 6_000, 1_000), 0);
});

test("leaving starts the countdown and coming back pauses it with what is left", () => {
  const held = { preview: { source: "qq", title: "A", body: "B", receivedAt: 1 }, key: "k", remaining: 3_000, deadline: null };
  const left = heldOnHover(held, false, 10_000);
  assert.equal(left.deadline, 13_000);
  const back = heldOnHover(left, true, 11_200);
  assert.deepEqual([back.remaining, back.deadline], [1_800, null]);
  assert.equal(heldOnHover(back, true, 12_000), back);
  assert.equal(heldOnHover(null, false, 1), null);
});
