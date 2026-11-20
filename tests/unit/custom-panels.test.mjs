import assert from "node:assert/strict";
import test from "node:test";
import {
  addPanelItem,
  cellBox,
  createPanel,
  gridRows,
  movePanelItem,
  panelIdOfPage,
  panelPageId,
  readCustomPanels,
  removePanel,
  removePanelItem,
  resizePanelItem,
  updatePanel,
} from "../../src/lib/settings/customPanels.ts";

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

test("dropping a widget onto others pushes them down, the moved one keeps its cell", () => {
  let panel = addPanelItem(addPanelItem(addPanelItem(empty, "a", "m"), "b", "m"), "c", "w");
  panel = movePanelItem(panel, 2, 0, 0);
  assert.deepEqual(boxes(panel), [["a", 0, 1], ["b", 2, 1], ["c", 0, 0]]);
  panel = movePanelItem(panel, 0, 3, 0);
  assert.deepEqual(boxes(panel), [["a", 2, 0], ["b", 2, 2], ["c", 0, 1]]);
});

test("resizing and removing keep the grid without overlaps", () => {
  let panel = addPanelItem(addPanelItem(empty, "a", "s"), "b", "s");
  panel = resizePanelItem(panel, 0, "l");
  assert.deepEqual(boxes(panel), [["a", 0, 0], ["b", 1, 2]]);
  panel = removePanelItem(panel, 0);
  assert.deepEqual(boxes(panel), [["b", 1, 2]]);
});

test("panels are created, renamed and removed by id, and map to their own page ids", () => {
  let panels = createPanel([], "p1", "  Desk ", "home");
  panels = createPanel(panels, "p1", "again", "home");
  assert.deepEqual(panels, [{ id: "p1", name: "Desk", icon: "home", mode: "grid", items: [] }]);
  panels = updatePanel(panels, "p1", (panel) => ({ ...panel, name: "Play" }));
  assert.equal(panels[0].name, "Play");
  assert.deepEqual(removePanel(panels, "p1"), []);
  assert.equal(panelPageId("p1"), "panel:p1");
  assert.equal(panelIdOfPage("panel:p1"), "p1");
  assert.equal(panelIdOfPage("todo"), null);
});
