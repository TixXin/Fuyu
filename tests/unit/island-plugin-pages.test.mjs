import assert from "node:assert/strict";
import test from "node:test";
import "./islandPageSlot.mjs";
import { pageSlot } from "../../src/windows/island/slots/pageSlot.ts";
import { cycleShortcutPage, headerDotPages, pageForAltDigit, pageShortcutOrder, resolveIslandPage } from "../../src/windows/island/features.ts";
import { localizedTitle, packageLabel } from "../../src/features/plugin-kernel/slotTitle.ts";
import { pluginNames, updatePluginNames } from "../../src/features/plugin-kernel/pluginNames.ts";

const every = { agents: true, todo: true, calendar: true, music: true, clipboard: true, shelf: true, screenshots: true, timer: true, qq: true, wechat: false, qqMail: false, translation: true };
const View = () => null;

function withPluginPages(pages, run) {
  const removers = pages.map(({ owner, ...item }) => pageSlot.registry.add(pageSlot.name, { component: View, ...item }, owner, { external: true }));
  try {
    run();
  } finally {
    for (const remove of removers) remove();
  }
}

test("a plugin's island page joins the header after the built-in dots, unless it opts out", () => {
  withPluginPages([
    { id: "world-clock", owner: "@fuyu/world-clock", title: { "zh-CN": "世界时钟", en: "World Clock" } },
    { id: "@fuyu/github-issues", owner: "@fuyu/github-issues" },
    { id: "quiet", owner: "@acme/quiet", headerDot: false },
  ], () => {
    const dots = headerDotPages(pageSlot.items(), every).map((item) => item.id);
    assert.deepEqual(dots, ["todo", "music", "calendar", "clipboard", "shelf", "screenshots", "timer", "world-clock", "@fuyu/github-issues"]);
    assert.equal(resolveIslandPage("world-clock", every), "world-clock");
  });
});

test("page shortcuts reach plugin pages in header order, before the bell, and plugins cannot jump ahead of built-in pages", () => {
  withPluginPages([
    { id: "late", owner: "@acme/late" },
    { id: "eager", owner: "@acme/eager", shortcutOrder: -5 },
  ], () => {
    const order = pageShortcutOrder(every);
    assert.deepEqual(order, ["agents", "todo", "music", "calendar", "clipboard", "shelf", "screenshots", "timer", "eager", "late", "qq", "translation"]);
    assert.equal(cycleShortcutPage(every, "timer", 1), "eager");
    const fewer = { ...every, music: false, calendar: false, clipboard: false, shelf: false, screenshots: false, timer: false };
    assert.equal(pageForAltDigit(fewer, 3), "eager");
    assert.equal(pageForAltDigit(fewer, 4), "late");
  });
});

test("a plugin page whose enabled() throws stays out instead of breaking the header", () => {
  withPluginPages([{ id: "broken", owner: "@acme/broken", enabled: () => { throw new Error("nope"); } }], () => {
    assert.equal(headerDotPages(pageSlot.items(), every).some((item) => item.id === "broken"), false);
    assert.equal(pageShortcutOrder(every).includes("broken"), false);
  });
});

test("page titles follow the interface language and fall back sensibly", () => {
  const title = { "zh-CN": "世界时钟", en: "World Clock" };
  assert.equal(localizedTitle(title, "zh-CN"), "世界时钟");
  assert.equal(localizedTitle(title, "en"), "World Clock");
  assert.equal(localizedTitle({ en: "Only English" }, "zh-CN"), "Only English");
  assert.equal(localizedTitle({ ja: "時計" }, "en"), "時計");
  assert.equal(localizedTitle("  Plain  ", "en"), "Plain");
  for (const empty of [undefined, null, "", "   ", { en: "  " }, ["x"], 42]) assert.equal(localizedTitle(empty, "en"), null);
  assert.equal(packageLabel("@fuyu/github-issues"), "github-issues");
  assert.equal(packageLabel("hello"), "hello");
});

test("plugin display names come from the host's status list and ignore entries without one", () => {
  updatePluginNames([{ id: "@fuyu/world-clock", displayName: { en: "World Clock" } }, { id: "@acme/nameless" }, { displayName: "no id" }]);
  assert.deepEqual([...pluginNames().keys()], ["@fuyu/world-clock"]);
  const before = pluginNames();
  updatePluginNames([{ id: "@fuyu/world-clock", displayName: { en: "World Clock" } }]);
  assert.equal(pluginNames(), before, "an unchanged list keeps the same map, so the header does not re-render");
  updatePluginNames([]);
  assert.equal(pluginNames().size, 0);
});
