import test from "node:test";
import assert from "node:assert/strict";
import { cropRect, fitScale, imageEditKey, rotatedSize, toImagePoint } from "../../src/features/clipboard/imageEdit.ts";

const key = (init) => ({ key: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init });

test("the picture fits the stage without growing past four times", () => {
  assert.equal(fitScale({ width: 800, height: 400 }, { width: 400, height: 400 }), 0.5);
  assert.equal(fitScale({ width: 400, height: 800 }, { width: 400, height: 400 }), 0.5);
  assert.equal(fitScale({ width: 10, height: 10 }, { width: 400, height: 400 }), 4);
  assert.equal(fitScale({ width: 0, height: 10 }, { width: 400, height: 400 }), 1);
});

test("a quarter turn swaps the sides", () => {
  assert.deepEqual(rotatedSize({ width: 30, height: 20 }), { width: 20, height: 30 });
});

test("a pointer on the scaled stage lands on the picture's own pixels, clamped to its edges", () => {
  const stage = { x: 10, y: 20, width: 200, height: 100 };
  const image = { width: 800, height: 400 };
  assert.deepEqual(toImagePoint({ x: 60, y: 45 }, stage, image), { x: 200, y: 100 });
  assert.deepEqual(toImagePoint({ x: -5, y: 500 }, stage, image), { x: 0, y: 400 });
});

test("a crop is whole pixels inside the picture, and a tiny or full one is no crop", () => {
  const image = { width: 100, height: 80 };
  assert.deepEqual(cropRect({ x: 60.6, y: 50.2 }, { x: 10.4, y: 5.9 }, image), { x: 10, y: 5, width: 51, height: 46 });
  assert.deepEqual(cropRect({ x: -10, y: -10 }, { x: 40, y: 200 }, image), { x: 0, y: 0, width: 40, height: 80 });
  assert.equal(cropRect({ x: 10, y: 10 }, { x: 12, y: 40 }, image), null);
  assert.equal(cropRect({ x: -5, y: -5 }, { x: 120, y: 90 }, image), null);
});

test("editing keys follow the platform's primary key", () => {
  assert.equal(imageEditKey(key({ key: "s", ctrlKey: true }), false), "save");
  assert.equal(imageEditKey(key({ key: "S", ctrlKey: true, shiftKey: true }), false), "save-as-new");
  assert.equal(imageEditKey(key({ key: "s", metaKey: true }), true), "save");
  assert.equal(imageEditKey(key({ key: "s", metaKey: true }), false), null);
  assert.equal(imageEditKey(key({ key: "z", ctrlKey: true }), false), "undo");
  assert.equal(imageEditKey(key({ key: "Z", metaKey: true, shiftKey: true }), true), "redo");
  assert.equal(imageEditKey(key({ key: "y", ctrlKey: true }), false), "redo");
  assert.equal(imageEditKey(key({ key: "y", metaKey: true }), true), null);
  assert.equal(imageEditKey(key({ key: "Enter" }), false), "apply");
  assert.equal(imageEditKey(key({ key: "Escape" }), false), "escape");
  assert.equal(imageEditKey(key({ key: "s", ctrlKey: true, altKey: true }), false), null);
  assert.equal(imageEditKey(key({ key: "s" }), false), null);
});
