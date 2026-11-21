import assert from "node:assert/strict";
import test from "node:test";
import { advanceHoverSpring, hoverNearness, islandHoverShape } from "../../src/lib/theme/islandHover.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";

test("the hover effect defaults to bouncing on touch, and users who turned the open motion off keep a still island", () => {
  assert.equal(normalizeSettings({}).islandHover, "bounce");
  assert.equal(normalizeSettings({ islandHover: "wobble" }).islandHover, "bounce");
  assert.equal(normalizeSettings({ islandHover: "near" }).islandHover, "near");
  assert.equal(normalizeSettings({ islandMotion: "none" }).islandHover, "none");
  assert.equal(normalizeSettings({ islandMotion: "none", islandHover: "bold" }).islandHover, "bold");
  assert.equal(normalizeSettings({ islandHover: "touch" }).islandHover, "touch");
});

test("swell nearby grows as the pointer approaches; on touch only grows on the island", () => {
  const near = islandHoverShape("near");
  const touch = islandHoverShape("touch");
  assert.ok(near && touch);
  assert.equal(islandHoverShape("none"), null);
  assert.equal(hoverNearness(0, near.range), 1);
  assert.ok(hoverNearness(near.range / 2, near.range) > 0);
  assert.equal(hoverNearness(near.range, near.range), 0);
  assert.equal(hoverNearness(0, touch.range), 1);
  assert.equal(hoverNearness(1, touch.range), 0);
});

test("bounce on touch grows only on the island, overshoots a little and settles within half a second", () => {
  const bounce = islandHoverShape("bounce");
  assert.ok(bounce);
  assert.equal(hoverNearness(1, bounce.range), 0);
  const spring = { value: 0, velocity: 0 };
  let peak = 0;
  for (let i = 0; i < 30; i++) {
    advanceHoverSpring(spring, 1, 1 / 60, bounce.response, bounce.damping);
    peak = Math.max(peak, spring.value);
  }
  assert.ok(peak > 1.05 && peak < 1.25, String(peak));
  assert.ok(Math.abs(spring.value - 1) < 0.03, String(spring.value));
});

test("bounce strength changes how far bounce on touch overshoots and leaves the other hover effects as they were", () => {
  const peakOf = (shape) => {
    const spring = { value: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      advanceHoverSpring(spring, 1, 1 / 60, shape.response, shape.damping);
      peak = Math.max(peak, spring.value);
    }
    return peak;
  };
  const subtle = peakOf(islandHoverShape("bounce", "subtle"));
  const regular = peakOf(islandHoverShape("bounce", "regular"));
  const bouncy = peakOf(islandHoverShape("bounce", "bouncy"));
  assert.ok(subtle > 1 && subtle < regular && regular < bouncy && bouncy < 1.35, `${subtle} ${regular} ${bouncy}`);
  assert.equal(islandHoverShape("bounce"), islandHoverShape("bounce", "regular"));
  assert.equal(islandHoverShape("bounce", "bouncy"), islandHoverShape("bounce", "bouncy"));
  for (const hover of ["near", "subtle", "bold", "drop", "touch"]) assert.deepEqual(islandHoverShape(hover, "bouncy"), islandHoverShape(hover));
  assert.equal(islandHoverShape("none", "bouncy"), null);
});

test("the default critically damped hover never overshoots", () => {
  const near = islandHoverShape("near");
  const spring = { value: 0, velocity: 0 };
  for (let i = 0; i < 120; i++) {
    advanceHoverSpring(spring, 1, 1 / 60, near.response, near.damping);
    assert.ok(spring.value <= 1.0001);
  }
});
