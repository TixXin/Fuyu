import assert from "node:assert/strict";
import test from "node:test";
import { MEETING_BEAT_MS, meetingBeatAt, meetingBeats } from "../../src/features/calendar/meetingBeats.ts";

const MIN = 60_000;

test("a meeting reminder shows when it starts, a minute before and at the start", () => {
  const start = 10 * MIN;
  assert.deepEqual(meetingBeats(start, 0), [0, 9 * MIN, 10 * MIN]);
});

test("beats too close to the first one are dropped", () => {
  const start = 10 * MIN;
  assert.deepEqual(meetingBeats(start, start - MIN + 2000), [start - MIN + 2000, start]);
  assert.deepEqual(meetingBeats(start, start - 3000), [start - 3000]);
  assert.deepEqual(meetingBeats(start, start + MIN), [start + MIN]);
});

test("between beats the lyrics come back, and the next beat is when to look again", () => {
  const beats = [0, 9 * MIN, 10 * MIN];
  assert.deepEqual(meetingBeatAt(beats, 1000), { showing: true, changeAt: MEETING_BEAT_MS });
  assert.deepEqual(meetingBeatAt(beats, MEETING_BEAT_MS), { showing: false, changeAt: 9 * MIN });
  assert.deepEqual(meetingBeatAt(beats, 9 * MIN + 10), { showing: true, changeAt: 9 * MIN + MEETING_BEAT_MS });
  assert.deepEqual(meetingBeatAt(beats, 10 * MIN + MEETING_BEAT_MS), { showing: false, changeAt: null });
});
