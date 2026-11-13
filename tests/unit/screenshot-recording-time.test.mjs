import assert from "node:assert/strict";
import test from "node:test";
import { clockTime, elapsedOf } from "../../src/features/screenshot/recordingTime.ts";

const recording = { phase: "recording", countdown: 0, paused: false, elapsedMs: 4_000, sinceMs: 10_000 };

test("the recording time adds the running stretch to what came before a pause", () => {
  assert.equal(elapsedOf(recording, 13_500), 7_500);
  assert.equal(elapsedOf({ ...recording, paused: true }, 99_000), 4_000);
  assert.equal(elapsedOf({ ...recording, phase: "countdown" }, 99_000), 0);
  assert.equal(elapsedOf(null, 99_000), 0);
  assert.equal(elapsedOf(recording, 5_000), 4_000);
});

test("times read as minutes and seconds, with hours only when needed", () => {
  assert.equal(clockTime(0), "00:00");
  assert.equal(clockTime(65_900), "01:05");
  assert.equal(clockTime(3_725_000), "1:02:05");
  assert.equal(clockTime(-5), "00:00");
});
