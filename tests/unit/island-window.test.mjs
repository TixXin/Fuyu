import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_COLLAPSED_ISLAND_WIDTH,
  MIN_COLLAPSED_ISLAND_WIDTH,
  alignCollapsedIslandWidth,
  getCollapsedIslandWidth,
  getTodoScrollStartRows,
} from "../../src/windows/island/layout.ts";
import { ISLAND_POSITION_STORAGE_KEY, loadIslandPosition } from "../../src/windows/island/storage.ts";

function withStorage(entries, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map(entries);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (key) => values.get(key) ?? null } } });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else delete globalThis.window;
  }
}

test("the collapsed island grows with its text between the min and max widths", () => {
  assert.equal(getCollapsedIslandWidth(""), MIN_COLLAPSED_ISLAND_WIDTH);
  assert.equal(getCollapsedIslandWidth("x".repeat(200)), MAX_COLLAPSED_ISLAND_WIDTH);
  const mid = getCollapsedIslandWidth("abcdefg");
  assert.ok(mid > MIN_COLLAPSED_ISLAND_WIDTH && mid < MAX_COLLAPSED_ISLAND_WIDTH, String(mid));
  assert.equal(Number.isInteger(mid), true);
});

test("plugin slots widen the collapsed island by the width they need, up to the max", () => {
  assert.equal(getCollapsedIslandWidth("", 42), MIN_COLLAPSED_ISLAND_WIDTH + 42);
  assert.equal(getCollapsedIslandWidth("", -10), MIN_COLLAPSED_ISLAND_WIDTH);
  assert.equal(getCollapsedIslandWidth("abcdefg", 1000), MAX_COLLAPSED_ISLAND_WIDTH);
});

test("the collapsed width setting moves the whole range, and alignment stays inside it", () => {
  assert.equal(getCollapsedIslandWidth("", 0, 60), MIN_COLLAPSED_ISLAND_WIDTH + 60);
  assert.equal(getCollapsedIslandWidth("x".repeat(200), 0, -40), MAX_COLLAPSED_ISLAND_WIDTH - 40);
  assert.equal(getCollapsedIslandWidth("abcdefg", 1000, 100), MAX_COLLAPSED_ISLAND_WIDTH + 100);
  for (const extra of [-60, 37, 180]) {
    for (let width = MIN_COLLAPSED_ISLAND_WIDTH + extra; width <= MAX_COLLAPSED_ISLAND_WIDTH + extra; width++) {
      const aligned = alignCollapsedIslandWidth(width, 820, 1.25, extra);
      assert.ok(aligned >= MIN_COLLAPSED_ISLAND_WIDTH + extra && aligned <= MAX_COLLAPSED_ISLAND_WIDTH + extra, `${width} ${extra}`);
    }
  }
});

test("the todo list scrolls after as many rows as fit under the max panel height", () => {
  assert.equal(getTodoScrollStartRows(490), 6);
  assert.equal(getTodoScrollStartRows(351), 2);
  assert.equal(getTodoScrollStartRows(352), 3);
});

test("the collapsed width is nudged so the centred island starts on a whole device pixel", () => {
  const leftEdge = (width, ratio) => ((820 - width) / 2) * ratio;
  assert.equal(alignCollapsedIslandWidth(301, 820, 1), 300);
  assert.equal(alignCollapsedIslandWidth(300, 820, 1), 300);
  for (const ratio of [1, 1.25, 1.5, 1.75, 2]) {
    for (let width = MIN_COLLAPSED_ISLAND_WIDTH; width <= MAX_COLLAPSED_ISLAND_WIDTH; width++) {
      const aligned = alignCollapsedIslandWidth(width, 820, ratio);
      assert.ok(Math.abs(aligned - width) <= 4, `${width} at ${ratio} -> ${aligned}`);
      assert.ok(aligned >= MIN_COLLAPSED_ISLAND_WIDTH && aligned <= MAX_COLLAPSED_ISLAND_WIDTH);
      assert.equal(Number.isInteger(leftEdge(aligned, ratio)), true, `${width} at ${ratio} -> ${aligned}`);
    }
  }
  assert.equal(alignCollapsedIslandWidth(301, 820, 1.13), 301);
});

test("a stored island position is rounded and invalid data is ignored", () => {
  withStorage([[ISLAND_POSITION_STORAGE_KEY, JSON.stringify({ x: 10.6, y: -3.2 })]], () => {
    assert.deepEqual(loadIslandPosition(), { x: 11, y: -3 });
  });
  for (const value of [JSON.stringify({ x: "1", y: 2 }), JSON.stringify({ x: 1 }), JSON.stringify({ x: Infinity, y: 0 }), "{bad"]) {
    withStorage([[ISLAND_POSITION_STORAGE_KEY, value]], () => assert.equal(loadIslandPosition(), null, value));
  }
  withStorage([], () => assert.equal(loadIslandPosition(), null));
});

test("pages and message sources that are switched off fall back to ones still on", async () => {
  const { isPageEnabled, resolveIslandPage, resolveMessageSource } = await import("../../src/windows/island/features.ts");
  const all = { todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true };
  assert.equal(resolveIslandPage("music", all), "music");
  assert.equal(resolveIslandPage("todo", { ...all, todo: false }), "music");
  assert.equal(resolveIslandPage("todo", { ...all, todo: false, music: false, clipboard: false }), "shelf");
  assert.equal(resolveIslandPage("todo", { ...all, todo: false, music: false, clipboard: false, shelf: false }), "qq");
  assert.equal(isPageEnabled("qq", { ...all, qq: false, wechat: false }), true);
  const none = { todo: false, music: false, clipboard: false, shelf: false, qq: false, wechat: false, qqMail: false };
  assert.equal(isPageEnabled("qq", none), false);
  assert.equal(resolveIslandPage("todo", none), null);
  assert.equal(resolveMessageSource("qq", { ...all, qq: false }), "wechat");
  assert.equal(resolveMessageSource("wechat", { ...all, qq: false, wechat: false }), "qqMail");
  assert.equal(resolveMessageSource("qqMail", none), "qqMail");
});

test("Alt+number follows the header from left to right and skips modules that are off", async () => {
  const { pageForAltDigit, pageShortcutLabel, cycleShortcutPage } = await import("../../src/windows/island/features.ts");
  const { pageDigitFromEvent, pageCycleDirection, normalizePageDigitModifiers, normalizePageCycleShortcut } = await import("../../src/features/appearance/pageShortcuts.ts");
  const all = { agents: true, todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: false, qqMail: false };
  assert.equal(pageForAltDigit(all, 1), "agents");
  assert.equal(pageForAltDigit(all, 2), "todo");
  assert.equal(pageForAltDigit(all, 5), "shelf");
  assert.equal(pageForAltDigit(all, 6), "qq");
  assert.equal(pageForAltDigit(all, 7), null);
  assert.equal(pageForAltDigit({ ...all, music: false, agents: false }, 1), "todo");
  assert.equal(pageForAltDigit({ ...all, music: false, agents: false }, 2), "clipboard");
  assert.equal(pageForAltDigit({ ...all, qq: false, wechat: true, agents: false, todo: false, music: false, clipboard: false, shelf: false }, 1), "qq");
  assert.equal(pageShortcutLabel({ ...all, agents: false }, "todo", "Ctrl"), "Ctrl+1");
  assert.equal(pageShortcutLabel({ ...all, todo: false }, "todo", "Alt"), null);
  assert.equal(cycleShortcutPage(all, "todo", 1), "music");
  assert.equal(cycleShortcutPage(all, "agents", -1), "qq");
  assert.equal(cycleShortcutPage({ ...all, music: false, clipboard: false, shelf: false, qq: false, wechat: false, qqMail: false }, "agents", 1), "todo");
  assert.equal(cycleShortcutPage({ ...all, todo: false, music: false, clipboard: false, shelf: false, qq: false, wechat: false, qqMail: false }, "agents", 1), null);
  const down = { altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, key: "4" };
  assert.equal(pageDigitFromEvent({ ...down, code: "Digit4" }, "Alt"), 4);
  assert.equal(pageDigitFromEvent({ ...down, code: "Digit4", ctrlKey: true, altKey: false }, "Ctrl"), 4);
  assert.equal(pageDigitFromEvent({ ...down, code: "Numpad4" }, "Alt"), null);
  assert.equal(pageDigitFromEvent({ ...down, code: "Digit1", repeat: true }, "Alt"), null);
  assert.equal(pageDigitFromEvent({ ...down, code: "Digit1", ctrlKey: true }, "Alt"), null);
  assert.equal(normalizePageDigitModifiers("shift+ctrl"), "Ctrl+Shift");
  assert.equal(normalizePageDigitModifiers("Win+Alt"), "Alt");
  assert.equal(normalizePageCycleShortcut("Alt+Tab", "Ctrl+Tab"), "Ctrl+Tab");
  assert.equal(normalizePageCycleShortcut("ctrl+shift+tab", "Ctrl+Tab"), "Ctrl+Shift+Tab");
  assert.equal(pageCycleDirection({ ...down, key: "Tab", code: "Tab", altKey: false, ctrlKey: true }, "Ctrl+Tab", "Ctrl+Shift+Tab"), 1);
  assert.equal(pageCycleDirection({ ...down, key: "Tab", code: "Tab", altKey: false, ctrlKey: true, shiftKey: true }, "Ctrl+Tab", "Ctrl+Shift+Tab"), -1);
  assert.equal(pageCycleDirection({ ...down, key: "Tab", code: "Tab" }, "Ctrl+Tab", "Ctrl+Shift+Tab"), null);
});

test("the translation page comes last in the page shortcuts, and only when it is an island page", async () => {
  const { pageForAltDigit, pageShortcutOrder } = await import("../../src/windows/island/features.ts");
  const all = { agents: true, todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true };
  assert.equal(pageShortcutOrder(all).includes("translation"), false);
  assert.equal(pageForAltDigit({ ...all, translation: true }, 7), "translation");
  assert.equal(pageForAltDigit({ ...all, translation: true }, 1), "agents");
});

test("pages the system lacks are switched off and the island skips them", async () => {
  const { withoutUnsupported, resolveIslandPage } = await import("../../src/windows/island/features.ts");
  const all = { todo: true, calendar: true, music: true, clipboard: true, shelf: true, screenshots: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true };
  const mac = withoutUnsupported(all, new Set(["music", "clipboard", "screenshot", "qq", "wechat", "translation"]));
  assert.equal(mac.music, false);
  assert.equal(mac.clipboard, false);
  assert.equal(mac.screenshots, false);
  assert.equal(mac.translation, false);
  assert.equal(mac.qqMail, true);
  assert.equal(resolveIslandPage("music", mac), "todo");
  assert.equal(withoutUnsupported(all, new Set()), all);
});

test("a first-run hint widens the island past the usual cap, up to 460px", async () => {
  const { getNoticeIslandWidth, MAX_COLLAPSED_ISLAND_WIDTH } = await import("../../src/windows/island/layout.ts");
  const long = getNoticeIslandWidth("Agent 会话显示在这里，点岛看全部", 200);
  assert.ok(long > MAX_COLLAPSED_ISLAND_WIDTH && long <= 460);
  assert.equal(getNoticeIslandWidth("短", 0), 280);
  assert.equal(getNoticeIslandWidth("x".repeat(200), 0, 12), 472);
});
