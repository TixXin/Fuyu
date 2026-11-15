import assert from "node:assert/strict";
import test from "node:test";
import { layoutSideColumn, sideBubbleTop, SIDE_COLUMN_MAX_HEIGHT } from "../../src/windows/island/sideColumn.ts";

const rows = (count, height = 28) => Array.from({ length: count }, (_, index) => ({ id: `row-${index}`, height }));

test("a short column fits every row and grows with them", () => {
  assert.deepEqual(layoutSideColumn(rows(1)), { shown: rows(1), hidden: 0, height: 48, offsets: [10] });
  const three = layoutSideColumn(rows(3));
  assert.equal(three.height, 116);
  assert.deepEqual(three.offsets, [10, 44, 78]);
  assert.equal(three.hidden, 0);
});

test("an empty column still keeps one row of height", () => {
  assert.equal(layoutSideColumn([]).height, 48);
});

test("rows that do not fit fold into a +N row and the column stays under the cap", () => {
  const layout = layoutSideColumn(rows(12));
  assert.ok(layout.height <= SIDE_COLUMN_MAX_HEIGHT);
  assert.equal(layout.shown.length + layout.hidden, 12);
  assert.ok(layout.hidden >= 2);
  assert.equal(layout.offsets.length, layout.shown.length + 1);
  assert.deepEqual(layout.shown, rows(12).slice(0, layout.shown.length));
});

test("a taller cover row is counted at its own height", () => {
  const layout = layoutSideColumn([{ id: "agent", height: 28 }, { id: "music", height: 40 }]);
  assert.equal(layout.height, 94);
  assert.deepEqual(layout.offsets, [10, 44]);
});

test("a bubble lines up with its row and stays on the straight part of the column", () => {
  assert.equal(sideBubbleTop(200, 100, 22), 81);
  assert.equal(sideBubbleTop(200, 24, 22), 22);
  assert.equal(sideBubbleTop(200, 190, 22), 140);
  assert.equal(sideBubbleTop(200, null, 22), 81);
  assert.equal(sideBubbleTop(48, 24, 22), 5);
});
