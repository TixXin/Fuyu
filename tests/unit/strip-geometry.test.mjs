import assert from "node:assert/strict";
import test from "node:test";
import { cellsToPx, GRID_UNIT_PX, itemBoxPx, setPanelMode } from "../../src/lib/settings/customPanels.ts";
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

const freeBox = (panel, widget) => panel.items.find((item) => item.widget === widget);
const overlapping = (items) =>
  items.some((a, i) => items.slice(i + 1).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));

test("a tall panel gets as many rows as fit, leaving less than one row empty at the bottom", () => {
  const tall = stripGeometry(panel(Array(40).fill("s")), { width: 460, height: 1530 }, false);
  assert.ok(tall.rows > 6, `rows ${tall.rows}`);
  assert.ok(tall.scale >= MIN_CELL_SCALE && tall.scale <= MAX_CELL_SCALE, `scale ${tall.scale}`);
  assert.ok(1530 - (tall.height + 2) * tall.scale < STRIP_STEP_PX * tall.scale, "the bottom gap is under one row");
  const bottom = Math.max(...tall.panel.items.map((item) => itemBoxPx(tall.panel, item).top + itemBoxPx(tall.panel, item).height));
  assert.ok(bottom > cellsToPx(6), "widgets flow into the rows past the sixth");
  assert.ok(bottom <= tall.height, "and none hangs below the board");
  for (const width of [480, 760, 1200]) {
    for (const height of [600, 1000, 1530, 2400, 4242]) {
      const strip = stripGeometry(panel(["l", "m", "s"]), { width, height }, false);
      const used = (strip.height + 2) * strip.scale;
      assert.ok(used <= height + 1e-6 && height - used < STRIP_STEP_PX * strip.scale, `${width}x${height}: ${strip.rows} rows at ${strip.scale}`);
      assert.ok(strip.scale >= MIN_CELL_SCALE && strip.scale <= MAX_CELL_SCALE, `${width}x${height} scale ${strip.scale}`);
    }
  }
});

test("a few widgets on a tall panel stay together in the top rows instead of stacking down the left column", () => {
  const tall = stripGeometry(panel(Array(6).fill("s")), { width: 460, height: 1530 }, false);
  const boxes = tall.panel.items.map((item) => itemBoxPx(tall.panel, item));
  const columns = new Set(boxes.map((box) => box.left));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  assert.equal(columns.size, 3, "six one-cell widgets on a four-column page use three columns of two");
  assert.ok(bottom <= cellsToPx(2), "and stay in the top two rows");
  const pages = new Set(boxes.map((box) => Math.floor(box.left / (tall.pageStepPx))));
  assert.equal(pages.size, 1, "and on the first page");
});

test("widgets that need more than two rows fill the page row band by band without spilling onto a second page", () => {
  const tall = stripGeometry(panel(Array(14).fill("s")), { width: 460, height: 1530 }, false);
  const boxes = tall.panel.items.map((item) => itemBoxPx(tall.panel, item));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  assert.ok(right <= cellsToPx(tall.pageColumns), "fourteen one-cell widgets fit on one four-column page");
  assert.ok(bottom <= cellsToPx(4), "using four rows, not thirteen");
});

test("the default two-row strip keeps its layout", () => {
  const strip = stripGeometry(panel(["s", "s", "s"]), stripRoom(FUYU_ISLAND_SIZE), false);
  const boxes = strip.panel.items.map((item) => itemBoxPx(strip.panel, item));
  assert.deepEqual(boxes.map((box) => [box.left, box.top]), [[0, 0], [0, cellsToPx(1) + 8], [cellsToPx(1) + 8, 0]]);
});

test("a free panel uses the same rows and cell size as the grid would, and can grow past full size", () => {
  for (const room of [{ width: 460, height: 1530 }, { width: 500, height: 400 }, stripRoom(FUYU_ISLAND_SIZE), { width: 1200, height: 900 }]) {
    const grid = stripGeometry(panel(["l", "m", "s"]), room, false);
    const free = stripGeometry(panel(["l", "m", "s"], "free"), room, false);
    assert.deepEqual([free.rows, free.scale, free.height], [grid.rows, grid.scale, cellsToPx(grid.rows)], `${room.width}x${room.height}`);
  }
  const base = stripRoom(FUYU_ISLAND_SIZE);
  const bigger = stripGeometry(panel(["m"], "free"), { width: base.width * 1.1, height: base.height * 1.1 }, false);
  assert.ok(Math.abs(bigger.scale - 1.1) < 1e-9, `scale ${bigger.scale}`);
  const low = panel(["s"], "free");
  low.items[0] = { ...low.items[0], x: 0, y: 16 * 8, w: 15, h: 15 };
  const placed = stripGeometry(low, { width: 460, height: 1530 }, false);
  assert.equal(placed.panel.items[0].y, 16 * 8, "a widget far down a tall free panel stays where it was put");
});

test("switching a tall grid to free keeps every widget where it was and inside the board; switching back restores the grid", () => {
  const room = { width: 460, height: 1530 };
  const grid = stripGeometry(panel(["l", "m", "s", "s", "m", "s", "w", "s", "s", "m"]), room, true);
  const units = Math.floor(grid.height / GRID_UNIT_PX);
  const free = setPanelMode(grid.panel, "free", true, units);
  assert.equal(free.mode, "free");
  assert.deepEqual(free.items.map((item) => itemBoxPx(free, item)), grid.panel.items.map((item) => itemBoxPx(grid.panel, item)));
  const shown = stripGeometry(free, room, true);
  assert.equal(shown.height, grid.height);
  assert.ok(shown.panel.items.every((item) => item.y + item.h <= units), "inside the free board");
  const back = stripGeometry(setPanelMode(shown.panel, "grid", true), room, false);
  const cells = (strip) => strip.panel.items.map((item) => [item.widget, itemBoxPx(strip.panel, item)]);
  assert.deepEqual(cells(back), cells(stripGeometry(grid.panel, room, false)));
});

test("free widgets below a board that got shorter are brought inside without covering each other", () => {
  const free = panel(["s", "s", "m", "s"], "free");
  free.items = [
    { ...free.items[0], x: 0, y: 0, w: 15, h: 15 },
    { ...free.items[1], x: 0, y: 16 * 9, w: 15, h: 15 },
    { ...free.items[2], x: 0, y: 16 * 12, w: 31, h: 15 },
    { ...free.items[3], x: 16, y: 16, w: 15, h: 40 },
  ];
  const room = stripRoom(FUYU_ISLAND_SIZE);
  const strip = stripGeometry(free, room, false);
  const units = Math.floor(strip.height / GRID_UNIT_PX);
  assert.equal(strip.rows, 2);
  assert.ok(strip.panel.items.every((item) => item.y >= 0 && item.y + item.h <= units), "every widget is inside the two rows");
  assert.equal(overlapping(strip.panel.items), false);
  assert.deepEqual(freeBox(strip.panel, "w0"), free.items[0], "a widget already inside does not move");
  const switched = setPanelMode({ ...free, mode: "grid" }, "free", true, units);
  assert.ok(switched.items.every((item) => item.y + item.h <= units) && !overlapping(switched.items), "switching to free with a board height fits the widgets too");
});
