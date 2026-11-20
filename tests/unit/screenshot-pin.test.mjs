import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PIN_SCALE, MIN_PIN_OPACITY, MIN_PIN_SCALE, isDoubleClick, nextOpacity, nextScale, pinKeyCommand } from "../../src/features/screenshot/pin.ts";

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

test("each pin action has a key; the plain ones do not need Ctrl and the Ctrl ones need it", () => {
  assert.equal(pinKeyCommand("Escape", false), "close");
  assert.equal(pinKeyCommand(" ", false), "annotate");
  assert.equal(pinKeyCommand("O", false), "text");
  assert.deepEqual(["1", "2", "3", "4"].map((key) => pinKeyCommand(key, false)), ["left", "right", "flipX", "flipY"]);
  assert.equal(pinKeyCommand("m", false), "collapse");
  assert.equal(pinKeyCommand("c", true), "copy");
  assert.equal(pinKeyCommand("c", false), null, "a plain C does nothing, so it never copies by accident");
  assert.equal(pinKeyCommand("0", true), "actualSize");
  assert.equal(pinKeyCommand("q", false), null);
});

test("two presses close in time and place are a double click; a drag in between is not", () => {
  const first = { at: 1000, x: 10, y: 10 };
  assert.equal(isDoubleClick(first, { at: 1200, x: 12, y: 11 }), true);
  assert.equal(isDoubleClick(first, { at: 1500, x: 10, y: 10 }), false);
  assert.equal(isDoubleClick(first, { at: 1100, x: 60, y: 10 }), false);
  assert.equal(isDoubleClick(null, first), false);
});
