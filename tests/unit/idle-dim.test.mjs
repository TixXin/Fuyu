import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/lib/settings/settings.ts";
import { buildBackup, parseBackup } from "../../src/lib/settings-backup/backup.ts";
import { canIdleDim, effectiveIslandOpacity } from "../../src/windows/island/idleDim.ts";

const baseBlockers = {
  mode: "collapsed",
  isTucked: false,
  resizing: false,
  dragging: false,
  demoActive: false,
  hasPrompt: false,
  hasNotice: false,
  hasPreview: false,
  hasAlert: false,
  hasBanner: false,
  hasOpenPopup: false,
  hasReveal: false,
  hasAgentInterjection: false,
  hidden: false,
};

test("whole-island opacity and idle dimming default to 100% and off so upgrading users see no change", () => {
  assert.equal(DEFAULT_SETTINGS.islandOpacity, 100);
  assert.equal(DEFAULT_SETTINGS.idleDim, false);
  assert.equal(DEFAULT_SETTINGS.idleDimSeconds, 30);
  assert.equal(DEFAULT_SETTINGS.idleDimOpacity, 35);

  const legacy = normalizeSettings({ opacity: 85 });
  assert.equal(legacy.opacity, 85);
  assert.equal(legacy.islandOpacity, 100);
  assert.equal(legacy.idleDim, false);
  assert.equal(legacy.idleDimSeconds, 30);
  assert.equal(legacy.idleDimOpacity, 35);
});

test("island opacity and idle dimming values are clamped and round-trip through settings backups", () => {
  const low = normalizeSettings({ islandOpacity: 2, idleDim: true, idleDimSeconds: 0.2, idleDimOpacity: 0 });
  assert.equal(low.islandOpacity, 20);
  assert.equal(low.idleDim, true);
  assert.equal(low.idleDimSeconds, 1);
  assert.equal(low.idleDimOpacity, 5);

  const high = normalizeSettings({ islandOpacity: 140, idleDim: "yes", idleDimSeconds: 99_999, idleDimOpacity: 99 });
  assert.equal(high.islandOpacity, 100);
  assert.equal(high.idleDim, false);
  assert.equal(high.idleDimSeconds, 3_600);
  assert.equal(high.idleDimOpacity, 90);

  const saved = JSON.stringify({ islandOpacity: 78, idleDim: true, idleDimSeconds: 60, idleDimOpacity: 30 });
  const backup = buildBackup((key) => (key === "fuyu-settings" ? saved : null), new Date("2026-11-18T00:00:00Z"));
  const parsed = parseBackup(JSON.stringify(backup));
  assert.ok("keys" in parsed);
  const restored = normalizeSettings(JSON.parse(parsed.keys["fuyu-settings"]));
  assert.equal(restored.islandOpacity, 78);
  assert.equal(restored.idleDim, true);
  assert.equal(restored.idleDimSeconds, 60);
  assert.equal(restored.idleDimOpacity, 30);
});

test("idle dimming is blocked when expanded, tucked, hidden, dragging or showing any alert or popup", () => {
  assert.equal(canIdleDim(false, baseBlockers), false);
  assert.equal(canIdleDim(true, baseBlockers), true);
  assert.equal(canIdleDim(true, { ...baseBlockers, mode: "expanded" }), false);
  for (const key of [
    "isTucked",
    "resizing",
    "dragging",
    "demoActive",
    "hasPrompt",
    "hasNotice",
    "hasPreview",
    "hasAlert",
    "hasBanner",
    "hasOpenPopup",
    "hasReveal",
    "hasAgentInterjection",
    "hidden",
  ]) {
    assert.equal(canIdleDim(true, { ...baseBlockers, [key]: true }), false, key);
  }
});

test("effective island opacity applies whole-island opacity everywhere and caps dimmed opacity to normal opacity", () => {
  assert.equal(
    effectiveIslandOpacity({ islandOpacity: 100, idleDim: true, idleDimOpacity: 35 }, { mode: "collapsed", isTucked: false, isDimmed: false }),
    1,
  );
  assert.equal(
    effectiveIslandOpacity({ islandOpacity: 100, idleDim: true, idleDimOpacity: 35 }, { mode: "collapsed", isTucked: false, isDimmed: true }),
    0.35,
  );
  assert.equal(
    effectiveIslandOpacity({ islandOpacity: 80, idleDim: true, idleDimOpacity: 35 }, { mode: "expanded", isTucked: false, isDimmed: true }),
    0.8,
  );
  assert.equal(
    effectiveIslandOpacity({ islandOpacity: 80, idleDim: true, idleDimOpacity: 35 }, { mode: "collapsed", isTucked: true, isDimmed: true }),
    0.8,
  );
  assert.equal(
    effectiveIslandOpacity({ islandOpacity: 25, idleDim: true, idleDimOpacity: 60 }, { mode: "collapsed", isTucked: false, isDimmed: true }),
    0.25,
  );
});
