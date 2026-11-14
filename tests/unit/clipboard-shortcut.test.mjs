import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CLIPBOARD_SHORTCUT,
  buildShortcutFromEvent,
  isPrimaryKey,
  matchesClipboardShortcut,
  normalizeClipboardShortcut,
  normalizeShortcutKeyLabel,
  openShortcutLabel,
} from "../../src/features/clipboard/shortcut.ts";
import { DEFAULT_CLIPBOARD_HISTORY, normalizeClipboardSettings } from "../../src/features/clipboard/settings.ts";

const key = (k, mods = {}) => ({ key: k, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });

test("key labels are normalized for display", () => {
  assert.equal(normalizeShortcutKeyLabel("v"), "V");
  assert.equal(normalizeShortcutKeyLabel("Spacebar"), "Space");
  assert.equal(normalizeShortcutKeyLabel(" "), "Space");
  assert.equal(normalizeShortcutKeyLabel("Escape"), "Esc");
  assert.equal(normalizeShortcutKeyLabel("ArrowLeft"), "Left");
  assert.equal(normalizeShortcutKeyLabel("F5"), "F5");
});

test("shortcuts are built from key events in a fixed modifier order", () => {
  assert.equal(buildShortcutFromEvent(key("v", { ctrlKey: true, shiftKey: true })), "Ctrl+Shift+V");
  assert.equal(buildShortcutFromEvent(key("x", { metaKey: true, altKey: true, ctrlKey: true })), "Ctrl+Alt+Win+X");
  assert.equal(buildShortcutFromEvent(key(" ", { ctrlKey: true })), "Ctrl+Space", "the space key records as Space");
  assert.equal(buildShortcutFromEvent(key("x")), null, "a shortcut needs a modifier");
  assert.equal(buildShortcutFromEvent(key("Control", { ctrlKey: true })), null, "a lone modifier is not a shortcut");
});

test("stored shortcuts are normalized, falling back to the default", () => {
  assert.equal(normalizeClipboardShortcut(" shift + control + v "), "Ctrl+Shift+V");
  assert.equal(normalizeClipboardShortcut("cmd+option+Space"), "Alt+Win+Space");
  assert.equal(normalizeClipboardShortcut("Ctrl+A+B"), "Ctrl+A");
  for (const value of [undefined, "", "   ", "V", "Ctrl+Shift"]) {
    assert.equal(normalizeClipboardShortcut(value), DEFAULT_CLIPBOARD_SHORTCUT, String(value));
  }
});

test("the shortcut matches key events except inside editable fields", () => {
  const saved = { HTMLElement: globalThis.HTMLElement, HTMLInputElement: globalThis.HTMLInputElement, HTMLTextAreaElement: globalThis.HTMLTextAreaElement, HTMLSelectElement: globalThis.HTMLSelectElement };
  class HTMLElement { isContentEditable = false; }
  class HTMLInputElement extends HTMLElement {}
  class HTMLTextAreaElement extends HTMLElement {}
  class HTMLSelectElement extends HTMLElement {}
  Object.assign(globalThis, { HTMLElement, HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement });
  try {
    const event = (target) => ({ ...key("x", { ctrlKey: true }), target });
    assert.equal(matchesClipboardShortcut(event(null), "Ctrl+X"), true);
    assert.equal(matchesClipboardShortcut(event(new HTMLElement()), "ctrl + x"), true);
    assert.equal(matchesClipboardShortcut(event(new HTMLElement()), "Ctrl+V"), false);
    assert.equal(matchesClipboardShortcut({ ...key(" ", { ctrlKey: true }), target: null }, "Ctrl+Space"), true);
    assert.equal(matchesClipboardShortcut(event(new HTMLInputElement()), "Ctrl+X"), false);
    assert.equal(matchesClipboardShortcut(event(new HTMLTextAreaElement()), "Ctrl+X"), false);
    const editable = new HTMLElement();
    editable.isContentEditable = true;
    assert.equal(matchesClipboardShortcut(event(editable), "Ctrl+X"), false);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});

test("clipboard settings clamp the item limit and normalize the shortcut", () => {
  const base = DEFAULT_CLIPBOARD_HISTORY.settings;
  assert.deepEqual(normalizeClipboardSettings(base), base);
  assert.equal(normalizeClipboardSettings({ ...base, maxItems: 2 }).maxItems, 5);
  assert.equal(normalizeClipboardSettings({ ...base, maxItems: 999 }).maxItems, 200);
  assert.equal(normalizeClipboardSettings({ ...base, maxItems: 42.6 }).maxItems, 43);
  assert.equal(normalizeClipboardSettings({ ...base, shortcut: "alt+shift+c" }).shortcut, "Alt+Shift+C");
  assert.equal(normalizeClipboardSettings({ ...base, shortcutEnabled: undefined }).shortcutEnabled, true);
  assert.equal(normalizeClipboardSettings({ ...base, shortcutEnabled: false }).shortcutEnabled, false);
});

test("the clipboard window takes Command as well as Control on macOS only", () => {
  assert.equal(isPrimaryKey(key("i", { ctrlKey: true }), false), true);
  assert.equal(isPrimaryKey(key("i", { metaKey: true }), false), false);
  assert.equal(isPrimaryKey(key("i", { metaKey: true }), true), true);
  assert.equal(isPrimaryKey(key("i", { ctrlKey: true }), true), true);
  assert.equal(isPrimaryKey(key("i"), true), false);
});

test("recorded shortcuts use the physical key, not the character Option or Shift typed", () => {
  assert.equal(buildShortcutFromEvent({ ...key("†", { ctrlKey: true, altKey: true }), code: "KeyT" }), "Ctrl+Alt+T");
  assert.equal(buildShortcutFromEvent({ ...key("!", { ctrlKey: true, shiftKey: true }), code: "Digit1" }), "Ctrl+Shift+1");
  assert.equal(buildShortcutFromEvent({ ...key("Dead", { altKey: true }), code: "KeyE" }), "Alt+E");
  assert.equal(buildShortcutFromEvent({ ...key("F5", { ctrlKey: true }), code: "F5" }), "Ctrl+F5");
});

test("the shortcut shown for opening the clipboard is Win+V when it is taken, otherwise the own shortcut", () => {
  const settings = { shortcut: "Ctrl+Shift+W", shortcutEnabled: true, winV: false };
  assert.equal(openShortcutLabel(settings, false), "Ctrl+Shift+W");
  assert.equal(openShortcutLabel({ ...settings, winV: true }, false), "Win+V");
  assert.equal(openShortcutLabel({ ...settings, winV: true, shortcutEnabled: false }, false), "Win+V");
  assert.equal(openShortcutLabel({ ...settings, shortcutEnabled: false }, false), null);
  assert.equal(openShortcutLabel({ shortcut: "Shift+Win+V", shortcutEnabled: true, winV: true }, true), "⇧⌘V");
  assert.equal(openShortcutLabel({ shortcut: "Shift+Win+V", shortcutEnabled: false, winV: true }, true), null);
});
