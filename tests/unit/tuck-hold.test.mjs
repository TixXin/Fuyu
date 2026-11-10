import assert from "node:assert/strict";
import test from "node:test";
import { holdsTuck } from "../../src/windows/island/tuckHold.ts";
import { normalizeSettings } from "../../src/features/appearance/settings.ts";

const idle = { todoInProgress: false, agentWaiting: false, musicPlaying: false };

test("by default a todo in progress or an agent waiting keeps the island out, music does not (issue #29)", () => {
  const settings = normalizeSettings({});
  assert.equal(settings.autoTuckHoldTodo, true);
  assert.equal(settings.autoTuckHoldAgent, true);
  assert.equal(settings.autoTuckHoldMusic, false);
  assert.equal(holdsTuck(settings, idle), false);
  assert.equal(holdsTuck(settings, { ...idle, todoInProgress: true }), true);
  assert.equal(holdsTuck(settings, { ...idle, agentWaiting: true }), true);
  assert.equal(holdsTuck(settings, { ...idle, musicPlaying: true }), false);
});

test("each hold follows its switch and its feature", () => {
  const settings = normalizeSettings({ autoTuckHoldMusic: true, autoTuckHoldTodo: false });
  assert.equal(holdsTuck(settings, { ...idle, musicPlaying: true }), true);
  assert.equal(holdsTuck(settings, { ...idle, todoInProgress: true }), false);
  assert.equal(holdsTuck({ ...settings, musicEnabled: false }, { ...idle, musicPlaying: true }), false);
  assert.equal(holdsTuck({ ...settings, agentStatusEnabled: false }, { ...idle, agentWaiting: true }), false);
});
