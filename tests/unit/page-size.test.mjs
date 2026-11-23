import assert from "node:assert/strict";
import test from "node:test";
import { defaultPageSize, islandPageSize, widestPageWidth } from "../../src/windows/island/pageSize.ts";

const defaults = { panelWidth: 800, maxPanelHeight: 360, pageSizes: {} };

test("every page shares the panel width and height unless sized on the island", () => {
  for (const page of ["panel:fuyu", "music", "plugin:weather", "todo", "calendar", "clipboard", "qq", "agents"]) {
    assert.deepEqual(islandPageSize(defaults, page), { width: 800, height: 360 }, page);
  }
  assert.deepEqual(defaultPageSize({ panelWidth: 1400, maxPanelHeight: 900 }), { width: 1400, height: 900 });
});

test("the Fuyu page follows the panel size both wider and narrower than six columns", () => {
  assert.deepEqual(islandPageSize({ panelWidth: 1400, maxPanelHeight: 900, pageSizes: {} }, "panel:fuyu"), { width: 1400, height: 900 });
  assert.deepEqual(islandPageSize({ panelWidth: 480, maxPanelHeight: 360, pageSizes: {} }, "panel:fuyu"), { width: 480, height: 360 });
});

test("a size dragged on the island wins over the page default", () => {
  const settings = { ...defaults, pageSizes: { todo: { width: 1000, height: 300 } } };
  assert.deepEqual(islandPageSize(settings, "todo"), { width: 1000, height: 300 });
  assert.deepEqual(islandPageSize(settings, "calendar"), { width: 800, height: 360 });
  assert.deepEqual(islandPageSize({ ...defaults, pageSizes: {} }, "constructor"), { width: 800, height: 360 }, "page ids never read the prototype");
});

test("the widest page is the widest dragged size or the panel width, whichever is larger", () => {
  assert.equal(widestPageWidth(defaults), 800);
  assert.equal(widestPageWidth({ ...defaults, pageSizes: { "panel:fuyu": { width: 820, height: 329 }, todo: { width: 640, height: 300 } } }), 820);
  assert.equal(widestPageWidth({ ...defaults, pageSizes: { todo: { width: 640, height: 300 } } }), 800, "pages without their own size still use the panel width");
});
