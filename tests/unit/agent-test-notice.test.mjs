import assert from "node:assert/strict";
import test from "node:test";
import { pruneNotices } from "../../src/features/agent-status/noticeDwell.ts";
import { previewSamples } from "../../src/features/agent-status/reminder-settings/previewSamples.ts";
import { PREVIEW_EVENTS } from "../../src/features/agent-status/reminder-settings/previewEvents.ts";
import { zhCN } from "../../src/i18n/sections/settings/agentNotice.ts";
import {
  TEST_HANDLED_MS,
  isTestSession,
  readTestNoticeRequest,
  readTestNoticeResult,
  stampTestNotice,
  testNoticeBlock,
  testNoticeRequest,
  testNotices,
} from "../../src/features/agent-status/testNotice.ts";

const samples = previewSamples(zhCN.preview.sample);
const DWELL = { completedMs: 5000, yourTurnMs: 0, failedMs: 0, hoverHold: true };
const NOW = 1_000_000;
const stamped = (event, id = 7) => stampTestNotice(testNoticeRequest(event, samples, id), NOW);
const real = { session: { sessionId: "real-session" } };

test("every kind of notice becomes the alert the island would raise for it", () => {
  const kinds = Object.fromEntries(PREVIEW_EVENTS.map((event) => [event, stamped(event).alerts.map((alert) => alert.kind).join()]));
  assert.deepEqual(kinds, {
    approval: "waiting",
    question: "waiting",
    yourTurn: "waiting",
    done: "completed",
    failed: "failed",
    started: "started",
    stack: "failed,waiting,completed",
  });
});

test("a test notice never carries a session id or a request id a real agent could own", () => {
  for (const event of PREVIEW_EVENTS) {
    const { alerts, request } = stamped(event);
    assert.ok(alerts.every((alert) => isTestSession(alert.session)), event);
    assert.equal(new Set(alerts.map((alert) => alert.session.sessionId)).size, alerts.length, event);
    if (event !== "approval" && event !== "question") {
      assert.equal(request, null, event);
      continue;
    }
    assert.ok(request.id < 0, event);
    assert.equal(request.sessionId, alerts[0].session.sessionId, event);
    assert.equal(request.agent, alerts[0].session.provider, event);
  }
  assert.equal(isTestSession(samples.sessions.done), false);
  assert.notEqual(stamped("done", 7).alerts[0].session.sessionId, stamped("done", 8).alerts[0].session.sessionId);
});

test("a test that waits for an answer closes by itself, the others stay as the settings say", () => {
  const waiting = testNotices(stamped("approval").alerts, DWELL, NOW);
  assert.equal(pruneNotices(waiting, [], () => true, NOW + TEST_HANDLED_MS - 1).length, 1);
  assert.equal(pruneNotices(waiting, [], () => true, NOW + TEST_HANDLED_MS).length, 0);

  const done = testNotices(stamped("done").alerts, DWELL, NOW);
  assert.equal(pruneNotices(done, [], () => true, NOW + 4999).length, 1);
  assert.equal(pruneNotices(done, [], () => true, NOW + 5000).length, 0);

  const failed = testNotices(stamped("failed").alerts, DWELL, NOW);
  assert.equal(failed[0].stay, "looked");
  assert.equal(pruneNotices(failed, [], () => true, NOW + 600_000).length, 1);
});

test("a test notice gives way to quiet mode, to a real notice and to an island in use", () => {
  const test = testNotices(stamped("done").alerts, DWELL, NOW);
  assert.equal(testNoticeBlock([], false, true), "muted");
  assert.equal(testNoticeBlock([real], true, false), "busy");
  assert.equal(testNoticeBlock([...test, real], true, false), "busy");
  assert.equal(testNoticeBlock([], true, false), "expanded");
  assert.equal(testNoticeBlock([], true, true), null);
  assert.equal(testNoticeBlock(test, true, false), null);
});

test("what crosses between the two windows is checked before it is used", () => {
  const request = testNoticeRequest("approval", samples, 3);
  assert.deepEqual(readTestNoticeRequest(JSON.parse(JSON.stringify(request))), request);
  assert.equal(readTestNoticeRequest({ ...request, event: "reboot" }), null);
  assert.equal(readTestNoticeRequest({ ...request, sessions: [] }), null);
  assert.equal(readTestNoticeRequest({ ...request, sessions: [{ provider: "codex" }] }), null);
  assert.equal(readTestNoticeRequest({ ...request, id: "3" }), null);
  assert.equal(readTestNoticeRequest({ ...request, request: { kind: "shell" } })?.request, null);
  assert.equal(readTestNoticeRequest(null), null);
  assert.deepEqual(readTestNoticeResult({ id: 3, outcome: "busy", extra: 1 }), { id: 3, outcome: "busy" });
  assert.equal(readTestNoticeResult({ id: 3, outcome: "done" }), null);
});
