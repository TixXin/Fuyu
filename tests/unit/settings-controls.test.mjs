import assert from "node:assert/strict";
import test from "node:test";
import { shortcutKeyCaps } from "../../src/utils/shortcutKeys.ts";
import { splitLead } from "../../src/utils/splitLead.ts";

test("shortcut labels split into one cap per key", () => {
  assert.deepEqual(shortcutKeyCaps("Ctrl+Shift+F"), ["Ctrl", "Shift", "F"]);
  assert.deepEqual(shortcutKeyCaps("⌃⇧F"), ["⌃", "⇧", "F"]);
  assert.deepEqual(shortcutKeyCaps("⌥1–9"), ["⌥", "1–9"]);
  assert.deepEqual(shortcutKeyCaps("Shift + Enter"), ["Shift", "Enter"]);
  assert.deepEqual(shortcutKeyCaps("Ctrl++"), ["Ctrl", "+"]);
  assert.deepEqual(shortcutKeyCaps("Esc"), ["Esc"]);
  assert.deepEqual(shortcutKeyCaps(""), []);
});

test("a footnote keeps its first sentence and folds the rest", () => {
  assert.deepEqual(splitLead("第一句。第二句。第三句。"), ["第一句。", "第二句。第三句。"]);
  assert.deepEqual(splitLead("Hold Ctrl and drag. It snaps near the top."), ["Hold Ctrl and drag.", "It snaps near the top."]);
  assert.deepEqual(splitLead("fuyu.ing has it all"), ["fuyu.ing has it all", ""]);
  assert.deepEqual(splitLead("只有一句。"), ["只有一句。", ""]);
});
