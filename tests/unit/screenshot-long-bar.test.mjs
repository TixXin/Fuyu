import assert from "node:assert/strict";
import test from "node:test";
import { longBarPlace } from "../../src/features/screenshot/selection.ts";

const view = { width: 1000, height: 700 };
const box = { width: 176, height: 400 };

test("the long-screenshot bar sits right of the selection, else left, else inside its right edge", () => {
  assert.deepEqual(longBarPlace({ x: 100, y: 50, width: 300, height: 500 }, view, box), { x: 412, y: 50 });
  assert.deepEqual(longBarPlace({ x: 500, y: 50, width: 450, height: 500 }, view, box), { x: 312, y: 50 });
  assert.deepEqual(longBarPlace({ x: 20, y: 50, width: 960, height: 500 }, view, box), { x: 792, y: 50 });
});

test("it stays on screen vertically", () => {
  assert.equal(longBarPlace({ x: 100, y: 500, width: 300, height: 150 }, view, box).y, 292);
  assert.equal(longBarPlace({ x: 100, y: -20, width: 300, height: 150 }, view, box).y, 8);
});