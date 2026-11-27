import assert from "node:assert/strict";
import { test } from "node:test";
import { fitHeaderTabs } from "../../src/windows/island/headerTabFit.ts";

const base = { split: 2, fullExtra: 0, compactExtra: 0, rowMin: 96, more: 42, gap: 2 };
const full = [52, 34, 34, 34, 34, 34];
const compact = [34, 34, 34, 34, 34, 34];

test("tabs keep their text while the full row fits", () => {
  assert.deepEqual(fitHeaderTabs({ ...base, available: 400, full, compact }), { compact: false, visible: 6 });
  assert.deepEqual(fitHeaderTabs({ ...base, available: 230, full, compact }), { compact: false, visible: 6 });
});

test("tabs drop their text before any of them is hidden", () => {
  assert.deepEqual(fitHeaderTabs({ ...base, available: 227, full, compact }), { compact: true, visible: 6 });
  assert.deepEqual(fitHeaderTabs({ ...base, available: 214, full, compact }), { compact: true, visible: 6 });
});

test("the title text counts as text and only fits in the full layout", () => {
  const withTitle = { ...base, fullExtra: 40, compactExtra: 0 };
  assert.deepEqual(fitHeaderTabs({ ...withTitle, available: 260, full, compact }), { compact: true, visible: 6 });
  assert.deepEqual(fitHeaderTabs({ ...withTitle, available: 270, full, compact }), { compact: false, visible: 6 });
});

test("icon tabs that still overflow leave room for the more button at the end", () => {
  const fit = fitHeaderTabs({ ...base, available: 200, full, compact });
  assert.equal(fit.compact, true);
  assert.equal(fit.visible, 4);
  const used = 34 * 2 + 2 + 34 * 2 + 2 + 2 + 42;
  assert.ok(used <= 200);
});

test("the row keeps its minimum width even when only the more button is left in it", () => {
  assert.deepEqual(fitHeaderTabs({ ...base, available: 166, full, compact }), { compact: true, visible: 3 });
  assert.deepEqual(fitHeaderTabs({ ...base, available: 165, full, compact }), { compact: true, visible: 1 });
  assert.deepEqual(fitHeaderTabs({ ...base, available: 120, full, compact }), { compact: true, visible: 0 });
});

test("an unmeasured header shows every tab", () => {
  assert.deepEqual(fitHeaderTabs({ ...base, available: 0, full, compact }), { compact: false, visible: 6 });
  assert.deepEqual(fitHeaderTabs({ ...base, available: 300, full: [], compact: [] }), { compact: false, visible: 0 });
});
