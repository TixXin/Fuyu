import assert from "node:assert/strict";
import test from "node:test";
import "./settingsCategorySlot.mjs";
import { DEFAULT_SETTINGS_CATEGORY, FEATURE_PAGES, entryOf, entryPages, isCategoryAvailable, pagesOfFeaturesOff, searchCategories, settingsCategories, settingsCategoryFor, settingsGroups, sidebarItemOf } from "../../src/windows/settings/categories.ts";
import { categorySlot } from "../../src/windows/settings/slots/categorySlot.ts";
import { shortcutLabel } from "../../src/lib/shortcut/shortcut.ts";
import { isTitleHit, normalizeSearchText, searchSettingsRows, searchWords } from "../../src/windows/settings/settingsSearch.ts";
import { mergeStates, pairLocales } from "../../scripts/settings-search-index.mjs";

const SETTINGS_CATEGORIES = settingsCategories();
const SETTINGS_GROUPS = settingsGroups();
const LOCALES = ["zh-CN", "en"];
const row = (page, zh, en) => ({ page, "zh-CN": zh, en });
const ENTRIES = [
  row("agents", { group: "会话列表", title: "隐藏已退出的会话", description: "按进程是否还在判断" }, { group: "Session list", title: "Hide sessions that have quit", description: "Told by whether the process is alive" }),
  row("agents", { group: "会话卡片", title: "会话来源", options: ["只显示图标", "图标和名称"] }, { group: "Session cards", title: "Session source", options: ["Icon only", "Icon and name"] }),
  row("agentAlerts", { group: "弹出提醒", title: "会话完成时" }, { group: "Pop-up alerts", title: "When a session finishes" }),
];
const PAGES = { agents: "会话 AI Agent", agentAlerts: "弹出提醒 AI Agent 弹出 提醒" };
const search = (query, locale = "zh-CN") => searchSettingsRows(query, ENTRIES, locale, LOCALES, (page) => PAGES[page]);

test("search text ignores case, width, spaces and punctuation", () => {
  assert.equal(normalizeSearchText(" Auto-Tuck　ＡＢ 弹出 提醒。"), "autotuckab弹出提醒");
  assert.deepEqual(searchWords("  弹出 提醒 "), ["弹出", "提醒"]);
});

test("a title beats a choice, which beats a description", () => {
  assert.deepEqual(search("会话").map((hit) => hit.text.title), ["隐藏已退出的会话", "会话来源", "会话完成时"]);
  assert.deepEqual(search("图标").map((hit) => hit.text.title), ["会话来源"]);
  assert.deepEqual(search("进程").map((hit) => hit.text.title), ["隐藏已退出的会话"]);
  assert.ok(search("会话来源")[0].score > search("图标")[0].score);
});

test("any language finds a row, shown in the language asked for", () => {
  assert.deepEqual(search("hide sessions").map((hit) => hit.text.title), ["隐藏已退出的会话"]);
  assert.deepEqual(search("隐藏", "en").map((hit) => hit.text.title), ["Hide sessions that have quit"]);
});

test("every word must match; the page's own text helps but cannot stand alone", () => {
  assert.deepEqual(search("弹出 完成").map((hit) => hit.page), ["agentAlerts"]);
  assert.deepEqual(search("弹出"), [], "a page's name alone lists no rows");
  assert.deepEqual(search("会话 不存在"), []);
});

test("Enter opens a row only when the query is in its title", () => {
  assert.ok(isTitleHit(search("会话来源")[0], "会话来源"));
  assert.ok(!isTitleHit(search("进程")[0], "进程"));
  assert.ok(!isTitleHit(undefined, "x"));
});

test("pages match words written together or apart", () => {
  const describe = (page) => (page === "agentAlerts" ? "弹出提醒 AI Agent 弹出 提醒 通知" : "");
  assert.ok(searchCategories("弹出提醒", describe).includes("agentAlerts"));
  assert.ok(searchCategories("弹出 通知", describe).includes("agentAlerts"));
});

test("the index keeps each row once and pairs the languages row by row", () => {
  const on = [{ page: "agents", group: "g", title: "a" }, { page: "agents", group: "g", title: "b" }];
  const defaults = [{ page: "agents", group: "g", title: "a" }, { page: "agents", group: "g", title: "c" }];
  assert.deepEqual(mergeStates([on, defaults]).map((entry) => entry.title), ["a", "b", "c"]);
  const paired = pairLocales({ "zh-CN": [{ page: "agents", group: "组", title: "甲" }], en: [{ page: "agents", group: "G", title: "A" }] });
  assert.deepEqual(paired, [{ page: "agents", "zh-CN": { group: "组", title: "甲" }, en: { group: "G", title: "A" } }]);
  assert.throws(() => pairLocales({ "zh-CN": [{ page: "agents", group: "", title: "x" }], en: [] }));
  assert.throws(() => pairLocales({ "zh-CN": [{ page: "agents", group: "", title: "x" }], en: [{ page: "about", group: "", title: "x" }] }));
});

test("a page whose feature the system lacks is not offered", () => {
  const mac = new Set(["clipboard", "music", "qq"]);
  assert.equal(isCategoryAvailable("clipboard", mac), false);
  assert.equal(isCategoryAvailable("music", mac), false);
  assert.equal(isCategoryAvailable("messages", mac), true);
  assert.equal(isCategoryAvailable("general", mac), true);
  assert.equal(isCategoryAvailable("clipboard", new Set()), true);
});

test("on a Mac a shortcut reads with the modifier symbols in Apple's order", () => {
  assert.equal(shortcutLabel("Shift+Win+V", true), "⇧⌘V");
  assert.equal(shortcutLabel("Ctrl+Alt+Shift+Win+F5", true), "⌃⌥⇧⌘F5");
  assert.equal(shortcutLabel("Ctrl+Shift+W", false), "Ctrl+Shift+W");
});

test("the settings window opens on the overview, and a feature that is off takes its pages out of the menu", () => {
  assert.equal(DEFAULT_SETTINGS_CATEGORY, "overview");
  const allOn = Object.fromEntries(Object.keys(FEATURE_PAGES).map((feature) => [feature, true]));
  assert.equal(pagesOfFeaturesOff(allOn).size, 0);
  const off = pagesOfFeaturesOff({ ...allOn, agents: false, music: false });
  assert.deepEqual([...off].sort(), [...FEATURE_PAGES.agents, ...FEATURE_PAGES.music].sort());
  assert.ok(!off.has("overview") && !off.has("messages") && !off.has("general"));
  for (const pages of Object.values(FEATURE_PAGES)) for (const page of pages) assert.ok(SETTINGS_CATEGORIES.includes(page), page);
});

test("Appearance has 5 tabs, AI Agent is a group of 4 items, and every page is reachable", () => {
  assert.deepEqual(entryPages("appearance"), ["theme", "themeStyle", "appearance", "appearanceCollapsed", "themeMarket"]);
  assert.deepEqual(SETTINGS_GROUPS.find((group) => group.label === "agents")?.categories, ["agents", "agentAppearance", "agentAlerts", "agentRemote"]);
  assert.equal(sidebarItemOf("sounds"), "agentAlerts");
  assert.equal(sidebarItemOf("agentRings"), "agentAppearance");
  assert.equal(sidebarItemOf("themeMarket"), "appearance");
  assert.equal(sidebarItemOf("music"), "music");
  assert.deepEqual(entryPages("general"), ["general", "generalData", "generalApi"]);
  const listed = SETTINGS_GROUPS.flatMap((group) => group.categories);
  assert.equal(new Set(listed).size, listed.length);
  const reachable = new Set(listed.flatMap((item) => entryPages(item)));
  assert.deepEqual([...reachable].sort(), [...SETTINGS_CATEGORIES].sort());
});

test("a category added to settings.category/v1 brings its own group, tabs, switch, availability and old names", () => {
  const removers = [
    categorySlot.add({ id: "demoTools", group: "extensions", tabs: ["demoTools", "demoToolsMore"], feature: "demo", aliases: ["demo-old"], component: () => null }, "demo"),
    categorySlot.add({ id: "demoToolsMore", feature: "demo", available: ({ mac }) => !mac, component: () => null }, "demo"),
  ];
  try {
    const groups = settingsGroups();
    assert.equal(groups.find((group) => group.label === "extensions").categories.at(-1), "demoTools");
    assert.deepEqual(groups.at(-1), { label: null, categories: ["about"] });
    assert.deepEqual(entryPages("demoTools"), ["demoTools", "demoToolsMore"]);
    assert.equal(sidebarItemOf("demoToolsMore"), "demoTools");
    assert.equal(isCategoryAvailable("demoToolsMore", new Set(), true), false);
    assert.equal(isCategoryAvailable("demoToolsMore", new Set(), false), true);
    const allOn = Object.fromEntries(Object.keys(FEATURE_PAGES).map((feature) => [feature, true]));
    assert.equal(pagesOfFeaturesOff(allOn).size, 0);
    assert.deepEqual([...pagesOfFeaturesOff({ ...allOn, demo: false })].sort(), ["demoTools", "demoToolsMore"]);
    assert.equal(settingsCategoryFor("demo-old"), "demoTools");
  } finally {
    for (const remove of removers) remove();
  }
  assert.ok(!settingsCategories().includes("demoTools"));
  assert.equal(isCategoryAvailable("demoToolsMore", new Set(), false), false);
  assert.equal(settingsCategoryFor("demo-old"), null);
});
