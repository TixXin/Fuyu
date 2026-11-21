import assert from "node:assert/strict";
import test from "node:test";
import { addPanelItem, itemBoxPx } from "../../src/lib/settings/customPanels.ts";
import { draggedTo, dropIncoming, keptInside } from "../../src/windows/island/custom-panels/boardDrag.ts";

const board = { width: 1400, height: 248 };
const grid = (...widgets) => widgets.reduce((panel, widget) => addPanelItem(panel, widget, "s"), { id: "fuyu", name: "", icon: "layout", mode: "grid", items: [] });
const order = (panel) => panel.items.map((item) => item.widget);
const centre = (panel, widget) => {
  const box = itemBoxPx(panel, panel.items.find((item) => item.widget === widget));
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

test("in a grid strip a widget dragged past the last one moves to the end", () => {
  const panel = grid("a", "b", "c");
  const from = centre(panel, "a");
  const to = centre(panel, "c");
  const next = draggedTo(panel, { widget: "a", kind: "move", dx: to.x - from.x + 20, dy: 0 }, board);
  assert.deepEqual(order(next), ["b", "c", "a"]);
});

test("in a grid strip a widget dropped on the left half of another goes before it", () => {
  const panel = grid("a", "b", "c");
  const from = centre(panel, "c");
  const to = centre(panel, "a");
  const next = draggedTo(panel, { widget: "c", kind: "move", dx: to.x - from.x - 20, dy: 0 }, board);
  assert.deepEqual(order(next), ["c", "a", "b"]);
});

test("stretching in a grid strip does not reorder or resize", () => {
  const panel = grid("a", "b");
  assert.equal(draggedTo(panel, { widget: "a", kind: "stretch", dx: 300, dy: 0 }, board), panel);
});

test("a widget dropped in from the picker lands where it was let go", () => {
  const panel = grid("a", "b");
  const at = centre(panel, "a");
  const next = dropIncoming(panel, { widget: "n", name: "N", size: "s", x: at.x - 20, y: at.y }, board);
  assert.deepEqual(order(next), ["n", "a", "b"]);
});

test("a widget already on the panel is not added twice", () => {
  const panel = grid("a", "b");
  assert.equal(dropIncoming(panel, { widget: "a", name: "A", size: "s", x: 0, y: 0 }, board), panel);
});

test("in a free strip a dropped widget is centred on the pointer", () => {
  const panel = { ...grid(), mode: "free" };
  const next = dropIncoming(panel, { widget: "n", name: "N", size: "s", x: 400, y: 100 }, board);
  const box = itemBoxPx(next, next.items[0]);
  assert.ok(Math.abs(box.left + box.width / 2 - 400) <= 8 && Math.abs(box.top + box.height / 2 - 100) <= 8, JSON.stringify(box));
});

test("a drag is held inside the board", () => {
  const panel = grid("a");
  const box = itemBoxPx(panel, panel.items[0]);
  const held = keptInside(panel, { widget: "a", kind: "move", dx: -500, dy: 900 }, board);
  assert.deepEqual([held.dx, held.dy], [-box.left, board.height - box.top - box.height]);
});
