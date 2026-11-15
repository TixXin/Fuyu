import assert from "node:assert/strict";
import test from "node:test";
import {
  REMOUNT_MAX_ATTEMPTS,
  REMOUNT_QUIET_MS,
  nextRemountStep,
  parseRemountAttempts,
  remountDelay,
} from "../../src/lib/devRemount.ts";

test("reload delays double from three seconds and stop at the attempt limit", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(remountDelay), [3000, 6000, 12000, 24000, 48000]);
  assert.equal(REMOUNT_MAX_ATTEMPTS, 5);
  assert.equal(remountDelay(REMOUNT_MAX_ATTEMPTS), null);
  assert.equal(remountDelay(REMOUNT_MAX_ATTEMPTS + 3), null);
});

test("stored attempt counts fall back to zero when missing or broken", () => {
  assert.equal(parseRemountAttempts(null), 0);
  assert.equal(parseRemountAttempts(""), 0);
  assert.equal(parseRemountAttempts("abc"), 0);
  assert.equal(parseRemountAttempts("-2"), 0);
  assert.equal(parseRemountAttempts("1.5"), 0);
  assert.equal(parseRemountAttempts("2"), 2);
});

test("a mounted page stops the watch", () => {
  assert.deepEqual(nextRemountStep({ mounted: true, sinceLastLoadMs: 99999 }), { kind: "stop" });
  assert.deepEqual(nextRemountStep({ mounted: true, sinceLastLoadMs: 0 }), { kind: "stop" });
});

test("an unmounted page still loading modules waits until loading goes quiet", () => {
  assert.deepEqual(nextRemountStep({ mounted: false, sinceLastLoadMs: 400 }), {
    kind: "wait",
    ms: REMOUNT_QUIET_MS - 400,
  });
});

test("an unmounted page with no recent loads reloads", () => {
  assert.deepEqual(nextRemountStep({ mounted: false, sinceLastLoadMs: REMOUNT_QUIET_MS }), { kind: "reload" });
  assert.deepEqual(nextRemountStep({ mounted: false, sinceLastLoadMs: 10000 }), { kind: "reload" });
});
