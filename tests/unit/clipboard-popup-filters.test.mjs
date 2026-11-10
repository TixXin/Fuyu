import assert from "node:assert/strict";
import test from "node:test";
import { parsePopupQuery } from "../../src/features/clipboard/popupQuery.ts";
import { filterPopupItems, nextPopupFilter, popupFilters, popupTags } from "../../src/features/clipboard/popupFilters.ts";

const item = (id, extra = {}) => ({ id, kind: "text", hash: id, createdAt: 0, copiedAt: 0, preview: id, ...extra });
const ITEMS = [
  item("a", { tags: ["设置", "x"] }),
  item("b", { favorite: true, tags: ["设置"] }),
  item("c", { kind: "image", preview: "770 x 148 image" }),
  item("d", { kind: "files", files: ["C:\a.md"], tags: ["x", "y"] }),
];

test("the most used tags come first, at most three", () => {
  const tags = popupTags(ITEMS);
  assert.deepEqual([...tags.slice(0, 2)].sort(), ["x", "设置"].sort());
  assert.equal(tags[2], "y");
  assert.equal(popupTags(ITEMS, 1).length, 1);
});

test("Tab goes through the chips and wraps round; Shift+Tab goes back", () => {
  const filters = popupFilters(["x"]);
  assert.deepEqual(filters, ["all", "favorites", "images", "files", "links", "colors", "snippets", "#x"]);
  assert.equal(nextPopupFilter(filters, "all", false), "favorites");
  assert.equal(nextPopupFilter(filters, "#x", false), "all");
  assert.equal(nextPopupFilter(filters, "all", true), "#x");
});

test("each chip keeps its kind of entry, and the search narrows it", () => {
  const ids = (filter, needle = "") => filterPopupItems(ITEMS, filter, parsePopupQuery(needle)).map((entry) => entry.id).join();
  assert.equal(ids("all"), "a,b,c,d");
  assert.equal(ids("favorites"), "b");
  assert.equal(ids("images"), "c");
  assert.equal(ids("files"), "d");
  assert.equal(ids("#设置"), "a,b");
  assert.equal(ids("#x", "d"), "d");
});
