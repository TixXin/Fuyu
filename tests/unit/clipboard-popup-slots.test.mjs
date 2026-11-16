import assert from "node:assert/strict";
import test from "node:test";
import { popupSlotOffsets, skippedHeight } from "../../src/features/clipboard/popupSlots.ts";
import { visibleSlots } from "../../src/features/clipboard/virtualRows.ts";

const sizes = { row: 44, section: 21, divider: 9, gap: 1 };

test("popup slot offsets add the pinned heading, the divider and day headings", () => {
  const headings = new Set([0, 3]);
  const offsets = popupSlotOffsets(5, 2, (index) => headings.has(index), sizes);
  assert.deepEqual(offsets, [0, 67, 112, 167, 234, 279]);
});

test("popup slot offsets without pins or headings are plain rows", () => {
  assert.deepEqual(popupSlotOffsets(3, 0, () => false, sizes), [0, 45, 90, 135]);
  assert.deepEqual(popupSlotOffsets(0, 0, () => false, sizes), [0]);
});

test("skipped rows become one spacer that keeps the scroll height", () => {
  const offsets = popupSlotOffsets(10, 0, () => false, sizes);
  assert.equal(skippedHeight(offsets, 2, 5, 1), 134);
  assert.equal(skippedHeight(offsets, 5, 5, 1), 0);
});

test("visible slots follow variable heights", () => {
  const offsets = popupSlotOffsets(500, 0, () => false, sizes);
  assert.deepEqual(visibleSlots(offsets, 0, 450, 2), { start: 0, end: 13 });
  assert.deepEqual(visibleSlots(offsets, 45 * 100, 450, 2), { start: 98, end: 113 });
  assert.deepEqual(visibleSlots(offsets, 45 * 498, 450, 2), { start: 496, end: 500 });
  assert.deepEqual(visibleSlots([0], 0, 450, 2), { start: 0, end: 0 });
  const mixed = popupSlotOffsets(4, 0, (index) => index === 2, sizes);
  assert.deepEqual(visibleSlots(mixed, 95, 10, 0), { start: 2, end: 3 });
});
