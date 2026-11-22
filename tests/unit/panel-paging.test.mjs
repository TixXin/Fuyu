import assert from "node:assert/strict";
import test from "node:test";
import { cellBox, layoutStrip, readCustomPanels } from "../../src/lib/settings/customPanels.ts";
import { boardTarget, liftWidget, pageCountOf, pageOfItem, pageTarget, pushedWidgets, spotTarget } from "../../src/windows/island/custom-panels/paging/gridTarget.ts";
import { FUYU_ISLAND_SIZE, stripRoom } from "../../src/windows/island/custom-panels/panelSize.ts";
import { stripGeometry } from "../../src/windows/island/custom-panels/stripGeometry.ts";

const COLUMNS = 6;
const STEP = 6 * 128;

const item = (widget, size = "m", extra = {}) => ({ widget, size, x: 0, y: 0, w: 0, h: 0, ...extra });
const panel = (items) => ({ id: "fuyu", name: "", icon: "layout-grid", mode: "grid", items });
const pageOf = (laid, widget) => pageOfItem(laid.items.find((candidate) => candidate.widget === widget), COLUMNS);
const full = () => panel(["a", "b", "c", "d", "e", "f"].map((widget) => item(widget)));

test("a stored page break survives reading and is dropped when it is anything but true", () => {
  const raw = JSON.stringify({ version: 1, panels: [panel([item("a"), item("b", "m", { pageBreak: true }), item("c", "m", { pageBreak: "yes" })])] });
  const [read] = readCustomPanels(raw);
  assert.equal(read.items[1].pageBreak, true);
  assert.equal("pageBreak" in read.items[2], false);
});

test("a widget with a page break starts the next page even when the current one has room", () => {
  const laid = layoutStrip(panel([item("a"), item("b", "m", { pageBreak: true })]), 2, COLUMNS);
  assert.equal(pageOf(laid, "a"), 0);
  assert.equal(pageOf(laid, "b"), 1);
  assert.equal(cellBox(laid.items[1]).col, COLUMNS);
});

test("lifting the widget that opens a page keeps that page open for the one after it", () => {
  const lifted = liftWidget(panel([item("a"), item("b", "m", { pageBreak: true }), item("c")]), "b");
  assert.equal(lifted.item.pageBreak, undefined);
  assert.deepEqual(
    lifted.rest.items.map((entry) => [entry.widget, entry.pageBreak ?? false]),
    [
      ["a", false],
      ["c", true],
    ],
  );
});

test("dropping on a full page's thumbnail lands the widget on that page and pushes the last one on", () => {
  const before = layoutStrip(full(), 2, COLUMNS);
  const target = pageTarget(full(), item("x"), 0, COLUMNS);
  assert.equal(target.page, 0);
  assert.equal(pageOf(target.panel, "x"), 0);
  assert.equal(target.fresh, false);
  const pushed = pushedWidgets(before, target.panel, COLUMNS, "x");
  assert.ok(pushed.length > 0);
  for (const widget of pushed) assert.equal(pageOf(target.panel, widget), 1);
});

test("dragging past the last page opens a new page that stays even though the page before has room", () => {
  const rest = panel([item("a")]);
  const target = boardTarget(rest, item("x"), STEP + 10, 10, COLUMNS, STEP);
  assert.equal(target.fresh, true);
  assert.equal(target.page, 1);
  assert.equal(pageCountOf(target.panel, COLUMNS), 2);
  assert.equal(target.panel.items.find((entry) => entry.widget === "x").pageBreak, true);
});

test("a widget let go at the start of a page lands on that page, not in a gap on the page before", () => {
  const rest = layoutStrip(panel([item("a"), item("b", "m", { pageBreak: true })]), 2, COLUMNS);
  const target = boardTarget(rest, item("x"), STEP + 5, 5, COLUMNS, STEP);
  assert.equal(target.page, 1);
  assert.equal(pageOf(target.panel, "x"), 1);
});

test("the tray is not a place on the board", () => {
  assert.equal(spotTarget(full(), item("x"), { kind: "tray" }, COLUMNS, STEP), null);
});

test("an edited grid panel stays paged so a drag can flip between pages", () => {
  const room = stripRoom(FUYU_ISLAND_SIZE);
  const editing = stripGeometry(full(), room, true);
  assert.equal(editing.pages, 1);
  assert.equal(editing.width, stripGeometry(full(), room, false).width);
});
