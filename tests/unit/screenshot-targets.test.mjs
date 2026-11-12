import assert from "node:assert/strict";
import test from "node:test";
import { layersAt, layersKey, stepLayer } from "../../src/features/screenshot/targets.ts";

const BOUNDS = { width: 1920, height: 1080 };
const window = (z, x, y, width, height) => ({ window: z, element: false, x, y, width, height });
const control = (z, x, y, width, height) => ({ window: z, element: true, x, y, width, height });

const TARGETS = [
  window(0, 100, 100, 800, 600),
  control(0, 100, 100, 800, 40),
  control(0, 110, 105, 30, 30),
  control(0, 100, 100, 800, 600),
  window(1, 0, 0, 1920, 1040),
  control(1, 0, 0, 1920, 80),
];

test("the layers under the pointer go from the innermost control out to the monitor, in the top window only", () => {
  const layers = layersAt(TARGETS, { x: 120, y: 110 }, BOUNDS);
  assert.deepEqual(layers, [
    { x: 110, y: 105, width: 30, height: 30 },
    { x: 100, y: 100, width: 800, height: 40 },
    { x: 100, y: 100, width: 800, height: 600 },
    { x: 0, y: 0, width: 1920, height: 1080 },
  ]);
});

test("outside the top window, the window below and its controls are found", () => {
  const layers = layersAt(TARGETS, { x: 50, y: 40 }, BOUNDS);
  assert.deepEqual(layers.map((layer) => layer.width), [1920, 1920, 1920]);
  assert.deepEqual(layers[0], { x: 0, y: 0, width: 1920, height: 80 });
  assert.deepEqual(layersAt([], { x: 5, y: 5 }, BOUNDS), [{ x: 0, y: 0, width: 1920, height: 1080 }]);
});

test("the wheel steps outward and inward within the layers", () => {
  assert.equal(stepLayer(0, -100, 4), 1);
  assert.equal(stepLayer(3, -100, 4), 3);
  assert.equal(stepLayer(1, 100, 4), 0);
  assert.equal(stepLayer(0, 100, 4), 0);
  assert.equal(stepLayer(0, -100, 0), 0);
  assert.notEqual(layersKey(layersAt(TARGETS, { x: 120, y: 110 }, BOUNDS)), layersKey(layersAt(TARGETS, { x: 500, y: 400 }, BOUNDS)));
  assert.equal(layersKey([]), "");
});
