import assert from "node:assert/strict";
import test from "node:test";
import { draggedTo } from "../../src/windows/island/custom-panels/boardDrag.ts";
import { snapMove, snapStretch } from "../../src/windows/island/custom-panels/freeSnap.ts";

const free = (items) => ({ id: "fuyu", name: "", icon: "layout", mode: "free", items });
const box = (left, top, width = 120, height = 120) => ({ left, top, width, height });

test("a free widget lands on the dot grid when nothing is near", () => {
  const snapped = snapMove(box(37, 21), [], 800);
  assert.deepEqual([snapped.left, snapped.top, snapped.guideX, snapped.guideY], [32, 16, null, null]);
});

test("a free widget lines up with a neighbour's edge and shows a guide there", () => {
  const snapped = snapMove(box(205, 300), [box(200, 0)], 800);
  assert.equal(snapped.left, 200);
  assert.equal(snapped.guideX, 200);
});

test("a free widget dropped beside a neighbour keeps one gap from it", () => {
  const snapped = snapMove(box(325, 0), [box(200, 0)], 800);
  assert.equal(snapped.left, 328);
});

test("stretching stops one gap short of the widget below", () => {
  const snapped = snapStretch(box(0, 0, 120, 190), [box(0, 200)], 800, { width: 56, height: 56 });
  assert.equal(snapped.height, 192);
  assert.equal(snapped.guideY, 192);
});

test("a free panel as wide as the island keeps a widget dropped past the old four-column edge", () => {
  const panel = free([{ widget: "a", size: "m", x: 0, y: 0, w: 31, h: 15 }]);
  const moved = draggedTo(panel, { widget: "a", kind: "move", dx: 520, dy: 0 }, 760).items[0];
  assert.equal(moved.x * 8, 512);
});
