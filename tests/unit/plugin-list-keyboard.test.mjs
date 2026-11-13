import assert from "node:assert/strict";
import test from "node:test";
import { moveSelection, normalizeListModel, openableItems } from "../../src/features/plugin-views/model.ts";
import { OPEN_REQUEST_FRESH_MS, noteOpenRequest, onOpenRequest, takeOpenRequest } from "../../src/features/plugin-views/openRequests.ts";

test("only rows that open something can be chosen with the keyboard, in the order shown", () => {
  const list = normalizeListModel({
    items: [{ id: "plain", title: "Just text" }, { id: "act", title: "Runs", action: "launch" }],
    groups: [{ title: "Links", items: [{ id: "bad", title: "Bad", url: "javascript:alert(1)" }, { id: "web", title: "Web", url: "https://example.com" }] }],
  }, "en");
  assert.deepEqual(openableItems(list.groups).map((item) => item.id), ["act", "web"]);
  assert.deepEqual(openableItems([]), []);
});

test("the selection moves one row at a time and stops at both ends", () => {
  assert.equal(moveSelection(0, 3, 1), 1);
  assert.equal(moveSelection(2, 3, 1), 2);
  assert.equal(moveSelection(0, 3, -1), 0);
  assert.equal(moveSelection(2, 3, -1), 1);
  assert.equal(moveSelection(5, 0, 1), 0);
});

test("a page takes focus once, and only soon after its plugin asked to open it", () => {
  noteOpenRequest("dev.a", "page", 1000);
  assert.equal(takeOpenRequest("dev.a", "other", 1000), false);
  assert.equal(takeOpenRequest("dev.a", "page", 1000 + OPEN_REQUEST_FRESH_MS), true);
  assert.equal(takeOpenRequest("dev.a", "page", 1000), false, "taken once");
  noteOpenRequest("dev.a", "page", 1000);
  assert.equal(takeOpenRequest("dev.a", "page", 1001 + OPEN_REQUEST_FRESH_MS), false, "too late");
  assert.equal(takeOpenRequest("dev.b", "page", 0), false, "never asked");
});

test("an open page hears about a request until it stops listening", () => {
  const heard = [];
  const stop = onOpenRequest((pluginId, viewId) => heard.push(`${pluginId}/${viewId}`));
  noteOpenRequest("dev.a", "page", 1);
  stop();
  noteOpenRequest("dev.a", "page", 2);
  assert.deepEqual(heard, ["dev.a/page"]);
  takeOpenRequest("dev.a", "page", 2);
});
