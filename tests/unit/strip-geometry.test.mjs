import assert from "node:assert/strict";
import test from "node:test";
import { cellsToPx, itemBoxPx } from "../../src/lib/settings/customPanels.ts";
import { FUYU_ISLAND_SIZE, stripRoom } from "../../src/windows/island/custom-panels/panelSize.ts";
import { MAX_CELL_SCALE, MIN_CELL_SCALE, STRIP_STEP_PX, stripGeometry } from "../../src/windows/island/custom-panels/stripGeometry.ts";

const panel = (sizes, mode = "grid") => ({
  id: "fuyu",
  name: "",
  icon: "layout-grid",
  mode,
  items: sizes.map((size, index) => ({ widget: `w${index}`, size, x: 0, y: 0, w: 0, h: 0 })),
});

test("the default Fuyu island has room for six columns and two rows at full size", () => {
  const room = stripRoom(FUYU_ISLAND_SIZE);
  assert.deepEqual(room, { width: cellsToPx(6), height: cellsToPx(2) + 2 });
  const strip = stripGeometry(panel(["l", "m", "m", "s", "s"]), room, false);
  assert.equal(strip.scale, 1);
  assert.equal(strip.pageColumns, 6);
  assert.equal(strip.pages, 1);
  assert.equal(strip.width, cellsToPx(6));
});

test("widgets past six columns go to a second page and none straddles the page edge", () => {
  const strip = stripGeometry(panel(["m", "m", "m", "m", "w", "m"]), stripRoom(FUYU_ISLAND_SIZE), false);
  assert.equal(strip.pages, 2);
  assert.equal(strip.pageStepPx, 6 * STRIP_STEP_PX);
  assert.equal(strip.width, cellsToPx(12));
  const pageOf = (widget) => {
    const box = itemBoxPx(strip.panel, strip.panel.items.find((item) => item.widget === widget));
    assert.ok(Math.floor(box.left / strip.pageStepPx) === Math.floor((box.left + box.width - 1) / strip.pageStepPx), `${widget} stays on one page`);
    return Math.floor(box.left / strip.pageStepPx);
  };
  assert.deepEqual(["w0", "w1", "w2", "w3", "w4", "w5"].map(pageOf), [0, 0, 0, 0, 1, 0]);
});

test("a wider island shows more columns per page at full size", () => {
  const wide = stripGeometry(panel(["m"]), stripRoom({ width: 1100, height: FUYU_ISLAND_SIZE.height }), false);
  assert.equal(wide.pageColumns, 8);
  assert.equal(wide.rows, 2);
  assert.equal(wide.scale, 1);
});

test("a narrow tall panel trades columns for rows instead of shrinking the whole board", () => {
  const narrow = stripGeometry(panel(["l", "m", "m", "m", "s", "s"]), { width: 500, height: 400 }, false);
  assert.equal(narrow.pageColumns, 4);
  assert.equal(narrow.rows, 3);
  assert.ok(narrow.scale > 0.95 && narrow.scale <= 1, `cells stay near full size (${narrow.scale})`);
  assert.equal(narrow.height, cellsToPx(3));
  assert.ok(narrow.panel.items.every((item) => itemBoxPx(narrow.panel, item).top + itemBoxPx(narrow.panel, item).height <= narrow.height), "nothing hangs below the board");
});

test("cells never stretch past 1.2 or shrink under 0.85 when another column or row would fit", () => {
  for (const width of [300, 420, 560, 700, 860, 1000, 1300]) {
    for (const height of [140, 260, 330, 400, 520, 700]) {
      const strip = stripGeometry(panel(["m", "s"]), { width, height }, false);
      assert.ok(strip.scale <= MAX_CELL_SCALE, `${width}x${height} scale ${strip.scale}`);
      assert.ok(strip.scale >= MIN_CELL_SCALE || strip.pageColumns === 2 || strip.rows === 1, `${width}x${height} scale ${strip.scale}`);
      assert.ok(cellsToPx(strip.pageColumns) * strip.scale <= width + 1e-6 && (strip.height + 2) * strip.scale <= height + 1e-6, `${width}x${height} fits`);
    }
  }
});

test("a panel too short for a 2x2 widget keeps two rows and shrinks rather than cutting it", () => {
  const strip = stripGeometry(panel(["l", "s"]), { width: 760, height: 160 }, false);
  assert.equal(strip.rows, 2);
  assert.ok(strip.scale < MIN_CELL_SCALE && Math.abs(strip.scale - 160 / (cellsToPx(2) + 2)) < 1e-9);
});

test("a free panel is not paged and leaves one column to drag into", () => {
  const items = panel(["m"], "free");
  items.items[0] = { ...items.items[0], x: 0, y: 0, w: 31, h: 15 };
  const room = stripRoom(FUYU_ISLAND_SIZE);
  assert.equal(stripGeometry(items, room, false).pages, 0);
  assert.equal(stripGeometry(items, room, false).width, room.width);
  items.items[0] = { ...items.items[0], x: 80 };
  assert.equal(stripGeometry(items, room, true).width, (80 + 31) * 8 + STRIP_STEP_PX);
});
