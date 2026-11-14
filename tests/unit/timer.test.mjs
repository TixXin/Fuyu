import assert from "node:assert/strict";
import test from "node:test";
import {
  clockText,
  dueTimers,
  extended,
  newCountdown,
  newStopwatch,
  nextDueIn,
  normalizeTimers,
  parseDuration,
  paused,
  remainingOf,
  resumed,
  shownMs,
  shownTimer,
} from "../../src/features/timer/timers.ts";

const MIN = 60_000;

test("durations read as minutes by default and accept units in either language", () => {
  assert.equal(parseDuration("10"), 10 * MIN);
  assert.equal(parseDuration("10m"), 10 * MIN);
  assert.equal(parseDuration("1h30m"), 90 * MIN);
  assert.equal(parseDuration("1h 30m"), 90 * MIN);
  assert.equal(parseDuration("90s"), 90_000);
  assert.equal(parseDuration("2.5"), 150_000);
  assert.equal(parseDuration("1小时30分钟"), 90 * MIN);
  assert.equal(parseDuration("10 分钟"), 10 * MIN);
  assert.equal(parseDuration("45秒"), 45_000);
  assert.equal(parseDuration("1:30"), 90_000);
  assert.equal(parseDuration("1:00:00"), 60 * MIN);
});

test("nonsense, zero and over a day are refused", () => {
  for (const text of ["", "abc", "10x", "m10", "0", "0.001", "25h", "1:75", "10m abc"]) assert.equal(parseDuration(text), null, text);
});

test("a countdown counts down, pauses without losing time and resumes", () => {
  const timer = newCountdown("a", 10 * MIN, 0);
  assert.equal(remainingOf(timer, 4 * MIN), 6 * MIN);
  const held = paused(timer, 4 * MIN);
  assert.equal(remainingOf(held, 60 * MIN), 6 * MIN);
  const again = resumed(held, 60 * MIN);
  assert.equal(remainingOf(again, 61 * MIN), 5 * MIN);
});

test("a finished countdown is due once, and five more minutes start it again", () => {
  const timer = newCountdown("a", MIN, 0);
  assert.deepEqual(dueTimers([timer], 30_000), []);
  assert.deepEqual(dueTimers([timer], MIN).map((t) => t.id), ["a"]);
  assert.deepEqual(dueTimers([{ ...timer, alerted: true }], 2 * MIN), []);
  const more = extended({ ...timer, alerted: true }, 2 * MIN);
  assert.equal(remainingOf(more, 2 * MIN), 5 * MIN);
  assert.equal(more.alerted, false);
  assert.equal(resumed(paused(timer, 2 * MIN), 3 * MIN).runningSince, null);
});

test("the soonest running countdown is shown, otherwise a running stopwatch", () => {
  const long = newCountdown("long", 30 * MIN, 0);
  const short = newCountdown("short", 10 * MIN, 0);
  const watch = newStopwatch("watch", 0);
  assert.equal(shownTimer([long, watch, short], MIN)?.id, "short");
  assert.equal(shownTimer([paused(long, 0), watch], MIN)?.id, "watch");
  assert.equal(shownMs(watch, 75_000), 75_000);
  assert.equal(shownTimer([paused(watch, 0)], MIN), null);
  assert.equal(nextDueIn([long, short, watch], MIN), 9 * MIN);
  assert.equal(nextDueIn([watch], MIN), null);
});

test("after a restart a countdown keeps real time, so one that ran out while closed is due at once", () => {
  const saved = JSON.parse(JSON.stringify([newCountdown("a", 10 * MIN, 1_000_000), { junk: true }, newStopwatch("a", 0)]));
  const timers = normalizeTimers(saved);
  assert.equal(timers.length, 1);
  assert.equal(remainingOf(timers[0], 1_000_000 + 4 * MIN), 6 * MIN);
  assert.deepEqual(dueTimers(timers, 1_000_000 + 60 * MIN).map((t) => t.id), ["a"]);
  assert.deepEqual(normalizeTimers("x"), []);
});

test("countdowns show whole seconds rounded up, stopwatches rounded down", () => {
  assert.equal(clockText(59_001, true), "01:00");
  assert.equal(clockText(59_999, false), "00:59");
  assert.equal(clockText(3_725_000, false), "1:02:05");
});
