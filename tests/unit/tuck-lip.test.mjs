import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TUCKED_HOVER_DELAY_MS,
  TUCK_LIP_HEIGHT_RANGE,
  TUCK_LIP_WIDTH_RANGE,
  normalizeTuckLip,
  normalizeTuckedHoverDelay,
  tuckLipHeight,
} from "../../src/lib/settings/tuckLip.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";

test("0 and bad strip values mean the preset height and the full island width", () => {
  for (const value of [0, -4, Number.NaN, Number.POSITIVE_INFINITY, "8", null, undefined]) {
    assert.equal(normalizeTuckLip(value, TUCK_LIP_HEIGHT_RANGE), 0);
    assert.equal(normalizeTuckLip(value, TUCK_LIP_WIDTH_RANGE), 0);
  }
});

test("strip values are clamped to their ranges", () => {
  assert.equal(normalizeTuckLip(1, TUCK_LIP_HEIGHT_RANGE), 2);
  assert.equal(normalizeTuckLip(7.4, TUCK_LIP_HEIGHT_RANGE), 7);
  assert.equal(normalizeTuckLip(40, TUCK_LIP_HEIGHT_RANGE), 14);
  assert.equal(normalizeTuckLip(20, TUCK_LIP_WIDTH_RANGE), 80);
  assert.equal(normalizeTuckLip(900, TUCK_LIP_WIDTH_RANGE), 340);
});

test("the strip height follows the style until the user sets one, and hidden shows nothing", () => {
  assert.equal(tuckLipHeight("edge", 0), 10);
  assert.equal(tuckLipHeight("line", 0), 4);
  assert.equal(tuckLipHeight("line", 9), 9);
  assert.equal(tuckLipHeight("hidden", 9), 0);
});

test("the hover delay defaults to 150 ms and stays within 0 to 1000 ms", () => {
  assert.equal(normalizeTuckedHoverDelay(undefined), DEFAULT_TUCKED_HOVER_DELAY_MS);
  assert.equal(normalizeTuckedHoverDelay("300"), DEFAULT_TUCKED_HOVER_DELAY_MS);
  assert.equal(normalizeTuckedHoverDelay(0), 0);
  assert.equal(normalizeTuckedHoverDelay(-50), 0);
  assert.equal(normalizeTuckedHoverDelay(5000), 1000);
});

test("settings saved before the strip options keep the old look and get the new hover delay", () => {
  const settings = normalizeSettings({ tuckStyle: "line" });
  assert.equal(settings.tuckLipHeight, 0);
  assert.equal(settings.tuckLipWidth, 0);
  assert.equal(settings.tuckedHoverDelayMs, 150);
  const custom = normalizeSettings({ tuckLipHeight: 6, tuckLipWidth: 160, tuckedHoverDelayMs: 0 });
  assert.equal(custom.tuckLipHeight, 6);
  assert.equal(custom.tuckLipWidth, 160);
  assert.equal(custom.tuckedHoverDelayMs, 0);
});
