import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";
import { EDITABLE_TARGET, pageArrowAction, pageArrowTargetAllows } from "../../src/windows/island/pageArrows.ts";

const key = (name, overrides) => ({
  key: name,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  ...overrides,
});

test("in the panel left and right turn the page and up closes it", () => {
  assert.equal(pageArrowAction(key("ArrowLeft"), true), "previous");
  assert.equal(pageArrowAction(key("ArrowRight"), true), "next");
  assert.equal(pageArrowAction(key("ArrowUp"), true), "collapse");
  assert.equal(pageArrowAction(key("ArrowDown"), true), null);
  assert.equal(pageArrowAction(key("Enter"), true), null);
});

test("on the collapsed island down and enter open it and nothing else does", () => {
  assert.equal(pageArrowAction(key("ArrowDown"), false), "open");
  assert.equal(pageArrowAction(key("Enter"), false), "open");
  assert.equal(pageArrowAction(key("ArrowUp"), false), null);
  assert.equal(pageArrowAction(key("ArrowRight"), false), null);
});

test("modifier combinations stay with the shortcuts that own them", () => {
  for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) {
    assert.equal(pageArrowAction(key("ArrowRight", { [modifier]: true }), true), null, modifier);
    assert.equal(pageArrowAction(key("ArrowDown", { [modifier]: true }), false), null, modifier);
  }
});

test("a held key turns only one page", () => {
  assert.equal(pageArrowAction(key("ArrowRight", { repeat: true }), true), null);
});

test("keys a control already handled or the IME is composing are left alone", () => {
  assert.equal(pageArrowAction(key("ArrowUp", { defaultPrevented: true }), true), null);
  assert.equal(pageArrowAction(key("ArrowLeft", { isComposing: true }), true), null);
  assert.equal(pageArrowAction(key("Enter", { isComposing: true }), false), null);
});

test("page arrows and arrow keys are on unless switched off", () => {
  assert.equal(normalizeSettings({}).pageArrows, true);
  assert.equal(normalizeSettings({}).pageArrowKeys, true);
  assert.equal(normalizeSettings({ pageArrows: false }).pageArrows, false);
  assert.equal(normalizeSettings({ pageArrowKeys: false }).pageArrowKeys, false);
  assert.equal(normalizeSettings({ pageArrows: "no" }).pageArrows, true);
});

const focusedIn = (field) => ({ closest: (selector) => (selector === EDITABLE_TARGET ? field : null) });
const textarea = (value) => ({ tagName: "TEXTAREA", value, textContent: "" });

test("an empty text box does not stop the page arrows, a filled one keeps its keys", () => {
  assert.equal(pageArrowTargetAllows("next", "ArrowRight", focusedIn(textarea(""))), true);
  assert.equal(pageArrowTargetAllows("collapse", "ArrowUp", focusedIn(textarea(""))), true);
  assert.equal(pageArrowTargetAllows("next", "ArrowRight", focusedIn(textarea("hello"))), false);
  assert.equal(pageArrowTargetAllows("previous", "ArrowLeft", focusedIn({ tagName: "INPUT", type: "text", value: "a", textContent: "" })), false);
});

test("fields whose arrows change a value keep them even when empty", () => {
  assert.equal(pageArrowTargetAllows("next", "ArrowRight", focusedIn({ tagName: "INPUT", type: "number", value: "", textContent: "" })), false);
  assert.equal(pageArrowTargetAllows("next", "ArrowRight", focusedIn({ tagName: "SELECT", value: "", textContent: "" })), false);
});
