import assert from "node:assert/strict";
import test from "node:test";
import { resolveGlassStatus } from "../../src/windows/island/glassStatus.ts";

const base = { enabled: true, choice: "native", transparencyOff: false, live: { state: "live" }, wallpaper: "ready" };

test("live windows fall back to the wallpaper, then to the CSS glass, keeping why", () => {
  assert.deepEqual(resolveGlassStatus(base), { backdrop: "live" });
  assert.deepEqual(resolveGlassStatus({ ...base, live: { state: "starting" } }), { backdrop: "live" });
  const failed = { ...base, live: { state: "failed", reason: "remote" } };
  assert.deepEqual(resolveGlassStatus(failed), { backdrop: "wallpaper", reason: "remote" });
  assert.deepEqual(resolveGlassStatus({ ...failed, wallpaper: "loading" }), { backdrop: "wallpaper", reason: "remote" });
  assert.deepEqual(resolveGlassStatus({ ...failed, wallpaper: "unavailable" }), { backdrop: "css", reason: "remote" });
});

test("transparency effects off go straight to the CSS glass, whatever was chosen", () => {
  assert.deepEqual(resolveGlassStatus({ ...base, transparencyOff: true }), { backdrop: "css", reason: "transparency-off" });
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "wallpaper", transparencyOff: true }), { backdrop: "css", reason: "transparency-off" });
});

test("the wallpaper and none choices carry no reason unless the wallpaper fails, and off is off", () => {
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "wallpaper", live: { state: "failed", reason: "failed" } }), { backdrop: "wallpaper" });
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "wallpaper", wallpaper: "unavailable" }), { backdrop: "css", reason: "no-wallpaper" });
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "none", live: { state: "failed", reason: "failed" } }), { backdrop: "css" });
  assert.deepEqual(resolveGlassStatus({ ...base, enabled: false, transparencyOff: true }), { backdrop: "off" });
});
