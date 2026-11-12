import assert from "node:assert/strict";
import test from "node:test";
import { ISLAND_MOTIONS, islandMotionTiming, islandMotionVariables } from "../../src/features/appearance/islandMotion.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/features/appearance/settings.ts";

test("every preset ends its height before the native side shrinks the window (600ms)", () => {
  for (const motion of ISLAND_MOTIONS) {
    for (const direction of ["open", "close"]) {
      const timing = islandMotionTiming(motion, direction);
      assert.ok(timing.height <= 560, `${motion} ${direction}`);
      assert.ok(timing.fadeDelay + timing.fade <= timing.height || motion === "none", `${motion} ${direction} fade`);
    }
  }
});

test("the spring is the website's top island both ways; the others close quicker without overshoot (C49)", () => {
  const open = islandMotionTiming("spring", "open");
  const close = islandMotionTiming("spring", "close");
  for (const key of ["width", "widthEase", "height", "radius", "ease"]) assert.equal(close[key], open[key], key);
  // The website's menu fades out in 250ms; its bar comes back as the panel has gone.
  assert.equal(close.layer, 250);
  assert.ok(close.collapsedDelay >= 200);
  for (const motion of ["smooth", "fast", "bouncy"]) {
    const opening = islandMotionTiming(motion, "open");
    const closing = islandMotionTiming(motion, "close");
    assert.ok(closing.width < opening.width && closing.height < opening.height, motion);
    // An overshooting curve has a control point above 1.
    assert.ok(!/,\s*1\.\d+,/.test(closing.widthEase), motion);
  }
});

test("reduce motion takes the bounce out, not the animation", () => {
  for (const motion of ["spring", "bouncy"]) {
    assert.match(islandMotionTiming(motion, "open").widthEase, /,\s*1\.\d+,/);
    const reduced = islandMotionTiming(motion, "open", true);
    assert.doesNotMatch(reduced.widthEase, /,\s*1\.\d+,/);
    assert.equal(reduced.width, islandMotionTiming(motion, "open").width);
  }
  assert.equal(islandMotionVariables("none", "open")["--island-motion-width"], "0ms");
  assert.equal(islandMotionVariables("none", "close")["--island-motion-layer"], "0ms");
});

test("the spring opening is what the island did before the setting", () => {
  const variables = islandMotionVariables("spring", "open");
  assert.equal(variables["--island-motion-width"], "550ms");
  assert.equal(variables["--island-motion-width-ease"], "cubic-bezier(0.34, 1.36, 0.5, 1)");
  assert.equal(variables["--island-motion-height"], "500ms");
  assert.equal(variables["--island-motion-fade-delay"], "120ms");
  assert.equal(variables["--island-motion-layer"], "120ms");
});

test("saved settings without the field, or with an unknown one, open with the spring", () => {
  assert.equal(DEFAULT_SETTINGS.islandMotion, "spring");
  assert.equal(normalizeSettings({}).islandMotion, "spring");
  assert.equal(normalizeSettings({ islandMotion: "wobble" }).islandMotion, "spring");
  assert.equal(normalizeSettings({ islandMotion: "fast" }).islandMotion, "fast");
});
