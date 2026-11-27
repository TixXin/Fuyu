import assert from "node:assert/strict";
import test from "node:test";
import "./islandPageSlot.mjs";
import { FUYU_PAGE_ID } from "../../src/lib/settings/customPanels.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/lib/settings/settings.ts";
import { arrangeIslandPages, customPageName, moveIslandPage, placeIslandPage, readIslandPages, resetIslandPageOrder, setIslandPageHidden, setIslandPageIcon, setIslandPageName, setIslandPagePlacement } from "../../src/lib/settings/islandPages.ts";
import { cycleShortcutPage, headerDotPages, isPageShown, pageForAltDigit, pageShortcutOrder, resolveIslandPage } from "../../src/windows/island/features.ts";
import { resolveHomePage } from "../../src/windows/island/homePage.ts";
import { pageSlot } from "../../src/windows/island/slots/pageSlot.ts";

const every = { agents: true, todo: true, calendar: true, music: true, clipboard: true, shelf: true, screenshots: true, timer: true, qq: true, wechat: false, qqMail: false, translation: true };
const dots = (features) => headerDotPages(pageSlot.items(), features).map((item) => item.id);

test("a missing or broken fuyu-island-pages keeps today's order", () => {
  for (const raw of [null, "", "{", "[]", JSON.stringify({ version: 2, order: ["timer"] }), JSON.stringify({ version: 1, order: "timer" })]) {
    assert.deepEqual(readIslandPages(raw), { order: [], hidden: [] }, String(raw));
  }
  assert.deepEqual(readIslandPages(JSON.stringify({ version: 1, order: ["timer", 3, "timer", "todo"], hidden: ["music", ""] })), { order: ["timer", "todo"], hidden: ["music"] });
  assert.deepEqual(pageShortcutOrder({ ...every, pageLayout: { order: [], hidden: [] } }), pageShortcutOrder(every));
});

test("a page the saved order has not seen goes right after the page before it in the default order", () => {
  assert.deepEqual(arrangeIslandPages(["a", "b", "c", "d"], ["c", "a"]), ["c", "d", "a", "b"]);
  assert.deepEqual(arrangeIslandPages(["new", "a", "b"], ["b", "a"]), ["new", "b", "a"]);
  assert.deepEqual(arrangeIslandPages(["a", "b"], ["gone-plugin", "b", "a"]), ["gone-plugin", "b", "a"]);
});

test("the header dots, Alt+number and page cycling follow the user's order and skip hidden pages", () => {
  const order = ["timer", "todo", "agents", "music", "calendar", "clipboard", "shelf", "screenshots", "qq", "translation"];
  const pageLayout = { order, hidden: ["music", "qq"] };
  const features = { ...every, pageLayout };
  assert.deepEqual(dots(features), ["timer", "todo", "calendar", "clipboard", "shelf", "screenshots"]);
  assert.deepEqual(pageShortcutOrder(features), ["timer", "todo", "agents", "calendar", "clipboard", "shelf", "screenshots", "translation"]);
  assert.equal(pageForAltDigit(features, 1), "timer");
  assert.equal(pageForAltDigit(features, 3), "agents");
  assert.equal(cycleShortcutPage(features, "translation", 1), "timer");
  assert.equal(isPageShown("music", features), false);
  assert.equal(isPageShown("qq", features), false);
  assert.equal(isPageShown("todo", features), true);
  assert.equal(resolveIslandPage("music", features), "music");
  assert.equal(isPageShown("calendar", { ...features, calendar: false }), false);
  const withPlugin = { ...features, pageLayout: { ...pageLayout, order: order.filter((id) => id !== "agents") } };
  assert.deepEqual(pageShortcutOrder(withPlugin).slice(0, 2), ["agents", "timer"]);
});

test("moving skips pages that are not listed and hiding toggles one id", () => {
  const listed = ["agents", "todo", "music"];
  const layout = { order: ["agents", "plugin-gone", "todo", "music"], hidden: [] };
  assert.deepEqual(moveIslandPage(layout, listed, "todo", -1).order, ["todo", "plugin-gone", "agents", "music"]);
  assert.equal(moveIslandPage(layout, listed, "agents", -1), layout);
  assert.deepEqual(moveIslandPage({ order: [], hidden: [] }, listed, "music", -1).order, ["agents", "music", "todo"]);
  const hidden = setIslandPageHidden(layout, "music", true);
  assert.deepEqual(hidden.hidden, ["music"]);
  assert.deepEqual(setIslandPageHidden(hidden, "music", false).hidden, []);
});

test("dragging a page puts it before another one or at the end", () => {
  const listed = ["agents", "todo", "music", "panel:a"];
  const empty = { order: [], hidden: ["music"] };
  assert.deepEqual(placeIslandPage(empty, listed, "panel:a", "agents"), { order: ["panel:a", "agents", "todo", "music"], hidden: ["music"] });
  assert.deepEqual(placeIslandPage(empty, listed, "agents", null).order, ["todo", "music", "panel:a", "agents"]);
  assert.equal(placeIslandPage(empty, listed, "todo", "todo"), empty);
  assert.equal(placeIslandPage(empty, listed, "todo", "missing"), empty);
});

test("page icons are an optional map that old data does without and junk entries drop out of", () => {
  assert.equal("icons" in readIslandPages(JSON.stringify({ version: 1, order: ["todo"], hidden: [] })), false);
  assert.deepEqual(readIslandPages(JSON.stringify({ version: 1, order: [], hidden: [], icons: { todo: "star", music: 3, "": "cat", calendar: "", timer: "x".repeat(41), "panel:fuyu": "jellyfish" } })),
    { order: [], hidden: [], icons: { todo: "star", "panel:fuyu": "jellyfish" } });
  assert.equal("icons" in readIslandPages(JSON.stringify({ version: 1, order: [], hidden: [], icons: ["star"] })), false);
});

test("setting a page icon keeps order and hidden, and clearing the last one drops the map", () => {
  const layout = { order: ["timer", "todo"], hidden: ["music"] };
  const starred = setIslandPageIcon(layout, "todo", "star");
  assert.deepEqual(starred, { order: ["timer", "todo"], hidden: ["music"], icons: { todo: "star" } });
  assert.deepEqual(setIslandPageIcon(starred, "todo", "cat").icons, { todo: "cat" });
  assert.deepEqual(setIslandPageIcon(starred, "todo", null), layout);
  assert.deepEqual(setIslandPageHidden(starred, "todo", true).icons, { todo: "star" });
  assert.deepEqual(moveIslandPage(starred, ["timer", "todo"], "todo", -1).icons, { todo: "star" });
});

test("page names are optional: old data has none, junk is dropped, blanks unset and long names cut to 16 characters", () => {
  assert.equal("names" in readIslandPages(JSON.stringify({ version: 1, order: ["todo"], hidden: [] })), false);
  assert.equal("names" in readIslandPages(JSON.stringify({ version: 1, order: [], hidden: [], names: ["Work"] })), false);
  const long = "一二三四五六七八九十甲乙丙丁戊己庚辛";
  assert.deepEqual(readIslandPages(JSON.stringify({ version: 1, order: [], hidden: [], names: { todo: "  Work  ", music: 3, calendar: "   ", "": "x", timer: long, "panel:fuyu": "🐟 Home" } })),
    { order: [], hidden: [], names: { todo: "Work", timer: long.slice(0, 16), "panel:fuyu": "🐟 Home" } });
  assert.equal(customPageName(undefined, "todo"), undefined);
  assert.equal(customPageName({ order: [], hidden: [], names: { todo: "Work" } }, "todo"), "Work");
});

test("naming a page keeps every other field, and clearing the last name drops the map", () => {
  const layout = { order: ["timer"], hidden: ["music"], icons: { todo: "star" }, placement: { qq: "left" } };
  const named = setIslandPageName(layout, "panel:fuyu", " Desk ");
  assert.deepEqual(named, { ...layout, names: { "panel:fuyu": "Desk" } });
  assert.deepEqual(setIslandPageName(named, "panel:fuyu", "   "), layout);
  assert.deepEqual(setIslandPageName(named, "panel:fuyu", null), layout);
  assert.deepEqual(setIslandPageIcon(named, "todo", null).names, { "panel:fuyu": "Desk" });
  assert.deepEqual(setIslandPagePlacement(named, "qq", "top").names, { "panel:fuyu": "Desk" });
  assert.deepEqual(resetIslandPageOrder(named), { order: [], hidden: [], icons: { todo: "star" }, names: { "panel:fuyu": "Desk" } });
});

test("resolveHomePage respects rememberLastPage, urgent popups, hidden Fuyu page and side-docked pages", () => {
  const removeFuyu = pageSlot.add({ id: FUYU_PAGE_ID, shortcutOrder: 0, headerDot: true, component: () => null });
  try {
    assert.equal(resolveHomePage({ rememberLastPage: false, urgentPage: null, page: "music", features: every }), FUYU_PAGE_ID);
    assert.equal(resolveHomePage({ rememberLastPage: true, urgentPage: null, page: "music", features: every }), "music");
    assert.equal(resolveHomePage({ rememberLastPage: true, urgentPage: "agents", page: "music", features: every }), "agents");
    assert.equal(resolveHomePage({ rememberLastPage: true, urgentPage: "agents", page: "music", features: { ...every, agents: false } }), "music");
    assert.equal(resolveHomePage({ rememberLastPage: true, urgentPage: null, page: "music", features: { ...every, music: false } }), FUYU_PAGE_ID);
    const hiddenMusic = { ...every, pageLayout: { order: [], hidden: ["music"] } };
    assert.equal(resolveHomePage({ rememberLastPage: true, urgentPage: null, page: "music", features: hiddenMusic }), FUYU_PAGE_ID);
    const sideDockedMusic = {
      ...every,
      pageLayout: { order: [], hidden: [], placement: { music: "left" } },
      enabledSides: { left: true, right: false },
    };
    assert.equal(resolveHomePage({ rememberLastPage: true, urgentPage: null, page: "music", features: sideDockedMusic }), FUYU_PAGE_ID);
    const hiddenFuyu = { ...every, pageLayout: { order: ["timer", "todo", "agents"], hidden: [FUYU_PAGE_ID] } };
    assert.equal(resolveHomePage({ rememberLastPage: false, urgentPage: null, page: "music", features: hiddenFuyu }), "timer");
    assert.equal(resolveHomePage({ rememberLastPage: true, urgentPage: null, page: "music", features: hiddenFuyu }), "music");
  } finally {
    removeFuyu();
  }
});

test("islandExpandShortcut and rememberLastPage default to off and normalize safely", () => {
  assert.equal(DEFAULT_SETTINGS.islandExpandShortcut, "");
  assert.equal(normalizeSettings({}).islandExpandShortcut, "");
  assert.equal(normalizeSettings({ islandExpandShortcut: 42 }).islandExpandShortcut, "");
  assert.equal(normalizeSettings({ islandExpandShortcut: " Ctrl+Alt+Space " }).islandExpandShortcut, "Ctrl+Alt+Space");
  assert.equal(DEFAULT_SETTINGS.rememberLastPage, false);
  assert.equal(normalizeSettings({}).rememberLastPage, false);
  assert.equal(normalizeSettings({ rememberLastPage: "yes" }).rememberLastPage, false);
  assert.equal(normalizeSettings({ rememberLastPage: true }).rememberLastPage, true);
});
