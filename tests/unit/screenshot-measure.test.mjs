import assert from "node:assert/strict";
import test from "node:test";
import { edgesAround, rulerBetween, spanAround } from "../../src/features/screenshot/measure.ts";

function line(colors) {
  return new Uint8ClampedArray(colors.flatMap((value) => [value, value, value, 255]));
}

test("a span reaches both edges of the run of similar colour around the pointer", () => {
  const row = line([0, 0, 200, 200, 205, 200, 0, 0]);
  assert.deepEqual(spanAround(row, 3), [2, 6]);
  assert.deepEqual(spanAround(row, 0), [0, 2]);
});

test("a span stops at colour changes larger than the tolerance", () => {
  const row = line([100, 100, 130, 100]);
  assert.deepEqual(spanAround(row, 0), [0, 2]);
  assert.deepEqual(spanAround(row, 0, 40), [0, 4]);
});

test("a span runs to the picture's edge when nothing changes", () => {
  assert.deepEqual(spanAround(line([9, 9, 9]), 1), [0, 3]);
  assert.deepEqual(spanAround(line([]), 0), [0, 0]);
  assert.deepEqual(spanAround(line([9, 9, 9]), 99), [0, 3]);
});

test("edges combine the row and the column through the pixel", () => {
  const row = line([0, 50, 50, 50, 0]);
  const column = line([50, 50, 0]);
  assert.deepEqual(edgesAround(row, column, { x: 2, y: 1 }), { left: 1, right: 4, top: 0, bottom: 2 });
});

test("the ruler gives the distance and both offsets in pixels", () => {
  assert.deepEqual(rulerBetween({ x: 10, y: 10 }, { x: 40, y: 50 }), { dx: 30, dy: 40, length: 50 });
  assert.deepEqual(rulerBetween({ x: 5, y: 5 }, { x: 4, y: 6 }), { dx: 1, dy: 1, length: 1.4 });
});
