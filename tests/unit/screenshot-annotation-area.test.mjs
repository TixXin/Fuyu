import assert from "node:assert/strict";
import test from "node:test";
import { annotationArea, annotationBounds } from "../../src/features/screenshot/annotations.ts";

const selection = { x: 100, y: 100, width: 400, height: 300 };
const rect = { kind: "rect", color: "#FF3B30", width: 4, from: { x: 150, y: 160 }, to: { x: 200, y: 220 } };

test("without annotations nothing needs composing", () => {
  assert.equal(annotationArea([], selection), null);
});

test("the area covers each annotation with its line, in whole pixels", () => {
  assert.deepEqual(annotationArea([rect], selection), { x: 146, y: 156, width: 58, height: 68 });
  const pen = { kind: "pen", color: "#000000", width: 2.5, points: [{ x: 300.4, y: 310 }, { x: 320, y: 305.2 }] };
  assert.deepEqual(annotationArea([rect, pen], selection), { x: 146, y: 156, width: 177, height: 157 });
});

test("an arrow's head and a badge are inside their bounds", () => {
  const arrow = annotationBounds({ kind: "arrow", color: "#FF3B30", width: 4, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } });
  assert.ok(arrow.y <= -8 && arrow.y + arrow.height >= 8 && arrow.x + arrow.width >= 100);
  assert.deepEqual(annotationBounds({ kind: "number", color: "#FF3B30", size: 14, at: { x: 50, y: 50 }, value: 1 }), { x: 34, y: 34, width: 32, height: 32 });
});

test("text bounds grow with its longest line and its line count", () => {
  const one = annotationBounds({ kind: "text", color: "#FF3B30", size: 20, at: { x: 0, y: 0 }, text: "截图" });
  const two = annotationBounds({ kind: "text", color: "#FF3B30", size: 20, at: { x: 0, y: 0 }, text: "截图\n长一点的一行" });
  assert.ok(one.width >= 40 && one.height >= 26);
  assert.ok(two.width > one.width && two.height > one.height);
});

test("the area never leaves the selection, and is nothing when all of it is outside", () => {
  const edge = { ...rect, from: { x: 90, y: 90 }, to: { x: 140, y: 140 } };
  assert.deepEqual(annotationArea([edge], selection), { x: 100, y: 100, width: 44, height: 44 });
  const outside = { ...rect, from: { x: 0, y: 0 }, to: { x: 40, y: 40 } };
  assert.equal(annotationArea([outside], selection), null);
});
