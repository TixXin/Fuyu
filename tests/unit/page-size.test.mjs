import assert from "node:assert/strict";
import test from "node:test";
import { FUYU_ISLAND_SIZE } from "../../src/windows/island/custom-panels/panelSize.ts";
import { defaultPageSize, islandPageSize, LIST_PAGE_EXTRA_HEIGHT } from "../../src/windows/island/pageSize.ts";

const defaults = { panelWidth: 800, maxPanelHeight: 360, pageSizes: {} };

test("pages share one width and two heights unless sized on the island", () => {
  assert.deepEqual(defaultPageSize(defaults, "panel:fuyu"), { width: FUYU_ISLAND_SIZE.width, height: FUYU_ISLAND_SIZE.height });
  assert.deepEqual(defaultPageSize(defaults, "music"), { width: 800, height: 360 });
  assert.deepEqual(defaultPageSize(defaults, "plugin:weather"), { width: 800, height: 360 });
  for (const page of ["todo", "calendar", "clipboard", "qq", "agents"]) {
    assert.deepEqual(defaultPageSize(defaults, page), { width: 800, height: 360 + LIST_PAGE_EXTRA_HEIGHT }, page);
  }
  assert.equal(defaultPageSize({ panelWidth: 640, maxPanelHeight: 4300 }, "todo").height, 4320, "the list bonus never passes the height cap");
});

test("a size dragged on the island wins over the page default", () => {
  const settings = { ...defaults, pageSizes: { todo: { width: 1000, height: 300 } } };
  assert.deepEqual(islandPageSize(settings, "todo"), { width: 1000, height: 300 });
  assert.deepEqual(islandPageSize(settings, "calendar"), { width: 800, height: 440 });
  assert.deepEqual(islandPageSize({ ...defaults, pageSizes: {} }, "constructor"), { width: 800, height: 360 }, "page ids never read the prototype");
});
