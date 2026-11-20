import assert from "node:assert/strict";
import test from "node:test";
import {
  addPanelItem,
  cellBox,
  defaultWidgetSize,
  dropNewPanelItem,
  FUYU_PAGE_ID,
  fuyuPanel,
  fuyuPanels,
  gridRows,
  layoutStrip,
  stripInsertIndexAt,
  insertIndexAt,
  movePanelItemTo,
  nextPanelSize,
  panelIdOfPage,
  placeFreeItem,
  panelPageId,
  readCustomPanels,
  removePanelItem,
  reorderPanelItem,
  resizePanelItem,
  setPanelMode,
  stretchFreeItem,
} from "../../src/lib/settings/customPanels.ts";
import { applyPanelTemplate } from "../../src/lib/settings/panelTemplates.ts";

const empty = { id: "p1", name: "Work", icon: "star", mode: "grid", items: [] };
const boxes = (panel) => panel.items.map((item) => [item.widget, cellBox(item).col, cellBox(item).row]);

test("a missing or broken fuyu-custom-panels means no custom panels", () => {
  for (const raw of [null, "", "{", "[]", JSON.stringify({ version: 2, panels: [empty] }), JSON.stringify({ version: 1, panels: "x" })]) {
    assert.deepEqual(readCustomPanels(raw), [], String(raw));
  }
});

test("stored panels are cleaned: bad items dropped, unknown icon and mode fall back, ids stay unique", () => {
  const raw = JSON.stringify({
    version: 1,
    panels: [
      { id: "a", name: "  Desk  ", icon: "rocket", mode: "spiral", items: [{ widget: "todos", size: "l", x: 16, y: 0, w: 31, h: 31 }, { widget: "x", size: "huge" }, { size: "s" }] },
      { id: "a", name: "dup" },
      { name: "no id" },
    ],
  });
  assert.deepEqual(readCustomPanels(raw), [{ id: "a", name: "Desk", icon: "layout-grid", mode: "grid", items: [{ widget: "todos", size: "l", x: 16, y: 0, w: 31, h: 31 }] }]);
  assert.equal(readCustomPanels(JSON.stringify({ version: 1, panels: [{ ...empty, mode: "free" }] }))[0].mode, "free");
});

test("a new widget goes into the first free cell, rows grow past four", () => {
  let panel = empty;
  for (const [widget, size] of [["a", "l"], ["b", "m"], ["c", "s"], ["d", "s"], ["e", "w"], ["f", "w"], ["g", "w"]]) panel = addPanelItem(panel, widget, size);
  assert.deepEqual(boxes(panel), [["a", 0, 0], ["b", 2, 0], ["c", 2, 1], ["d", 3, 1], ["e", 0, 2], ["f", 0, 3], ["g", 0, 4]]);
  assert.equal(gridRows(panel.items), 5);
  assert.deepEqual(panel.items[0], { widget: "a", size: "l", x: 0, y: 0, w: 31, h: 31 });
});

test("a widget is added once, and every change lays the panel out again in order", () => {
  let panel = addPanelItem(addPanelItem(addPanelItem(empty, "a", "m"), "b", "m"), "c", "w");
  assert.equal(addPanelItem(panel, "a", "s"), panel);
  panel = reorderPanelItem(panel, "c", "a");
  assert.deepEqual(boxes(panel), [["c", 0, 0], ["a", 0, 1], ["b", 2, 1]]);
  panel = reorderPanelItem(panel, "c", null);
  assert.deepEqual(boxes(panel), [["a", 0, 0], ["b", 2, 0], ["c", 0, 1]]);
  assert.equal(reorderPanelItem(panel, "c", "missing"), panel);
});

test("resizing and removing close the gaps", () => {
  let panel = addPanelItem(addPanelItem(addPanelItem(empty, "a", "s"), "b", "s"), "c", "m");
  panel = resizePanelItem(panel, "a", "l");
  assert.deepEqual(boxes(panel), [["a", 0, 0], ["b", 2, 0], ["c", 2, 1]]);
  panel = removePanelItem(panel, "a");
  assert.deepEqual(boxes(panel), [["b", 0, 0], ["c", 1, 0]]);
  assert.deepEqual(panel.items[1], { widget: "c", size: "m", x: 16, y: 0, w: 31, h: 15 });
});

test("a widget is added at medium when it has it, otherwise at its first size", () => {
  assert.equal(defaultWidgetSize(["s", "m", "l"]), "m");
  assert.equal(defaultWidgetSize(["w"]), "w");
  assert.equal(defaultWidgetSize([]), null);
});

test("there is one Fuyu panel: the stored one, else the first older panel, else the default page", () => {
  const fresh = fuyuPanel([]);
  assert.equal(fresh.id, "fuyu");
  assert.equal(fresh.mode, "grid");
  assert.deepEqual(fresh.items.slice(0, 6).map((item) => `${item.widget}:${item.size}`), ["today:l", "next-meeting:m", "todos:m", "music:m", "pomodoro:s", "streak:s"]);
  const older = [
    { id: "p1", name: "Desk", icon: "home", mode: "free", items: [] },
    { id: "p2", name: "Play", icon: "music", mode: "grid", items: [] },
  ];
  assert.equal(fuyuPanel(older).id, "fuyu");
  assert.equal(fuyuPanel(older).name, "Desk");
  assert.equal(fuyuPanel([...older, { ...older[1], id: "fuyu" }]).name, "Play");
  assert.deepEqual(fuyuPanels(older[1]).map((panel) => panel.id), ["fuyu"]);
  assert.equal(FUYU_PAGE_ID, "panel:fuyu");
  assert.equal(panelPageId("p1"), "panel:p1");
  assert.equal(panelIdOfPage("panel:p1"), "p1");
  assert.equal(panelIdOfPage("todo"), null);
});

test("a free panel keeps hand-placed boxes: 8px steps, inside the four columns, never below a size's own cells (C156.4)", () => {
  let panel = setPanelMode(addPanelItem(addPanelItem(empty, "a", "m"), "b", "s"), "free");
  assert.deepEqual(panel.items.map(({ widget, x, y }) => [widget, x, y]), [["a", 0, 0], ["b", 32, 0]]);
  panel = addPanelItem(panel, "c", "s");
  assert.deepEqual([panel.items[2].x, panel.items[2].y], [0, 16]);
  panel = placeFreeItem(panel, "a", 50.4, -3);
  assert.deepEqual(panel.items.at(-1), { widget: "a", size: "m", x: 32, y: 0, w: 31, h: 15 });
  panel = stretchFreeItem(panel, "a", 40, 4);
  assert.deepEqual([panel.items.at(-1).w, panel.items.at(-1).h], [31, 15]);
  panel = stretchFreeItem(panel, "b", 20, 22);
  assert.deepEqual(panel.items.find((item) => item.widget === "b"), { widget: "b", size: "s", x: 32, y: 16, w: 20, h: 22 });
  panel = removePanelItem(panel, "c");
  assert.deepEqual(panel.items.map((item) => item.widget), ["b", "a"]);
});

test("back to grid, widgets are ordered top to bottom, then left to right, and flowed again; sizes are kept", () => {
  let panel = setPanelMode(addPanelItem(addPanelItem(addPanelItem(empty, "a", "s"), "b", "m"), "c", "l"), "free");
  panel = placeFreeItem(panel, "a", 40, 40);
  panel = placeFreeItem(panel, "c", 0, 40);
  panel = placeFreeItem(panel, "b", 8, 2);
  const grid = setPanelMode(panel, "grid");
  assert.equal(grid.mode, "grid");
  assert.deepEqual(grid.items.map((item) => [item.widget, item.size]), [["b", "m"], ["c", "l"], ["a", "s"]]);
  assert.deepEqual(boxes(grid), [["b", 0, 0], ["c", 2, 0], ["a", 0, 1]]);
  assert.deepEqual(setPanelMode(grid, "free").items, grid.items);
});

test("tapping a grid widget on the island steps through only the sizes it has", () => {
  assert.equal(nextPanelSize(["s", "m", "l"], "s"), "m");
  assert.equal(nextPanelSize(["l", "m"], "l"), "m");
  assert.equal(nextPanelSize(["m", "w"], "w"), "m");
  assert.equal(nextPanelSize(["m"], "m"), null);
});

test("a template adds its widgets at their sizes and skips the ones that are not there", () => {
  const sizes = { todos: ["m", "l"], "next-meeting": ["m", "l"], "session-count": ["m", "l"], music: ["m"], lyrics: ["w"] };
  const work = applyPanelTemplate(empty, "workbench", (id) => sizes[id] ?? null);
  assert.deepEqual(boxes(work), [["todos", 0, 0], ["next-meeting", 2, 0], ["session-count", 2, 1]]);
  assert.equal(work.items[0].size, "l");
  const fun = applyPanelTemplate(empty, "fun", (id) => sizes[id] ?? null);
  assert.deepEqual(fun.items.map((item) => item.widget), ["music", "lyrics"]);
  const withWeather = applyPanelTemplate(empty, "fun", (id) => (id === "@fuyu/weather" ? ["s"] : sizes[id] ?? null));
  assert.deepEqual(boxes(withWeather), [["music", 0, 0], ["@fuyu/weather", 2, 0], ["lyrics", 0, 1]]);
});

const row = () => addPanelItem(addPanelItem(addPanelItem(empty, "a", "m"), "b", "m"), "c", "s");

test("dragging a widget past the middle of another swaps them; short of the middle keeps the order", () => {
  const panel = row();
  const past = movePanelItemTo(panel, "a", insertIndexAt(panel, 450, 60, "a"));
  assert.deepEqual(boxes(past), [["b", 0, 0], ["a", 2, 0], ["c", 0, 1]]);
  assert.equal(movePanelItemTo(panel, "a", insertIndexAt(panel, 300, 60, "a")), panel);
});

test("a widget dragged in from the dock lands where it is dropped", () => {
  const panel = row();
  assert.deepEqual(boxes(dropNewPanelItem(panel, "d", "s", 300, 180)), [["a", 0, 0], ["b", 2, 0], ["c", 0, 1], ["d", 1, 1]]);
  assert.deepEqual(boxes(dropNewPanelItem(panel, "d", "s", 20, 60)).map(([widget]) => widget), ["d", "a", "b", "c"]);
  assert.equal(dropNewPanelItem(panel, "a", "s", 20, 60), panel);
  const free = dropNewPanelItem(setPanelMode(panel, "free"), "d", "s", 200, 100);
  const dropped = free.items.at(-1);
  assert.deepEqual([dropped.widget, dropped.x, dropped.y], ["d", 18, 5]);
});

test("in a free panel a widget put down on others pushes them down instead of covering them", () => {
  let panel = setPanelMode(addPanelItem(addPanelItem(addPanelItem(empty, "a", "s"), "b", "s"), "c", "s"), "free");
  panel = placeFreeItem(panel, "c", 0, 16);
  panel = placeFreeItem(panel, "b", 0, 0);
  const at = (widget) => panel.items.find((item) => item.widget === widget);
  assert.deepEqual([at("b").x, at("b").y], [0, 0]);
  assert.deepEqual([at("a").x, at("a").y], [0, 16]);
  assert.deepEqual([at("c").x, at("c").y], [0, 32]);
  panel = stretchFreeItem(panel, "b", 31, 40);
  assert.deepEqual([at("a").y, at("c").y], [41, 57]);
});

test("the Fuyu strip fills two rows column by column and grows to the right", () => {
  const panel = layoutStrip(["a", "b", "c", "d", "e"].reduce((next, widget, at) => addPanelItem(next, widget, at === 1 ? "m" : "s"), empty), 2);
  assert.deepEqual(boxes(panel), [["a", 0, 0], ["b", 0, 1], ["c", 1, 0], ["d", 2, 0], ["e", 2, 1]]);
  assert.ok(panel.items.every((item) => cellBox(item).row + cellBox(item).rows <= 2));
});

test("dropping on the strip inserts by column, then by row", () => {
  const panel = layoutStrip(["a", "b", "c"].reduce((next, widget) => addPanelItem(next, widget, "s"), empty), 2);
  assert.equal(stripInsertIndexAt(panel, 10, 200, null), 1);
  assert.equal(stripInsertIndexAt(panel, 300, 10, null), 3);
  assert.equal(stripInsertIndexAt(panel, 100, 10, null), 1);
});

test("switching the Fuyu strip to free and back keeps the widgets where they were", () => {
  const strip = layoutStrip(["a", "b", "c", "d", "e"].reduce((next, widget, at) => addPanelItem(next, widget, at === 1 ? "m" : "s"), empty), 2);
  const back = layoutStrip(setPanelMode(setPanelMode(strip, "free"), "grid", true), 2);
  assert.deepEqual(boxes(back), boxes(strip));
});
