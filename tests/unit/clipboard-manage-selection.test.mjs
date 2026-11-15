import assert from "node:assert/strict";
import test from "node:test";
import { clickSelection, EMPTY_SELECTION, rangeIds, selectAll, visibleSelection } from "../../src/features/clipboard/manageSelection.ts";
import { deletedLabel, withoutPending } from "../../src/features/clipboard/pendingItems.ts";
import { visibleRows } from "../../src/features/clipboard/virtualRows.ts";

const order = ["a", "b", "c", "d", "e"];
const ids = (selection) => [...selection.ids].sort();

test("a plain click picks only that entry and becomes the anchor", () => {
  const picked = clickSelection(selectAll(order), order, "c", {});
  assert.deepEqual(ids(picked), ["c"]);
  assert.equal(picked.anchor, "c");
});

test("Ctrl or ⌘ click adds and removes one entry", () => {
  let selection = clickSelection(EMPTY_SELECTION, order, "b", { toggle: true });
  selection = clickSelection(selection, order, "d", { toggle: true });
  assert.deepEqual(ids(selection), ["b", "d"]);
  selection = clickSelection(selection, order, "b", { toggle: true });
  assert.deepEqual(ids(selection), ["d"]);
});

test("Shift click selects from the anchor in either direction", () => {
  const start = clickSelection(EMPTY_SELECTION, order, "b", {});
  assert.deepEqual(ids(clickSelection(start, order, "d", { shift: true })), ["b", "c", "d"]);
  assert.deepEqual(ids(clickSelection(start, order, "a", { shift: true })), ["a", "b"]);
  const toggled = clickSelection(start, order, "e", { toggle: true });
  assert.deepEqual(ids(clickSelection(toggled, order, "c", { shift: true, toggle: true })), ["b", "c", "d", "e"]);
});

test("Shift click without an anchor on screen picks just that entry", () => {
  const hidden = { ids: new Set(["zz"]), anchor: "zz" };
  assert.deepEqual(ids(clickSelection(hidden, order, "c", { shift: true })), ["c"]);
  assert.deepEqual(rangeIds(order, "zz", "c"), ["c"]);
});

test("only entries still on screen count as selected, in list order", () => {
  const selection = { ids: new Set(["e", "gone", "a"]), anchor: "a" };
  assert.deepEqual(visibleSelection(selection, order), ["a", "e"]);
  assert.deepEqual(visibleSelection(EMPTY_SELECTION, order), []);
});

test("pending deletions hide their rows and are named by count when there are several", () => {
  const item = (id, extra = {}) => ({ id, kind: "text", preview: `preview ${id}`, ...extra });
  const items = order.map((id) => item(id));
  assert.deepEqual(withoutPending(items, [items[1], items[3]]).map((entry) => entry.id), ["a", "c", "e"]);
  assert.equal(withoutPending(items, null), items);
  const text = { imageLabel: (w, h) => `image ${w}x${h}`, manage: { count: (count) => `${count} entries` } };
  assert.equal(deletedLabel([items[0], items[1]], text), "2 entries");
  assert.equal(deletedLabel([item("i", { kind: "image", image: { width: 3, height: 4 } })], text), "image 3x4");
  assert.equal(deletedLabel([item("long", { preview: "一二三四五六七八九十一二三四五六七八" })], text), "一二三四五六七八九十一二三四五六");
});

test("only the rows near the viewport are rendered", () => {
  assert.deepEqual(visibleRows(500, 46, 0, 460, 4), { start: 0, end: 14 });
  assert.deepEqual(visibleRows(500, 46, 46 * 100, 460, 4), { start: 96, end: 114 });
  assert.deepEqual(visibleRows(500, 46, 46 * 498, 460, 4), { start: 494, end: 500 });
  assert.deepEqual(visibleRows(0, 46, 0, 460, 4), { start: 0, end: 0 });
});
