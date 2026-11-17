import assert from "node:assert/strict";
import test from "node:test";
import { ISLAND_MOTIONS, islandMotionTiming, islandMotionVariables } from "../../src/lib/theme/islandMotion.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/lib/settings/settings.ts";

test("every preset ends its height before the native side shrinks the window (600ms)", () => {
  for (const motion of ISLAND_MOTIONS) {
    for (const direction of ["open", "close"]) {
      const timing = islandMotionTiming(motion, direction);
      assert.ok(timing.height <= 560, `${motion} ${direction}`);
      assert.ok(timing.fadeDelay + timing.fade <= timing.height || motion === "none", `${motion} ${direction} fade`);
    }
  }
});

test("the spring is the website's top island both ways; smooth and fast close quicker without overshoot (C49)", () => {
  const open = islandMotionTiming("spring", "open");
  const close = islandMotionTiming("spring", "close");
  for (const key of ["width", "widthEase", "height", "radius", "ease"]) assert.equal(close[key], open[key], key);
  assert.equal(close.layer, 250);
  assert.ok(close.collapsedDelay >= 200);
  for (const motion of ["smooth", "fast"]) {
    const opening = islandMotionTiming(motion, "open");
    const closing = islandMotionTiming(motion, "close");
    assert.ok(closing.width < opening.width && closing.height < opening.height, motion);
    assert.ok(!/,\s*1\.\d+,/.test(closing.widthEase), motion);
  }
});

const points = (ease) => ease.slice("linear(".length, -1).split(",").map(Number);
const turns = (values) => values.slice(1, -1).filter((value, i) => (value - values[i]) * (values[i + 2] - value) < 0).length;

test("bouncy springs out, swings back a little and settles; its height bounces back without passing its end", () => {
  for (const direction of ["open", "close"]) {
    const timing = islandMotionTiming("bouncy", direction);
    const width = points(timing.widthEase);
    const peak = Math.max(...width);
    assert.ok(peak > 1.05 && peak < 1.2, `${direction} width out ${peak}`);
    const back = 1 - Math.min(...width.slice(width.indexOf(peak)));
    assert.ok(back > 0.005 && back < 0.03, `${direction} width back ${back}`);
    const height = points(timing.heightEase);
    assert.equal(Math.max(...height), 1, `${direction} height never past its end`);
    assert.ok(turns(height) >= 2, `${direction} height bounces`);
    assert.ok(1 - Math.min(...height.slice(height.indexOf(1))) <= 0.07, `${direction} height bounce`);
    assert.equal(width.at(-1), 1);
    assert.equal(height.at(-1), 1);
  }
  const close = islandMotionTiming("bouncy", "close");
  const width = points(close.widthEase);
  const deepest = width.indexOf(Math.max(...width)) / (width.length - 1) * close.width;
  assert.ok(close.collapsedDelay > deepest);
});

test("reduce motion keeps a short ease-out opening and closing without bounce (motion.md)", () => {
  const overshoots = (ease) => /^linear/.test(ease) || /,\s*1\.\d+,/.test(ease);
  for (const motion of ISLAND_MOTIONS) {
    for (const direction of ["open", "close"]) {
      const full = islandMotionTiming(motion, direction);
      const reduced = islandMotionTiming(motion, direction, true);
      for (const key of ["widthEase", "heightEase", "radiusEase", "ease"]) assert.ok(!overshoots(reduced[key]), `${motion} ${direction} ${key}`);
      for (const key of ["width", "height", "radius"]) {
        assert.ok(reduced[key] <= 240, `${motion} ${direction} ${key} ${reduced[key]}`);
        assert.ok(reduced[key] <= full[key], `${motion} ${direction} ${key} not longer`);
      }
      assert.ok(reduced.fade <= 160, `${motion} ${direction} fade`);
      assert.ok(reduced.fadeDelay >= 0 && reduced.fadeDelay + reduced.fade <= reduced.height || motion === "none", `${motion} ${direction} fade ends with the shell`);
      if (motion !== "none") assert.ok(reduced.height > 0, `${motion} ${direction} still animates`);
    }
    assert.ok(islandMotionTiming(motion, "close", true).height <= islandMotionTiming(motion, "open", true).height, `${motion} closes no slower`);
  }
  assert.equal(islandMotionVariables("bouncy", "open", true)["--island-motion-height-ease"], "cubic-bezier(0.22, 1, 0.36, 1)");
  assert.equal(islandMotionVariables("none", "open", true)["--island-motion-width"], "0ms");
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
