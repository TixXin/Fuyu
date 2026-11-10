import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_HISTORY,
  addAnnotation,
  arrowGeometry,
  extendAnnotation,
  isMeaningful,
  lineWidth,
  mosaicBlock,
  nextNumber,
  normalizedRect,
  redoAnnotation,
  startAnnotation,
  textSize,
  undoAnnotation,
} from "../../src/features/screenshot/annotations.ts";
import { normalizeAnnotationStyle } from "../../src/features/screenshot/storage.ts";

const STYLE = { color: "#FF3B30", level: 1 };

test("a line is as thick in CSS pixels on every monitor: picture pixels grow with the scale", () => {
  assert.equal(lineWidth(1, 1), 4);
  assert.equal(lineWidth(1, 1.5), 6);
  assert.equal(lineWidth(2, 2), 16);
  assert.equal(textSize(0, 1.5), 24);
  assert.equal(mosaicBlock(2), 6);
  assert.equal(mosaicBlock(12), 36);
});

test("each tool starts its own shape; text starts nothing (it is typed first), a number is placed at once", () => {
  const at = { x: 10, y: 20 };
  assert.deepEqual(startAnnotation("rect", at, STYLE, 1, []), { kind: "rect", color: "#FF3B30", width: 4, from: at, to: at });
  assert.deepEqual(startAnnotation("pen", at, STYLE, 1, []), { kind: "pen", color: "#FF3B30", width: 4, points: [at] });
  assert.equal(startAnnotation("highlighter", at, STYLE, 1, []).width, 16);
  assert.equal(startAnnotation("text", at, STYLE, 1, []), null);
  const first = startAnnotation("number", at, STYLE, 1, []);
  assert.equal(first.value, 1);
  assert.equal(startAnnotation("number", at, STYLE, 1, [first, { ...first, value: 4 }]).value, 5);
  assert.equal(nextNumber([]), 1);
});

test("dragging moves a shape's corner or adds a stroke point; a click draws nothing", () => {
  const rect = startAnnotation("rect", { x: 10, y: 10 }, STYLE, 1, []);
  assert.equal(isMeaningful(rect), false);
  const dragged = extendAnnotation(rect, { x: 40, y: 5 });
  assert.deepEqual(dragged.to, { x: 40, y: 5 });
  assert.equal(isMeaningful(dragged), true);
  assert.deepEqual(normalizedRect(dragged.from, dragged.to), { x: 10, y: 5, width: 30, height: 5 });

  const pen = startAnnotation("pen", { x: 0, y: 0 }, STYLE, 1, []);
  assert.equal(extendAnnotation(pen, { x: 0.4, y: 0.3 }), pen, "a point closer than a pixel is dropped");
  const stroke = extendAnnotation(pen, { x: 5, y: 0 });
  assert.equal(stroke.points.length, 2);
  assert.equal(isMeaningful(stroke), true);
  assert.equal(isMeaningful({ kind: "text", color: "#000000", size: 22, at: { x: 0, y: 0 }, text: "  " }), false);
});

test("an arrow's head sits at the end, grows with the line and never passes half the arrow", () => {
  const { tip, left, right, base } = arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 4);
  assert.deepEqual(tip, { x: 100, y: 0 });
  assert.deepEqual(base, { x: 84, y: 0 });
  assert.deepEqual([left, right], [{ x: 84, y: 8 }, { x: 84, y: -8 }]);
  assert.equal(arrowGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, 8).base.x, 5);
});

test("undo and redo step through the history; something new drops what was undone", () => {
  const a = { kind: "number", color: "#FF3B30", size: 14, at: { x: 0, y: 0 }, value: 1 };
  const b = { ...a, value: 2 };
  let history = addAnnotation(addAnnotation(EMPTY_HISTORY, a), b);
  history = undoAnnotation(history);
  assert.deepEqual(history.items, [a]);
  assert.deepEqual(redoAnnotation(history).items, [a, b]);
  assert.deepEqual(addAnnotation(history, b).undone, []);
  assert.equal(undoAnnotation(EMPTY_HISTORY), EMPTY_HISTORY);
  assert.equal(redoAnnotation(EMPTY_HISTORY), EMPTY_HISTORY);
});

test("the saved colour and thickness come back, anything else falls back to red and medium", () => {
  assert.deepEqual(normalizeAnnotationStyle({ color: "#0A84FF", level: 2 }), { color: "#0A84FF", level: 2 });
  assert.deepEqual(normalizeAnnotationStyle({ color: "pink", level: 7 }), { color: "#FF3B30", level: 1 });
  assert.deepEqual(normalizeAnnotationStyle(undefined), { color: "#FF3B30", level: 1 });
});
