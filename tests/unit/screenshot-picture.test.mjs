import assert from "node:assert/strict";
import test from "node:test";
import { colorAt, edgesIn } from "../../src/features/screenshot/picture.ts";

function picture(rows) {
  const width = rows[0].length;
  const data = new Uint8ClampedArray(rows.flat().flatMap((value) => [value, value >> 1, 255 - value, 255]));
  return { id: 1, width, height: rows.length, data };
}

const shot = picture([
  [0, 0, 0, 0, 0],
  [0, 200, 200, 200, 0],
  [0, 200, 200, 200, 0],
  [0, 0, 0, 0, 0],
]);

test("the colour under the pointer comes from the picture's pixels", () => {
  assert.equal(colorAt(shot, { x: 0, y: 0 }), "#0000FF");
  assert.equal(colorAt(shot, { x: 2, y: 1 }), "#C86437");
});

test("a pixel outside the picture reads as black and has no edges", () => {
  assert.equal(colorAt(shot, { x: 5, y: 0 }), "#000000");
  assert.equal(colorAt(shot, { x: 0, y: -1 }), "#000000");
  assert.equal(edgesIn(shot, { x: 0, y: 4 }), null);
  assert.equal(edgesIn({ ...shot, data: new Uint8ClampedArray(8) }, { x: 0, y: 0 }), null);
});

test("edges follow the row and the column through the pointer", () => {
  assert.deepEqual(edgesIn(shot, { x: 2, y: 1 }), { left: 1, right: 4, top: 1, bottom: 3 });
  assert.deepEqual(edgesIn(shot, { x: 0, y: 2 }), { left: 0, right: 1, top: 0, bottom: 4 });
});
