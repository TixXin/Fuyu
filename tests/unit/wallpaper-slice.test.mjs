import assert from "node:assert/strict";
import test from "node:test";

import { contrastFrost, luminanceSpread, monitorUnder, placeImage, sampleBox, settleFrost, wallpaperPlacement } from "../../src/lib/theme/wallpaperSlice.ts";
import { relativeLuminance } from "../../src/utils/color.ts";

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

const channels = (hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
const hexOf = (rgb) => `#${rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0")).join("")}`;
const over = (top, alpha, under) => hexOf(channels(top).map((value, index) => value * alpha + channels(under)[index] * (1 - alpha)));
const contrast = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const inkOf = (island) => (relativeLuminance(island) > 0.18 ? "#18181e" : "#f8f6f0");
const solid = (hex) => ({ dark: relativeLuminance(hex), bright: relativeLuminance(hex) });

test("the frost under live glass is thick enough for secondary text over any desktop", () => {
  const islands = ["#f2f2f5", "#f7f1e6", "#f4f8fd", "#000000", "#0a1320", "#1f1b17"];
  const desktops = ["#000000", "#ffffff", "#202830", "#7a7a7a", "#c8d0e0", "#3050a0"];
  for (const island of islands) {
    for (const desktop of desktops) {
      const frost = Math.max(0.25, contrastFrost(solid(desktop), island));
      const glass = over(island, frost, desktop);
      const secondary = over(inkOf(island), relativeLuminance(island) > 0.18 ? 0.7 : 0.68, glass);
      const subtle = over(inkOf(island), relativeLuminance(island) > 0.18 ? 0.56 : 0.54, glass);
      assert.ok(contrast(secondary, glass) >= 3, `${island} on ${desktop}: secondary text ${contrast(secondary, glass).toFixed(2)} at frost ${frost}`);
      assert.ok(contrast(subtle, glass) >= 2.8, `${island} on ${desktop}: subtle text ${contrast(subtle, glass).toFixed(2)} at frost ${frost}`);
    }
  }
});

test("the frost stays at the user's strength when the desktop already suits the text", () => {
  assert.equal(contrastFrost(solid("#ffffff"), "#f2f2f5"), 0);
  assert.equal(contrastFrost(solid("#000000"), "#000000"), 0);
  assert.ok(contrastFrost(solid("#000000"), "#f2f2f5") > 0.6);
  assert.ok(contrastFrost(solid("#ffffff"), "#000000") > 0.6);
});

test("a light island is judged by the darkest part behind it, a dark island by the brightest", () => {
  const split = { dark: 0, bright: 1 };
  assert.ok(contrastFrost(split, "#f2f2f5") >= contrastFrost(solid("#000000"), "#f2f2f5"));
  assert.ok(contrastFrost(split, "#000000") >= contrastFrost(solid("#ffffff"), "#000000"));
});

test("an island colour that can never carry its own text gets the thickest frost", () => {
  assert.equal(contrastFrost(solid("#ffffff"), "#606060"), 0.95);
});

test("the backdrop spread ignores the darkest and brightest tenth", () => {
  assert.equal(luminanceSpread([]), null);
  const values = Array.from({ length: 100 }, (_, index) => index / 100);
  assert.deepEqual(luminanceSpread(values), { dark: 0.1, bright: 0.9 });
});

test("the frost rises at once but only falls back after a clear drop, so it does not flicker", () => {
  assert.equal(settleFrost(0.3, 0.45), 0.45);
  assert.equal(settleFrost(0.45, 0.4), 0.45);
  assert.equal(settleFrost(0.45, 0.35), 0.35);
  assert.equal(settleFrost(0.45, 0), 0);
});
