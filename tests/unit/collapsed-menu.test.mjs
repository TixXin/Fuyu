import assert from "node:assert/strict";
import test from "node:test";
import { SLOTS } from "@fuyu/plugin-base/protocol";
import { collapsedItemName, collapsedMenuIds, collapsedMenuRows, toggleCollapsedMenuItem } from "../../src/windows/island/collapsedMenu.ts";

const builtin = (id, extra = {}) => ({ id, owner: "builtin", external: false, ...extra });
const plugin = (id, owner) => ({ id, owner, external: true });
const entries = [
  builtin("status-light"),
  builtin("music"),
  builtin("usage:claudeCode", { group: "gauges", hideable: true }),
  builtin("fixed-gauge", { group: "gauges" }),
  plugin("weather", "dev.fuyu.weather"),
  plugin("clock.home", "dev.fuyu.world-clock"),
  plugin("clock.away", "dev.fuyu.world-clock"),
  builtin("session-count"),
];
const sources = {
  labels: new Map([["usage:claudeCode", "用量环 · Claude Code"]]),
  builtin: { "status-light": "Agent 状态灯", music: "音乐", "session-count": "会话数" },
  plugins: new Map([["dev.fuyu.weather", "天气"], ["dev.fuyu.world-clock", "世界时钟"]]),
};
const nameOf = (entry) => collapsedItemName(entry, entries, sources);

test("a collapsed bar item may carry a label for the menu", () => {
  assert.ok(SLOTS["island.collapsed/v1"].meta.includes("label"));
});

test("the menu lists every item that can be hidden, plugin items included", () => {
  assert.deepEqual(collapsedMenuIds(entries), ["status-light", "music", "usage:claudeCode", "weather", "clock.home", "clock.away", "session-count"]);
});

test("rows follow the arranged order and carry whether each item is shown", () => {
  const saved = [{ id: "session-count", zone: "left" }, { id: "status-light", zone: "left" }, { id: "weather", zone: "right", hidden: true }];
  const rows = collapsedMenuRows(entries, saved, nameOf);
  assert.deepEqual(rows.slice(0, 2).map(({ id }) => id), ["session-count", "status-light"]);
  assert.equal(rows.find(({ id }) => id === "weather").shown, false);
  assert.equal(rows.find(({ id }) => id === "music").shown, true);
  assert.equal(rows.some(({ id }) => id === "fixed-gauge"), false);
});

test("an item saved earlier but no longer on the island is not listed", () => {
  const rows = collapsedMenuRows(entries, [{ id: "gone", zone: "right" }], nameOf);
  assert.equal(rows.some(({ id }) => id === "gone"), false);
});

test("names come from the item's label, then the built-in table, then the plugin", () => {
  const names = Object.fromEntries(collapsedMenuRows(entries, [], nameOf).map(({ id, name }) => [id, name]));
  assert.equal(names["usage:claudeCode"], "用量环 · Claude Code");
  assert.equal(names["status-light"], "Agent 状态灯");
  assert.equal(names.weather, "天气");
  assert.equal(names["clock.home"], "世界时钟 · clock.home");
  assert.equal(names["clock.away"], "世界时钟 · clock.away");
});

test("a plugin without a known name falls back to its id", () => {
  assert.equal(collapsedItemName(plugin("x", "dev.someone.x"), [plugin("x", "dev.someone.x")], sources), "dev.someone.x");
});

test("toggling hides a shown item and shows a hidden one, keeping the rest", () => {
  const hidden = toggleCollapsedMenuItem(entries, [], "weather");
  assert.equal(hidden.find(({ id }) => id === "weather").hidden, true);
  assert.equal(hidden.filter(({ hidden: off }) => off).length, 1);
  const back = toggleCollapsedMenuItem(entries, hidden, "weather");
  assert.equal(back.find(({ id }) => id === "weather").hidden, undefined);
  assert.deepEqual(back.map(({ id }) => id), hidden.map(({ id }) => id));
});

test("toggling an item that is not on the island changes nothing", () => {
  const before = toggleCollapsedMenuItem(entries, [], "weather");
  assert.deepEqual(toggleCollapsedMenuItem(entries, before, "nope"), before);
});

test("the island window's dictionary carries the built-in item names the menu shows", async () => {
  const { coreZhCN } = await import("../../src/i18n/locales/core-zh-CN.ts");
  const { coreEn } = await import("../../src/i18n/locales/core-en.ts");
  for (const dictionary of [coreZhCN, coreEn]) {
    const item = dictionary.settings.collapsedItems.item;
    for (const key of ["statusLight", "mail", "update", "deviceUse", "shelf", "music", "sessionCount"]) assert.equal(typeof item[key], "string", key);
    assert.match(item.usage("Codex"), /Codex/);
    assert.equal(typeof dictionary.island.arrangeItems, "string");
    assert.equal(typeof dictionary.island.timer, "string");
  }
});
