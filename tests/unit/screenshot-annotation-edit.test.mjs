import assert from "node:assert/strict";
import test from "node:test";
import {
  annotationAt,
  annotationHandles,
  annotationLevel,
  dragHandle,
  handleAt,
  hitsAnnotation,
  moveAnnotation,
  restyleAnnotation,
} from "../../src/features/screenshot/annotationEdit.ts";
import { EMPTY_HISTORY, addAnnotation, redoAnnotation, removeAnnotation, replaceAnnotation, undoAnnotation } from "../../src/features/screenshot/annotations.ts";

const rect = { kind: "rect", color: "#FF3B30", width: 4, from: { x: 10, y: 10 }, to: { x: 110, y: 60 } };
const ellipse = { kind: "ellipse", color: "#FF3B30", width: 4, from: { x: 0, y: 0 }, to: { x: 100, y: 50 } };
const arrow = { kind: "arrow", color: "#FF3B30", width: 4, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } };
const pen = { kind: "pen", color: "#FF3B30", width: 4, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }] };
const mosaic = { kind: "mosaic", color: "#FF3B30", width: 4, from: { x: 0, y: 0 }, to: { x: 40, y: 40 } };
const text = { kind: "text", color: "#FF3B30", size: 22, at: { x: 10, y: 10 }, text: "hi" };
const badge = { kind: "number", color: "#FF3B30", size: 14, at: { x: 30, y: 30 }, value: 1 };

test("a hollow shape is picked on its outline, so a click inside still reaches what lies under it", () => {
  assert.equal(hitsAnnotation(rect, { x: 10, y: 35 }, 4), true);
  assert.equal(hitsAnnotation(rect, { x: 60, y: 35 }, 4), false);
  assert.equal(hitsAnnotation(ellipse, { x: 100, y: 25 }, 4), true);
  assert.equal(hitsAnnotation(ellipse, { x: 50, y: 25 }, 4), false);
  assert.equal(hitsAnnotation(ellipse, { x: 0, y: 0 }, 4), false, "the bounding-box corner is outside the ellipse");
});

test("lines are picked near the stroke, filled things anywhere on them", () => {
  assert.equal(hitsAnnotation(arrow, { x: 50, y: 5 }, 4), true);
  assert.equal(hitsAnnotation(arrow, { x: 50, y: 20 }, 4), false);
  assert.equal(hitsAnnotation(pen, { x: 52, y: 30 }, 4), true);
  assert.equal(hitsAnnotation(pen, { x: 20, y: 30 }, 4), false);
  assert.equal(hitsAnnotation(mosaic, { x: 20, y: 20 }, 4), true);
  assert.equal(hitsAnnotation(text, { x: 20, y: 20 }, 4), true);
  assert.equal(hitsAnnotation(badge, { x: 36, y: 30 }, 4), true);
  assert.equal(hitsAnnotation(badge, { x: 60, y: 60 }, 4), false);
});

test("the topmost annotation under the pointer wins", () => {
  assert.equal(annotationAt([mosaic, badge], { x: 30, y: 30 }, 4), badge);
  assert.equal(annotationAt([badge, mosaic], { x: 30, y: 30 }, 4), mosaic);
  assert.equal(annotationAt([rect], { x: 200, y: 200 }, 4), null);
});

test("moving shifts every point of the annotation and keeps the rest", () => {
  assert.deepEqual(moveAnnotation(rect, 5, -5), { ...rect, from: { x: 15, y: 5 }, to: { x: 115, y: 55 } });
  assert.deepEqual(moveAnnotation(pen, 1, 2).points, [{ x: 1, y: 2 }, { x: 51, y: 2 }, { x: 51, y: 52 }]);
  assert.deepEqual(moveAnnotation(text, 3, 4), { ...text, at: { x: 13, y: 14 } });
});

test("a box's corner handle resizes against the opposite corner; an arrow's handles move its ends", () => {
  assert.deepEqual(annotationHandles(rect).map((spot) => spot.handle), ["nw", "ne", "se", "sw"]);
  assert.equal(handleAt(rect, { x: 112, y: 58 }, 7), "se");
  assert.equal(handleAt(rect, { x: 60, y: 35 }, 7), null);
  const resized = dragHandle(rect, "se", { x: 150, y: 90 });
  assert.deepEqual([resized.from, resized.to], [{ x: 10, y: 10 }, { x: 150, y: 90 }]);
  const fromTopLeft = dragHandle(rect, "nw", { x: 0, y: 0 });
  assert.deepEqual([fromTopLeft.from, fromTopLeft.to], [{ x: 110, y: 60 }, { x: 0, y: 0 }]);
  assert.deepEqual(dragHandle(arrow, "end", { x: 40, y: 40 }).to, { x: 40, y: 40 });
  assert.deepEqual(dragHandle(arrow, "start", { x: 5, y: 5 }).from, { x: 5, y: 5 });
  assert.equal(annotationHandles(text).length, 0, "text and pen strokes only move");
});

test("restyling changes colour and thickness the same way drawing would have, a mosaic has no colour", () => {
  assert.deepEqual(restyleAnnotation(rect, { color: "#0A84FF", level: 2 }, 1), { ...rect, color: "#0A84FF", width: 8 });
  assert.equal(restyleAnnotation({ ...pen, kind: "highlighter", width: 16 }, { level: 0 }, 1).width, 8);
  assert.equal(restyleAnnotation(text, { level: 2 }, 1.5).size, 48);
  assert.equal(restyleAnnotation(badge, { level: 0 }, 1).size, 11);
  assert.equal(restyleAnnotation(mosaic, { color: "#0A84FF" }, 1), mosaic);
  assert.equal(restyleAnnotation(rect, { color: "#FF3B30" }, 1), rect, "an unchanged style keeps the same object, so nothing goes into the history");
  assert.equal(annotationLevel(rect, 1), 1);
  assert.equal(annotationLevel(text, 1), 1);
  assert.equal(annotationLevel({ ...rect, width: 5 }, 1), null);
});

test("edits and deletions go into undo / redo like new drawings", () => {
  const moved = moveAnnotation(rect, 10, 0);
  let history = replaceAnnotation(addAnnotation(addAnnotation(EMPTY_HISTORY, rect), badge), rect, moved);
  assert.deepEqual(history.items, [moved, badge], "the edited annotation keeps its place in the stack");
  history = removeAnnotation(history, badge);
  assert.deepEqual(history.items, [moved]);
  history = undoAnnotation(history);
  assert.deepEqual(history.items, [moved, badge]);
  history = undoAnnotation(history);
  assert.deepEqual(history.items, [rect, badge]);
  assert.deepEqual(redoAnnotation(redoAnnotation(history)).items, [moved]);
  assert.equal(replaceAnnotation(history, rect, rect), history);
  assert.equal(replaceAnnotation(history, moved, rect), history, "an annotation no longer there is not replaced");
});
