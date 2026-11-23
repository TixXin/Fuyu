import assert from "node:assert/strict";
import test from "node:test";
import { countdownClock, countdownTickDelay } from "../../src/features/daily-widgets/countdown.ts";

test("a 25 minute pomodoro reads 25:00 right after it starts, never 25:01", () => {
  assert.equal(countdownClock(25 * 60_000), "25:00");
  assert.equal(countdownClock(25 * 60_000 - 1), "25:00");
  assert.equal(countdownClock(25 * 60_000 - 1000), "24:59");
});

test("the clock never shows a negative time", () => {
  assert.equal(countdownClock(-500), "00:00");
});

test("the next tick lands just after the shown second runs out", () => {
  const endsAt = 1_000_000;
  assert.equal(countdownTickDelay(endsAt, endsAt - 25 * 60_000) > 1000, true);
  assert.equal(countdownTickDelay(endsAt, endsAt - 25 * 60_000) <= 1030, true);
  const delay = countdownTickDelay(endsAt, endsAt - 1_499_600);
  assert.equal(countdownClock(1_499_600), "25:00");
  assert.equal(countdownClock(1_499_600 - delay), "24:59");
  assert.equal(countdownClock(1_499_600 - delay + 30), "25:00");
});

test("a finished pomodoro asks for a quick tick so it settles", () => {
  assert.equal(countdownTickDelay(1_000, 2_000) < 100, true);
});
