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

test("a sideways swipe turns one page and the rest of the gesture does nothing", async () => {
  const { IDLE_SWIPE, swipeStep, SWIPE_QUIET_MS } = await import("../../src/windows/island/pageSwipe.ts");
  let state = IDLE_SWIPE;
  const turns = [];
  for (let at = 0; at < 400; at += 16) {
    const step = swipeStep(state, 12, 1, at);
    state = step.state;
    if (step.turn !== null) turns.push(step.turn);
  }
  assert.deepEqual(turns, [1]);
  const again = swipeStep(state, -120, 0, 400 + SWIPE_QUIET_MS + 1);
  assert.equal(again.turn, -1);
});

test("on a Mac trackpad a second swipe turns again while the first one's momentum is still dying out", async () => {
  const { IDLE_SWIPE, swipeStep } = await import("../../src/windows/island/pageSwipe.ts");
  const swipe = [2, 6, 12, 20, 26, 22, 16];
  const momentum = [12, 10, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1];
  const replay = (deltas) => {
    let state = IDLE_SWIPE;
    const turns = [];
    deltas.forEach((dx, index) => {
      const step = swipeStep(state, dx, 0, index * 16);
      state = step.state;
      if (step.turn !== null) turns.push(step.turn);
    });
    return turns;
  };
  assert.deepEqual(replay([...swipe, ...momentum]), [1], "the momentum after one swipe never turns a second page");
  assert.deepEqual(replay([...swipe, ...momentum, ...swipe, ...momentum]), [1, 1], "swiping again before the momentum stops still turns");
  assert.deepEqual(replay([...swipe, ...momentum.slice(0, 4), ...swipe.map((dx) => -dx)]), [1, -1], "swiping back the other way turns back at once");
  assert.deepEqual(replay([2, 6, 12, 20, 26, 14, 9, 7, 12, 18, 22, 20, 16, 12, 8]), [1], "a swipe that slows a little and speeds up again is still one swipe");
});

test("a mostly vertical scroll never turns the page", async () => {
  const { IDLE_SWIPE, swipeStep } = await import("../../src/windows/island/pageSwipe.ts");
  let state = IDLE_SWIPE;
  let turned = false;
  for (let at = 0; at < 400; at += 16) {
    const step = swipeStep(state, 10, 40, at);
    state = step.state;
    turned ||= step.turn !== null;
  }
  assert.equal(turned, false);
});

test("pageSwipe is on unless switched off", () => {
  assert.equal(normalizeSettings({}).pageSwipe, true);
  assert.equal(normalizeSettings({ pageSwipe: false }).pageSwipe, false);
});
