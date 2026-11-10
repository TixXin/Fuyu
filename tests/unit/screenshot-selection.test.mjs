import assert from "node:assert/strict";
import test from "node:test";
import {
  handlePosition,
  hexColor,
  hitTest,
  isSelection,
  magnifierPosition,
  moveRect,
  pixelAt,
  pixelScale,
  rectFromPoints,
  resizeRect,
  toCss,
  toPixels,
} from "../../src/features/screenshot/selection.ts";

const BOUNDS = { width: 2560, height: 1440 };

test("the overlay's scale comes from the picture against the view, so 150% and 100% monitors both map to physical pixels", () => {
  // A 2560-wide monitor at 150%: the overlay is 1706.67 CSS pixels wide.
  const scale = pixelScale(BOUNDS, { width: 2560 / 1.5, height: 1440 / 1.5 });
  assert.equal(scale, 1.5);
  assert.deepEqual(toPixels({ x: 100, y: 200 }, scale), { x: 150, y: 300 });
  assert.deepEqual(toCss({ x: 150, y: 300, width: 30, height: 60 }, scale), { x: 100, y: 200, width: 20, height: 40 });
  assert.equal(pixelScale({ width: 1920, height: 1080 }, { width: 1920, height: 1080 }), 1);
  // A view not laid out yet does not divide by zero.
  assert.equal(pixelScale(BOUNDS, { width: 0, height: 0 }), 1);
});

test("a drag in any direction is a rectangle on whole pixels, kept inside the monitor", () => {
  assert.deepEqual(rectFromPoints({ x: 300.4, y: 200.6 }, { x: 100, y: 50 }, BOUNDS), { x: 100, y: 50, width: 200, height: 151 });
  assert.deepEqual(rectFromPoints({ x: -20, y: 10 }, { x: 3000, y: 2000 }, BOUNDS), { x: 0, y: 10, width: 2560, height: 1430 });
  assert.equal(isSelection({ x: 0, y: 0, width: 3, height: 50 }), false);
  assert.equal(isSelection({ x: 0, y: 0, width: 4, height: 4 }), true);
  assert.deepEqual(pixelAt({ x: 2560.2, y: -3 }, BOUNDS), { x: 2559, y: 0 });
});

test("dragging a handle moves its edges, and past the opposite edge it flips", () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 };
  assert.deepEqual(resizeRect(rect, "se", { x: 400, y: 260 }, BOUNDS), { x: 100, y: 100, width: 300, height: 160 });
  assert.deepEqual(resizeRect(rect, "n", { x: 0, y: 40 }, BOUNDS), { x: 100, y: 40, width: 200, height: 160 });
  assert.deepEqual(resizeRect(rect, "e", { x: 50, y: 0 }, BOUNDS), { x: 50, y: 100, width: 50, height: 100 });
});

test("moving keeps the whole selection on the monitor", () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 };
  assert.deepEqual(moveRect(rect, 10, -20, BOUNDS), { x: 110, y: 80, width: 200, height: 100 });
  assert.deepEqual(moveRect(rect, -500, 5000, BOUNDS), { x: 0, y: 1340, width: 200, height: 100 });
});

test("a press grabs a corner, an edge, the inside, or nothing", () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 };
  assert.equal(hitTest(rect, { x: 102, y: 98 }, 6), "nw");
  assert.equal(hitTest(rect, { x: 300, y: 200 }, 6), "se");
  assert.equal(hitTest(rect, { x: 200, y: 104 }, 6), "n");
  assert.equal(hitTest(rect, { x: 297, y: 150 }, 6), "e");
  assert.equal(hitTest(rect, { x: 200, y: 150 }, 6), "inside");
  assert.equal(hitTest(rect, { x: 50, y: 150 }, 6), null);
  assert.deepEqual(handlePosition(rect, "s"), { x: 200, y: 200 });
});

test("colours read as #RRGGBB and the magnifier flips away from the edges", () => {
  assert.equal(hexColor(116, 214, 255), "#74D6FF");
  assert.equal(hexColor(0, 5, 10), "#00050A");
  const box = { width: 132, height: 196 };
  const view = { width: 1000, height: 800 };
  assert.deepEqual(magnifierPosition({ x: 100, y: 100 }, box, view, 20), { x: 120, y: 120 });
  assert.deepEqual(magnifierPosition({ x: 950, y: 750 }, box, view, 20), { x: 798, y: 534 });
});
