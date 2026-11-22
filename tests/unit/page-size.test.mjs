import assert from "node:assert/strict";
import test from "node:test";
import { FUYU_ISLAND_SIZE } from "../../src/windows/island/custom-panels/panelSize.ts";
import { defaultPageSize, islandPageSize } from "../../src/windows/island/pageSize.ts";

const defaults = { panelWidth: 800, maxPanelHeight: 360, pageSizes: {} };

test("every page shares the panel width and height unless sized on the island", () => {
  for (const page of ["panel:fuyu", "music", "plugin:weather", "todo", "calendar", "clipboard", "qq", "agents"]) {
    assert.deepEqual(defaultPageSize(defaults, page), { width: 800, height: 360 }, page);
  }
  assert.deepEqual(defaultPageSize({ panelWidth: 1400, maxPanelHeight: 900 }, "todo"), { width: 1400, height: 900 });
});

test("the Fuyu page follows the panel size but never drops below six columns and two rows", () => {
  assert.deepEqual(defaultPageSize({ panelWidth: 1400, maxPanelHeight: 900 }, "panel:fuyu"), { width: 1400, height: 900 });
  assert.deepEqual(defaultPageSize({ panelWidth: 480, maxPanelHeight: 300 }, "panel:fuyu"), { width: FUYU_ISLAND_SIZE.width, height: FUYU_ISLAND_SIZE.height });
});

test("a size dragged on the island wins over the page default", () => {
  const settings = { ...defaults, pageSizes: { todo: { width: 1000, height: 300 } } };
  assert.deepEqual(islandPageSize(settings, "todo"), { width: 1000, height: 300 });
  assert.deepEqual(islandPageSize(settings, "calendar"), { width: 800, height: 360 });
  assert.deepEqual(islandPageSize({ ...defaults, pageSizes: {} }, "constructor"), { width: 800, height: 360 }, "page ids never read the prototype");
});
