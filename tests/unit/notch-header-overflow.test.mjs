import assert from "node:assert/strict";
import { test } from "node:test";
import { NOTCH_MENU_MAX_HEIGHT, NOTCH_MENU_MIN_HEIGHT, notchHeaderMenuMaxHeight, splitNotchHeaderTabs } from "../../src/windows/island/notchHeaderOverflow.ts";

test("all tabs stay visible when they fit without a more button", () => {
  assert.equal(splitNotchHeaderTabs(210, [54, 28, 28, 28, 28]), 5);
  assert.equal(splitNotchHeaderTabs(174, [54, 28, 28, 28, 28]), 5);
  assert.equal(splitNotchHeaderTabs(210, []), 0);
});

test("overflow reserves room for the more trigger so visible tabs and trigger fit cleanly", () => {
  const widths = [54, 28, 28, 28, 28, 28, 28, 28, 28];
  const visible = splitNotchHeaderTabs(210, widths, 42, 2);
  assert.equal(visible, 4);
  const used = widths.slice(0, visible).reduce((a, b) => a + b, 0) + visible * 2 + 42;
  assert.ok(used <= 210);
});

test("a single narrow last tab that fits on its own is never hidden behind a wider more button", () => {
  assert.equal(splitNotchHeaderTabs(118, [28, 28, 28, 28], 42, 2), 4);
  assert.equal(splitNotchHeaderTabs(110, [28, 28, 28, 28], 42, 2), 2);
});

test("very narrow width puts every tab into the overflow menu", () => {
  assert.equal(splitNotchHeaderTabs(50, [54, 28, 28], 42, 2), 0);
});

test("overflow menu max height clamps inside short expanded panels and caps at the default height on tall panels", () => {
  assert.equal(notchHeaderMenuMaxHeight(209, 40), 161);
  assert.equal(notchHeaderMenuMaxHeight(320, 40), NOTCH_MENU_MAX_HEIGHT);
  assert.equal(notchHeaderMenuMaxHeight(80, 40), NOTCH_MENU_MIN_HEIGHT);
  assert.equal(notchHeaderMenuMaxHeight(0, 40), NOTCH_MENU_MAX_HEIGHT);
});
