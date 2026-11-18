import assert from "node:assert/strict";
import test from "node:test";
import {
  finishCloseHold,
  finishDeferredOpen,
  initialPanelAwakeState,
  isPanelAwake,
  PREWARM_HOLD_MS,
  PREWARM_LEAVE_MS,
  syncPanelAwakeState,
} from "../../src/windows/island/panelAwake.ts";

test("collapsed startup stays awake while preparing and hibernates once preparation ends", () => {
  const startInput = {
    isExpanded: false,
    isPreparing: true,
    isPrewarmed: false,
    deferColdOpen: true,
    closeHoldMs: 550,
  };
  let state = initialPanelAwakeState(startInput);
  assert.equal(isPanelAwake(state, startInput), true);

  const settledInput = { ...startInput, isPreparing: false };
  state = syncPanelAwakeState(state, settledInput);
  assert.equal(isPanelAwake(state, settledInput), false);
});

test("pointer prewarm wakes the collapsed panel early and keeps it mounted across expand without cold deferral", () => {
  assert.equal(PREWARM_HOLD_MS >= 800, true);
  assert.equal(PREWARM_LEAVE_MS > 0 && PREWARM_LEAVE_MS < PREWARM_HOLD_MS, true);

  const idleInput = {
    isExpanded: false,
    isPreparing: false,
    isPrewarmed: false,
    deferColdOpen: true,
    closeHoldMs: 550,
  };
  let state = initialPanelAwakeState(idleInput);
  assert.equal(isPanelAwake(state, idleInput), false);

  const warmInput = { ...idleInput, isPrewarmed: true };
  state = syncPanelAwakeState(state, warmInput);
  assert.equal(isPanelAwake(state, warmInput), true);

  const expandedInput = { ...idleInput, isExpanded: true, isPrewarmed: false };
  state = syncPanelAwakeState(state, expandedInput);
  assert.equal(state.deferringOpen, false);
  assert.equal(isPanelAwake(state, expandedInput), true);
});

test("unexpanded pointer prewarm returns to hibernation once the prewarm window expires", () => {
  const warmInput = {
    isExpanded: false,
    isPreparing: false,
    isPrewarmed: true,
    deferColdOpen: true,
    closeHoldMs: 550,
  };
  let state = initialPanelAwakeState(warmInput);
  assert.equal(isPanelAwake(state, warmInput), true);

  const expiredInput = { ...warmInput, isPrewarmed: false };
  state = syncPanelAwakeState(state, expiredInput);
  assert.equal(isPanelAwake(state, expiredInput), false);
});

test("cold expand defers panel mounting on frame 0 so the shell morph starts unblocked, then mounts on frame 1", () => {
  const idleInput = {
    isExpanded: false,
    isPreparing: false,
    isPrewarmed: false,
    deferColdOpen: true,
    closeHoldMs: 550,
  };
  let state = initialPanelAwakeState(idleInput);
  assert.equal(isPanelAwake(state, idleInput), false);

  const coldOpenInput = { ...idleInput, isExpanded: true };
  state = syncPanelAwakeState(state, coldOpenInput);
  assert.equal(state.deferringOpen, true);
  assert.equal(isPanelAwake(state, coldOpenInput), false);

  state = finishDeferredOpen(state);
  assert.equal(state.deferringOpen, false);
  assert.equal(isPanelAwake(state, coldOpenInput), true);
});

test("cold expand mounts immediately on frame 0 when motion is disabled or reduced", () => {
  const idleInput = {
    isExpanded: false,
    isPreparing: false,
    isPrewarmed: false,
    deferColdOpen: false,
    closeHoldMs: 0,
  };
  let state = initialPanelAwakeState(idleInput);
  const openInput = { ...idleInput, isExpanded: true };
  state = syncPanelAwakeState(state, openInput);
  assert.equal(state.deferringOpen, false);
  assert.equal(isPanelAwake(state, openInput), true);
});

test("closing holds the panel mounted until the close transition finishes and skips cold deferral if reopened mid-close", () => {
  const openInput = {
    isExpanded: true,
    isPreparing: false,
    isPrewarmed: false,
    deferColdOpen: true,
    closeHoldMs: 550,
  };
  let state = initialPanelAwakeState(openInput);
  assert.equal(isPanelAwake(state, openInput), true);

  const closingInput = { ...openInput, isExpanded: false };
  state = syncPanelAwakeState(state, closingInput);
  assert.equal(state.closing, true);
  assert.equal(isPanelAwake(state, closingInput), true);

  const reopenedMidClose = syncPanelAwakeState(state, openInput);
  assert.equal(reopenedMidClose.deferringOpen, false);
  assert.equal(isPanelAwake(reopenedMidClose, openInput), true);

  state = finishCloseHold(state, closingInput);
  assert.equal(state.closing, false);
  assert.equal(isPanelAwake(state, closingInput), false);
});
