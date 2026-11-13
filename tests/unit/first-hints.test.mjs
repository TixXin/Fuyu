import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_FIRST_HINTS,
  MAX_SHOWINGS,
  markFirstHintDismissed,
  markFirstHintShown,
  nextFirstHint,
  normalizeFirstHints,
} from "../../src/features/first-hints/hints.ts";

const day = (d, h = 10) => new Date(2026, 10, d, h).getTime();

test("bad or old data reads as nothing seen", () => {
  assert.deepEqual(normalizeFirstHints(null), EMPTY_FIRST_HINTS);
  assert.deepEqual(normalizeFirstHints("x"), EMPTY_FIRST_HINTS);
  assert.deepEqual(
    normalizeFirstHints({ dismissed: ["tuck", "nope", "tuck"], shown: { agent: 2, bad: 3, message: -1 }, lastShownAt: "x" }),
    { dismissed: ["tuck"], shown: { agent: 2 }, lastShownAt: 0 },
  );
});

test("one hint a day, first pending first", () => {
  const first = nextFirstHint(EMPTY_FIRST_HINTS, ["message", "agent"], day(13));
  assert.equal(first, "message");
  const state = markFirstHintShown(EMPTY_FIRST_HINTS, "message", day(13, 9));
  assert.equal(nextFirstHint(state, ["agent"], day(13, 23)), null);
  assert.equal(nextFirstHint(state, ["agent"], day(14, 0)), "agent");
});

test("a dismissed hint never returns, an ignored one stops after a few showings", () => {
  const dismissed = markFirstHintDismissed(EMPTY_FIRST_HINTS, "agent");
  assert.equal(nextFirstHint(dismissed, ["agent"], day(20)), null);
  assert.equal(nextFirstHint(dismissed, ["agent", "tuck"], day(20)), "tuck");

  let state = EMPTY_FIRST_HINTS;
  for (let i = 0; i < MAX_SHOWINGS; i += 1) state = markFirstHintShown(state, "tuck", day(1 + i));
  assert.equal(nextFirstHint(state, ["tuck"], day(25)), null);
});
