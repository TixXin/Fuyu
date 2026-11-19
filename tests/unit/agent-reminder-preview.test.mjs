import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_AGENT_SETTINGS } from "../../src/features/agent-status/agentSettings.ts";
import { focusedEvent, playSeconds, previewShow, previewStay, previewSwitch } from "../../src/features/agent-status/reminder-settings/previewEvents.ts";

const settings = (patch = {}) => ({ ...DEFAULT_AGENT_SETTINGS, agentAlertSeconds: 5, ...patch });

test("each pop-up switch decides whether its events show a card", () => {
  const off = settings({ agentAlertWaiting: false, agentAlertCompleted: false, agentAlertFailed: false });
  for (const event of ["approval", "question", "yourTurn", "done", "failed"]) {
    assert.equal(previewShow(event, settings({ agentAlertWaiting: true, agentAlertCompleted: true, agentAlertFailed: true })), "card", event);
    assert.equal(previewShow(event, off), "none", event);
  }
  assert.equal(previewShow("done", settings({ agentAlertWaiting: false, agentAlertCompleted: true })), "card");
  assert.equal(previewShow("stack", off), "card");
  assert.deepEqual(["approval", "question", "yourTurn"].map(previewSwitch), Array(3).fill("agentAlertWaiting"));
  assert.equal(previewSwitch("started"), null);
});

test("a new turn pops up, shows only its title, or shows nothing", () => {
  assert.equal(previewShow("started", settings({ agentAlertStarted: "everyTurn" })), "card");
  assert.equal(previewShow("started", settings({ agentAlertStarted: "newSession" })), "card");
  assert.equal(previewShow("started", settings({ agentAlertStarted: "off" })), "title");
  assert.equal(previewShow("started", settings({ agentAlertStarted: "hidden" })), "none");
});

test("how long each event stays follows its own setting", () => {
  const values = settings({ agentAlertSeconds: 8, agentNoticeYourTurnSeconds: 0, agentNoticeFailedSeconds: 30 });
  assert.equal(previewStay("approval", values), "handled");
  assert.equal(previewStay("question", values), "handled");
  assert.equal(previewStay("yourTurn", values), "looked");
  assert.equal(previewStay("yourTurn", { ...values, agentNoticeYourTurnSeconds: 15 }), 15);
  assert.equal(previewStay("failed", values), 30);
  assert.equal(previewStay("stack", { ...values, agentNoticeFailedSeconds: 0 }), "looked");
  assert.equal(previewStay("done", values), 8);
  assert.equal(previewStay("started", values), 8);
});

test("changing a setting moves the preview to an event that shows it", () => {
  assert.equal(focusedEvent("approval", ["agentNoticeMessageLines"]), "done");
  assert.equal(focusedEvent("yourTurn", ["agentNoticeMessageLines"]), "yourTurn");
  assert.equal(focusedEvent("done", ["agentNoticeButtonOrder"]), "approval");
  assert.equal(focusedEvent("question", ["agentNoticeShortcuts"]), "question");
  assert.equal(focusedEvent("approval", ["agentNoticeStack"]), "stack");
  assert.equal(focusedEvent("done", ["agentRemindSeconds"]), "approval");
  assert.equal(focusedEvent("approval", ["agentAlertStarted"]), "started");
  assert.equal(focusedEvent("failed", ["agentNoticeStyle"]), "failed");
  assert.equal(focusedEvent("failed", ["agentNoticeHoverHold", "agentNoticeClick"]), "failed");
});

test("a long stay is played back in at most six seconds", () => {
  assert.equal(playSeconds(3), 3);
  assert.equal(playSeconds(30), 6);
});
