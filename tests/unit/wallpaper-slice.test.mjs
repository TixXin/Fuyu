import assert from "node:assert/strict";
import test from "node:test";

import { contrastBoost, monitorUnder, placeImage, sampleBox, wallpaperPlacement } from "../../src/lib/theme/wallpaperSlice.ts";

const left = { x: -1920, y: 0, width: 1920, height: 1080, image: "data:left" };
const right = { x: 0, y: 0, width: 3840, height: 2160, image: "data:right" };
const sizes = { "data:left": { width: 960, height: 540 }, "data:right": { width: 960, height: 720 } };
const sizeOf = (image) => sizes[image] ?? null;

test("the island uses the monitor under its centre, or the nearest one when it is off screen", () => {
  assert.equal(monitorUnder([left, right], { x: -400, y: 10, width: 300, height: 40 }), left);
  assert.equal(monitorUnder([left, right], { x: 100, y: 10, width: 300, height: 40 }), right);
  assert.equal(monitorUnder([left, right], { x: 5000, y: -200, width: 300, height: 40 }), right);
  assert.equal(monitorUnder([], { x: 0, y: 0, width: 1, height: 1 }), undefined);
});

test("fill crops, fit letterboxes and stretch fills the monitor", () => {
  const area = { x: 0, y: 0, width: 3840, height: 2160 };
  assert.deepEqual(placeImage(area, { width: 960, height: 720 }, "fill"), { x: 0, y: -360, width: 3840, height: 2880 });
  assert.deepEqual(placeImage(area, { width: 960, height: 720 }, "fit"), { x: 480, y: 0, width: 2880, height: 2160 });
  assert.deepEqual(placeImage(area, { width: 960, height: 720 }, "stretch"), area);
});

test("span lays one image across all monitors", () => {
  const placement = wallpaperPlacement({ fit: "span", color: "#000000", monitors: [left, right] }, { x: 100, y: 0, width: 300, height: 40 }, sizeOf);
  assert.equal(placement.image, "data:right");
  assert.equal(placement.target.width, 5760);
});

test("a solid colour desktop gives a colour without an image, and an image not loaded yet gives nothing", () => {
  const solid = { ...right, image: null };
  assert.deepEqual(wallpaperPlacement({ fit: "fill", color: "#123456", monitors: [solid] }, { x: 0, y: 0, width: 10, height: 10 }, sizeOf), {
    image: null, color: "#123456", target: solid,
  });
  assert.equal(wallpaperPlacement({ fit: "fill", color: "#000000", monitors: [{ ...right, image: "data:new" }] }, { x: 0, y: 0, width: 10, height: 10 }, sizeOf), null);
});

test("the sample box is the island's share of the image, clamped to it", () => {
  assert.deepEqual(sampleBox({ x: 0, y: 0, width: 1000, height: 500 }, { x: 250, y: -50, width: 500, height: 100 }), {
    left: 0.25, top: 0, right: 0.75, bottom: 0.1,
  });
});

test("contrast boost thickens the tint only when the wallpaper fights the text", () => {
  assert.equal(contrastBoost(0.2, false), 0);
  assert.equal(contrastBoost(0.6, false), 0.18);
  assert.equal(contrastBoost(0.95, false), 0.3);
  assert.equal(contrastBoost(0.8, true), 0);
  assert.equal(contrastBoost(0.05, true), 0.3);
});
