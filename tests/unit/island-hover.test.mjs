import assert from "node:assert/strict";
import test from "node:test";
import { hoverNearness, islandHoverShape } from "../../src/lib/theme/islandHover.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";

test("the hover effect defaults to swelling nearby, and users who turned the open motion off keep a still island", () => {
  assert.equal(normalizeSettings({}).islandHover, "near");
  assert.equal(normalizeSettings({ islandHover: "wobble" }).islandHover, "near");
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
