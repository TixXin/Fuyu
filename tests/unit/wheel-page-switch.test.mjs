import assert from "node:assert/strict";
import test from "node:test";
import {
  createWheelPageSwitchTracker,
  normalizeWheelDelta,
  stepPageIndex,
  WHEEL_EXTEND_MS,
  WHEEL_IDLE_RESET_MS,
  WHEEL_LINE_PX,
  WHEEL_SETTLE_MS,
} from "../../src/windows/island/wheelPageSwitch.ts";

test("normalizeWheelDelta converts lines and picks the dominant axis", () => {
  assert.equal(normalizeWheelDelta(120, 0, 0), 120);
  assert.equal(normalizeWheelDelta(1, 0, 1), WHEEL_LINE_PX);
  assert.equal(normalizeWheelDelta(5, -60, 0), -60);
});

test("stepPageIndex clamps at both ends without wrapping", () => {
  assert.equal(stepPageIndex(0, -1, 4), 0);
  assert.equal(stepPageIndex(0, 1, 4), 1);
  assert.equal(stepPageIndex(3, 1, 4), 3);
  assert.equal(stepPageIndex(3, -1, 4), 2);
});

test("wheel tracker accumulates up to 50px, swallows inertia for 450ms + 150ms extensions, and resets after 200ms idle", () => {
  const tracker = createWheelPageSwitchTracker();
  assert.equal(tracker.feed(20, 1000), 0);
  assert.equal(tracker.feed(20, 1050), 0);
  assert.equal(tracker.feed(15, 1100), 1);
  assert.equal(tracker.feed(80, 1100 + WHEEL_SETTLE_MS - 50), 0);
  assert.equal(tracker.feed(80, 1100 + WHEEL_SETTLE_MS + 50), 0);
  const settled = 1100 + WHEEL_SETTLE_MS + 50 + WHEEL_EXTEND_MS + 10;
  assert.equal(tracker.feed(30, settled), 0);
  assert.equal(tracker.feed(30, settled + WHEEL_IDLE_RESET_MS + 50), 0);
  assert.equal(tracker.feed(-60, settled + WHEEL_IDLE_RESET_MS + 80), -1);
});
