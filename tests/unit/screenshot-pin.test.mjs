import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PIN_SCALE, MIN_PIN_OPACITY, MIN_PIN_SCALE, nextOpacity, nextScale } from "../../src/features/screenshot/pin.ts";

test("the wheel zooms a pin in and out within its limits, snapping back to its own size", () => {
  assert.equal(nextScale(1, -100), 1.1);
  assert.ok(Math.abs(nextScale(1, 100) - 1 / 1.1) < 1e-9);
  assert.equal(nextScale(1.1, 100), 1);
  assert.equal(nextScale(MAX_PIN_SCALE, -100), MAX_PIN_SCALE);
  assert.equal(nextScale(MIN_PIN_SCALE, 100), MIN_PIN_SCALE);
  assert.equal(nextScale(2, 0), 2);
});

test("Ctrl + wheel fades a pin in tenths, never past solid or too faint to find", () => {
  assert.equal(nextOpacity(1, 100), 0.9);
  assert.equal(nextOpacity(0.9, -100), 1);
  assert.equal(nextOpacity(1, -100), 1);
  assert.equal(nextOpacity(MIN_PIN_OPACITY, 100), MIN_PIN_OPACITY);
  assert.equal(nextOpacity(0.7, 100), 0.6);
});
