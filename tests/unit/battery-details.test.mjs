import assert from "node:assert/strict";
import test from "node:test";
import {
  appendBatterySample,
  batteryChipText,
  DEFAULT_BATTERY_PREFS,
  formatBatteryDuration,
  formatCompactDuration,
  formatWattHours,
  formatWatts,
  normalizeBatteryHistory,
  normalizeBatteryPrefs,
} from "../../src/features/system-widgets/batteryPrefs.ts";

test("battery prefs default to showing curve and percentage chip", () => {
  assert.deepEqual(normalizeBatteryPrefs(null), DEFAULT_BATTERY_PREFS);
  assert.deepEqual(normalizeBatteryPrefs({ showCurve: false, collapsedMode: "time" }), {
    showCurve: false,
    collapsedMode: "time",
  });
  assert.deepEqual(normalizeBatteryPrefs({ collapsedMode: "other" }), DEFAULT_BATTERY_PREFS);
});

test("battery history deduplicates rapid unchanged points and trims stale entries", () => {
  const now = 1_700_000_000_000;
  const first = appendBatterySample([], { at: now - 10_000, level: 80, pluggedIn: false });
  const sameSoon = appendBatterySample(first, { at: now - 5_000, level: 80, pluggedIn: false });
  assert.equal(sameSoon.length, 1);
  const dropped = appendBatterySample(sameSoon, { at: now, level: 79, pluggedIn: false });
  assert.equal(dropped.length, 2);
  const cleaned = normalizeBatteryHistory([
    { at: now - 25 * 3600_000, level: 50, pluggedIn: false },
    { at: now - 1000, level: 79, pluggedIn: false },
    { at: now, level: 120, pluggedIn: false },
  ], now);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].level, 79);
});

test("battery formatting and chip text handle percent, duration, watts and fallback", () => {
  assert.equal(formatBatteryDuration(45, true), "45 分钟");
  assert.equal(formatBatteryDuration(135, true), "2 小时 15 分");
  assert.equal(formatBatteryDuration(120, false), "2h");
  assert.equal(formatCompactDuration(125), "2h05");
  assert.equal(formatWattHours(52_840), "52.8 Wh");
  assert.equal(formatWatts(-12_400), "−12.4 W");
  assert.equal(formatWatts(38_500), "+38.5 W");
  assert.equal(batteryChipText({ level: 84, pluggedIn: false, remainingMinutes: 195 }, "percent"), "84%");
  assert.equal(batteryChipText({ level: 84, pluggedIn: false, remainingMinutes: 195 }, "time"), "3h15");
  assert.equal(batteryChipText({ level: 84, pluggedIn: true, timeToFullMinutes: 40 }, "time"), "40m");
  assert.equal(batteryChipText({ level: 100, pluggedIn: true, timeToFullMinutes: null }, "time"), "100%");
});
