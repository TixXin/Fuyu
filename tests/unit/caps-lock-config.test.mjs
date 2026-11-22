import assert from "node:assert/strict";
import test from "node:test";
import { readCapsLockConfig, shouldFlash, showsBadge } from "../../src/features/caps-lock/capsLockConfig.ts";

const DEFAULTS = { mode: "both", offAlert: true, badgeClick: true };

test("a missing or broken caps-lock config falls back to flash + badge with both switches on", () => {
  assert.deepEqual(readCapsLockConfig({}), DEFAULTS);
  assert.deepEqual(readCapsLockConfig({ mode: "loud", offAlert: "no", badgeClick: 1 }), DEFAULTS);
  assert.deepEqual(readCapsLockConfig({ mode: "badge", offAlert: false, badgeClick: false }), { mode: "badge", offAlert: false, badgeClick: false });
});

test("a change made while asleep never flashes, only the key does", () => {
  assert.equal(shouldFlash({ on: true, source: "wake" }, DEFAULTS), false);
  assert.equal(shouldFlash({ on: true, source: "key" }, DEFAULTS), true);
});

test("turning Caps Lock off flashes only when asked to, and badge-only mode never flashes", () => {
  assert.equal(shouldFlash({ on: false, source: "key" }, DEFAULTS), true);
  assert.equal(shouldFlash({ on: false, source: "key" }, { ...DEFAULTS, offAlert: false }), false);
  assert.equal(shouldFlash({ on: true, source: "key" }, { ...DEFAULTS, mode: "badge" }), false);
});

test("the badge shows only while Caps Lock is on and the mode keeps a badge", () => {
  assert.equal(showsBadge(true, DEFAULTS), true);
  assert.equal(showsBadge(false, DEFAULTS), false);
  assert.equal(showsBadge(true, { ...DEFAULTS, mode: "flash" }), false);
  assert.equal(showsBadge(true, { ...DEFAULTS, mode: "badge" }), true);
});
