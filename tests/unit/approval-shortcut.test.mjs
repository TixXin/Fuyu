import assert from "node:assert/strict";
import test from "node:test";
import { ariaShortcut, shortcutKey, shortcutModifiers, shortcutTitle } from "../../src/features/agent-status/approvals/approvalShortcutText.ts";

test("approval shortcuts read as Mac symbols on a Mac and stay as written on Windows", () => {
  assert.equal(shortcutKey("Ctrl+Alt+Y"), "Y");
  assert.equal(shortcutModifiers("Ctrl+Alt+Y", true), "⌃⌥");
  assert.equal(shortcutModifiers("Ctrl+Alt+Y", false), "Ctrl+Alt+");
  assert.equal(shortcutTitle("Ctrl+Alt+T", true), "⌃⌥T");
  assert.equal(shortcutTitle("Ctrl+Alt+T", false), "Ctrl+Alt+T");
  assert.equal(shortcutModifiers("Y", true), "");
});

test("screen readers get the standard key names", () => {
  assert.equal(ariaShortcut("Ctrl+Alt+Y"), "Control+Alt+Y");
  assert.equal(ariaShortcut("Shift+Win+V"), "Shift+Meta+V");
  assert.equal(ariaShortcut(undefined), undefined);
});
