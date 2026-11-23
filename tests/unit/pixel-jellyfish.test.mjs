import assert from "node:assert/strict";
import test from "node:test";
import { composePixelJellyfish } from "../../src/components/jellyfish/pixel/pixelCompose.ts";
import { fitPixelGrid } from "../../src/components/jellyfish/pixel/pixelFit.ts";
import { PIXEL_GRIDS } from "../../src/components/jellyfish/pixel/pixelGrids.ts";
import { poseAt, stillPose, ticksUntilChange } from "../../src/components/jellyfish/pixel/pixelPoses.ts";
import { PIXEL_STYLES } from "../../src/components/jellyfish/pixel/pixelStyles.ts";
import { parseRgb, pixelTones } from "../../src/components/jellyfish/pixel/pixelTones.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";
import { JELLYFISH_STYLES } from "../../src/lib/settings/settingsLimits.ts";

const MOODS = ["idle", "running", "waiting", "failed", "done", "sleep", "stale", "compacting"];
const FILL = [246, 227, 211];
const rows = (style) => PIXEL_STYLES[style].grids.map((key) => PIXEL_GRIDS[key].height);
const alphaAt = (buffer, x, y) => buffer.data[(y * buffer.width + x) * 4 + 3];

test("every pixel style is a setting value and the setting falls back to the smooth jellyfish", () => {
  assert.deepEqual([...JELLYFISH_STYLES].sort(), ["vector", ...Object.keys(PIXEL_STYLES)].sort());
  assert.equal(normalizeSettings({}).jellyfishStyle, "vector");
  assert.equal(normalizeSettings({ jellyfishStyle: "neon" }).jellyfishStyle, "neon");
  assert.equal(normalizeSettings({ jellyfishStyle: "blurry" }).jellyfishStyle, "vector");
});

test("a 24px jellyfish uses whole screen pixels per square at every display scale", () => {
  assert.deepEqual(fitPixelGrid(24, 1, rows("flat")), { index: 0, cell: 2 });
  assert.deepEqual(fitPixelGrid(24, 1.5, rows("flat")), { index: 0, cell: 3 });
  assert.deepEqual(fitPixelGrid(24, 2, rows("flat")), { index: 0, cell: 4 });
  assert.deepEqual(fitPixelGrid(24, 1, rows("chunky")), { index: 0, cell: 3 });
  assert.deepEqual(fitPixelGrid(24, 1, rows("fine")), { index: 0, cell: 1 });
});

test("at 125% and 175% scaling the jellyfish comes out smaller, never bigger than its slot", () => {
  for (const scale of [1.25, 1.75]) {
    const fit = fitPixelGrid(24, scale, rows("flat"));
    const drawn = fit.cell * rows("flat")[fit.index];
    assert.equal(fit.index, 0);
    assert.ok(drawn <= 24 * scale, `${scale}: ${drawn} device px in a ${24 * scale} px slot`);
    assert.ok(drawn >= 24 * scale * 0.74, `${scale}: ${drawn} is too small`);
  }
});

test("sizes that do not divide evenly stay close to the slot, and a slot too small for a grid uses a coarser one", () => {
  for (const [height, style, expected] of [[22, "flat", 24], [20, "flat", 24], [16, "flat", 12], [46, "flat", 48], [40, "flat", 36], [16, "chunky", 16], [46, "fine", 48]]) {
    const fit = fitPixelGrid(height, 1, rows(style));
    assert.equal(fit.cell * rows(style)[fit.index], expected, `${style} at ${height}px`);
  }
  assert.deepEqual(fitPixelGrid(16, 1, rows("fine")), { index: 1, cell: 1 });
});

test("the idle body is mirror-symmetric on every grid", () => {
  for (const grid of Object.values(PIXEL_GRIDS)) {
    const buffer = composePixelJellyfish(grid, "mono", { ...stillPose("idle"), eyes: "open" }, pixelTones("mono", FILL, false, false));
    for (let y = 0; y < buffer.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const left = alphaAt(buffer, buffer.originX + x, y);
        const right = alphaAt(buffer, buffer.originX + grid.width - 1 - x, y);
        assert.equal(left, right, `${grid.key} row ${y} column ${x}`);
      }
    }
  }
});

test("nothing is cut off at the canvas edge in any style, mood or frame", () => {
  for (const [style, spec] of Object.entries(PIXEL_STYLES)) {
    for (const key of spec.grids) {
      const grid = PIXEL_GRIDS[key];
      for (const mood of MOODS) {
        for (let tick = 0; tick < 100; tick += 1) {
          const buffer = composePixelJellyfish(grid, spec.paint, poseAt(mood, tick), pixelTones(spec.paint, FILL, false, false));
          for (let x = 0; x < buffer.width; x += 1) {
            assert.equal(alphaAt(buffer, x, 0) + alphaAt(buffer, x, buffer.height - 1), 0, `${style} ${key} ${mood} tick ${tick} column ${x}`);
          }
          for (let y = 0; y < buffer.height; y += 1) {
            assert.equal(alphaAt(buffer, 0, y) + alphaAt(buffer, buffer.width - 1, y), 0, `${style} ${key} ${mood} tick ${tick} row ${y}`);
          }
        }
      }
    }
  }
});

test("the one-colour style cuts the eyes out and the others paint them", () => {
  const grid = PIXEL_GRIDS.M;
  const eyeX = grid.pad.left + grid.eye[0];
  const eyeY = grid.pad.top + grid.eye[1];
  const mono = composePixelJellyfish(grid, "mono", stillPose("idle"), pixelTones("mono", FILL, false, false));
  const flat = composePixelJellyfish(grid, "flat", stillPose("idle"), pixelTones("flat", FILL, false, false));
  assert.equal(alphaAt(mono, eyeX, eyeY), 0);
  assert.equal(alphaAt(flat, eyeX, eyeY), 255);
  assert.deepEqual([...flat.data.slice((eyeY * flat.width + eyeX) * 4, (eyeY * flat.width + eyeX) * 4 + 3)], [29, 27, 34]);
});

test("failed, done and stale play once and then stop asking for frames", () => {
  for (const mood of ["failed", "done", "stale"]) {
    let tick = 0;
    let steps = 0;
    while (Number.isFinite(ticksUntilChange(mood, tick)) && steps < 50) {
      tick += ticksUntilChange(mood, tick);
      steps += 1;
    }
    assert.ok(steps > 0 && steps < 50, `${mood} settles`);
    assert.deepEqual(poseAt(mood, tick), poseAt(mood, tick + 500));
    assert.deepEqual(stillPose(mood), poseAt(mood, tick));
  }
});

test("an idle jellyfish sleeps for seconds between frames while running, waiting and compacting keep moving", () => {
  assert.ok(ticksUntilChange("idle", 0) >= 40, `idle woke after ${ticksUntilChange("idle", 0)} ticks`);
  assert.ok(ticksUntilChange("sleep", 0) >= 20);
  for (const mood of ["running", "waiting", "compacting"]) {
    for (let tick = 0; tick < 40; tick += 1) assert.ok(ticksUntilChange(mood, tick) <= 12, `${mood} tick ${tick}`);
  }
});

test("squeezing makes the head taller, then flatter, and the arrows press in from both sides", () => {
  const tones = pixelTones("flat", FILL, false, false);
  const top = (buffer) => {
    for (let y = 0; y < buffer.height; y += 1) for (let x = 0; x < buffer.width; x += 1) if (alphaAt(buffer, x, y) === 255) return y;
    return -1;
  };
  for (const grid of Object.values(PIXEL_GRIDS)) {
    const rest = top(composePixelJellyfish(grid, "flat", stillPose("idle"), tones));
    const tall = composePixelJellyfish(grid, "flat", poseAt("compacting", 0), tones);
    const flat = composePixelJellyfish(grid, "flat", poseAt("compacting", 6), tones);
    assert.ok(top(tall) < rest, `${grid.key} stretches up`);
    assert.ok(top(flat) > rest, `${grid.key} squashes down`);
    assert.equal(top(composePixelJellyfish(grid, "flat", poseAt("compacting", 3), tones)), rest, `${grid.key} comes back`);
    const row = grid.pad.top + grid.press.y;
    const left = grid.pad.left + grid.press.x;
    const right = grid.pad.left + grid.width - 1 - grid.press.x;
    assert.ok(alphaAt(tall, left, row) > 0 && alphaAt(tall, right, row) > 0, `${grid.key} arrows on both sides`);
    assert.equal(alphaAt(flat, left, row) + alphaAt(flat, right, row), 0, `${grid.key} arrows gone`);
  }
});

test("still frames rest on the baseline", () => {
  for (const mood of MOODS) {
    const pose = stillPose(mood);
    assert.equal(pose.dy, 0, mood);
    assert.equal(pose.dx, 0, mood);
  }
});

test("computed colours parse to channels", () => {
  assert.deepEqual(parseRgb("rgb(109, 182, 244)"), [109, 182, 244]);
  assert.deepEqual(parseRgb("rgba(255, 205, 60, 0.5)"), [255, 205, 60]);
  assert.equal(parseRgb("transparent"), null);
});
