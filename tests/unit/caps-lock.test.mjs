import assert from "node:assert/strict";
import test from "node:test";
import { readCapsLockConfig, shouldFlash, shouldFlashNumLock, showsBadge } from "../../src/features/caps-lock/capsLockConfig.ts";
import { fitCollapsedZones } from "../../src/windows/island/collapsedOverflow.ts";

test("readCapsLockConfig fills defaults including C174 passwordWarn and numLock", () => {
  assert.deepEqual(readCapsLockConfig({}), {
    mode: "both",
    offAlert: true,
    badgeClick: true,
    passwordWarn: true,
    numLock: false,
  });
  assert.deepEqual(
    readCapsLockConfig({ mode: "flash", offAlert: false, badgeClick: false, passwordWarn: false, numLock: true }),
    { mode: "flash", offAlert: false, badgeClick: false, passwordWarn: false, numLock: true },
  );
});

test("shouldFlash and shouldFlashNumLock gate wake events, offAlert, and macOS", () => {
  const cfg = readCapsLockConfig({ mode: "both", offAlert: false, numLock: true });
  assert.equal(shouldFlash({ on: true, source: "key" }, cfg), true);
  assert.equal(shouldFlash({ on: false, source: "key" }, cfg), false);
  assert.equal(shouldFlash({ on: true, source: "wake" }, cfg), false);
  assert.equal(showsBadge(true, cfg), true);
  assert.equal(showsBadge(true, readCapsLockConfig({ mode: "flash" })), false);

  assert.equal(shouldFlashNumLock({ on: true, source: "key" }, cfg, false), true);
  assert.equal(shouldFlashNumLock({ on: false, source: "key" }, cfg, false), false);
  assert.equal(shouldFlashNumLock({ on: true, source: "wake" }, cfg, false), false);
  assert.equal(shouldFlashNumLock({ on: true, source: "key" }, cfg, true), false);
  assert.equal(shouldFlashNumLock({ on: true, source: "key" }, readCapsLockConfig({}), false), false);
});

test("fitCollapsedZones keeps pinned caps-lock badge out of +N overflow when wings are tight", () => {
  const fit = fitCollapsedZones(
    { widths: [40, 40, 40], capacity: 90, movable: [false, false, false] },
    { widths: [40, 40, 22], capacity: 90, movable: [false, false, false], keep: [false, false, true] },
    6,
    28,
    { auto: true, least: 1 },
  );
  assert.equal(fit.right[2], false, "caps-lock kept badge must not be shelved into +N");
  assert.equal(fit.right[1], true, "another right-wing item yields to +N instead");
});
