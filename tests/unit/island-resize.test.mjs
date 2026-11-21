import assert from "node:assert/strict";
import test from "node:test";
import {
  collapsedDetents,
  heightDetents,
  panelPresets,
  snap,
  snapPreset,
  widthDetents,
} from "../../src/windows/island/resize/detents.ts";
import { zoneAt } from "../../src/windows/island/resize/zones.ts";

const width = { min: 480, max: 1600 };
const height = { min: 240, max: 800 };

test("width detents stay inside the limits, keep the page default and drop near duplicates", () => {
  const detents = widthDetents(800, width);
  assert.deepEqual(detents.map((detent) => detent.value), [480, 640, 800, 1040, 1600]);
  assert.equal(detents.find((detent) => detent.id === "default").value, 800);

  const narrowScreen = widthDetents(620, { min: 480, max: 650 });
  assert.deepEqual(narrowScreen.map((detent) => [detent.id, detent.value]), [["min", 480], ["default", 620]]);
  for (const detent of widthDetents(560, { min: 480, max: 700 })) assert.ok(detent.value >= 480 && detent.value <= 700);
});

test("height and collapsed detents never leave their ranges", () => {
  assert.deepEqual(heightDetents(386, { min: 240, max: 500 }).map((detent) => detent.value), [240, 386, 500]);
  assert.deepEqual(collapsedDetents({ min: -60, max: 180 }).map((detent) => detent.value), [-60, 0, 60, 120, 180]);
});

test("snapping pulls a value onto the nearest detent only within the radius", () => {
  const detents = widthDetents(800, width);
  assert.deepEqual(snap(806, detents), { value: 800, detent: "default" });
  assert.deepEqual(snap(815, detents), { value: 815, detent: null });
  assert.deepEqual(snap(645, detents), { value: 640, detent: "compact" });
});

test("presets snap both sides at once and fit small screens", () => {
  const presets = panelPresets({ width: 800, height: 386 }, width, height);
  assert.deepEqual(presets.map((preset) => preset.id), ["compact", "default", "large"]);
  assert.equal(snapPreset(1050, 548, presets)?.id, "large");
  assert.equal(snapPreset(1100, 548, presets), null);

  const small = panelPresets({ width: 800, height: 386 }, { min: 480, max: 700 }, { min: 240, max: 420 });
  assert.deepEqual(small.find((preset) => preset.id === "large"), { id: "large", width: 700, height: 420 });
  assert.deepEqual(small.find((preset) => preset.id === "default"), { id: "default", width: 700, height: 386 });
});

test("panel zones keep the grab, the knobs and the edges apart", () => {
  const at = (x, y, flipped = false) => zoneAt(x, y, 800, 400, true, flipped);
  assert.deepEqual(at(400, 390), { near: ["grab"], edge: null });
  assert.equal(at(400, 396).edge, null, "the bottom edge leaves the middle to the grab");
  assert.equal(at(200, 396).edge, "b");
  assert.equal(at(4, 200).edge, "l");
  assert.equal(at(796, 200).edge, "r");
  assert.equal(at(4, 390).edge, null, "the corner belongs to the knob, not the side edge");
  assert.ok(at(20, 380).near.includes("knob-l"));
  assert.ok(at(780, 380).near.includes("knob-r"));
  assert.deepEqual(at(400, 200), { near: [], edge: null }, "the middle of the panel is never a resize zone");
  assert.equal(at(200, 4, true).edge, "b", "a bottom-docked panel grows from its top");
  assert.deepEqual(at(400, 380, true), { near: [], edge: null });
});

test("bar zones only offer the two ends", () => {
  const at = (x) => zoneAt(x, 19, 340, 38, false, false);
  assert.deepEqual(at(20), { near: ["cap-l"], edge: null });
  assert.deepEqual(at(4), { near: ["cap-l"], edge: "l" });
  assert.deepEqual(at(336), { near: ["cap-r"], edge: "r" });
  assert.deepEqual(at(170), { near: [], edge: null });
  assert.deepEqual(zoneAt(170, 80, 340, 38, false, false), { near: [], edge: null });
});
