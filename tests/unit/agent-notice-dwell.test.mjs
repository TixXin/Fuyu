import assert from "node:assert/strict";
import test from "node:test";
import { AFTER_HOVER_MS, addNotices, hoverNotices, noticeStay, pruneNotices, sortNotices } from "../../src/features/agent-status/noticeDwell.ts";

const session = (sessionId, phase, replyMarker = null) => ({
  provider: "claudeCode", sessionId, cwd: null, title: sessionId, model: null, effort: null,
  phase, lastMessage: null, updatedAt: 0, host: null, turnStartedAt: null, replyMarker,
});
const DEFAULTS = { completedMs: 3000, yourTurnMs: 0, failedMs: 0, hoverHold: true };
const never = () => false;
const keys = (entries) => entries.map((entry) => entry.session.sessionId);

test("each state stays as long as the defaults recommend", () => {
  assert.equal(noticeStay("waiting", session("a", "waiting"), DEFAULTS), "handled");
  assert.equal(noticeStay("waiting", session("a", "completed", "yourTurn"), DEFAULTS), "looked");
  assert.equal(noticeStay("failed", session("a", "failed"), DEFAULTS), "looked");
  assert.equal(noticeStay("completed", session("a", "completed"), DEFAULTS), 3000);
  const timed = { ...DEFAULTS, yourTurnMs: 15_000, failedMs: 10_000 };
  assert.equal(noticeStay("waiting", session("a", "completed", "yourTurn"), timed), 15_000);
  assert.equal(noticeStay("failed", session("a", "failed"), timed), 10_000);
  assert.equal(noticeStay("waiting", session("a", "waiting"), timed), "handled");
});

test("the stack puts needs-approval, then failed, then your turn, then completed, newest first within a state", () => {
  const alerts = [
    { kind: "completed", session: session("done", "completed") },
    { kind: "waiting", session: session("turn", "completed", "yourTurn") },
    { kind: "failed", session: session("bad", "failed") },
    { kind: "waiting", session: session("ask", "waiting") },
  ];
  let entries = addNotices([], alerts, DEFAULTS, 0);
  entries = addNotices(entries, [{ kind: "completed", session: session("done2", "completed") }], DEFAULTS, 100);
  assert.deepEqual(keys(sortNotices(entries)), ["ask", "bad", "turn", "done2", "done"]);
  entries = addNotices(entries, [{ kind: "failed", session: session("done", "failed") }], DEFAULTS, 200);
  assert.deepEqual(keys(sortNotices(entries)), ["ask", "done", "bad", "turn", "done2"], "a session alerting again replaces its old entry");
});

test("a timed notice goes when its time is up; hovering pauses it and leaves at least 2 seconds", () => {
  const sessions = [session("a", "completed")];
  let entries = addNotices([], [{ kind: "completed", session: sessions[0] }], DEFAULTS, 0);
  assert.equal(pruneNotices(entries, sessions, never, 2999).length, 1);
  assert.equal(pruneNotices(entries, sessions, never, 3000).length, 0);

  entries = hoverNotices(entries, true, 2500, DEFAULTS);
  assert.equal(pruneNotices(entries, sessions, never, 20_000).length, 1, "the countdown stops while hovered");
  entries = hoverNotices(entries, false, 20_000, DEFAULTS);
  assert.equal(pruneNotices(entries, sessions, never, 20_000 + AFTER_HOVER_MS - 1).length, 1);
  assert.equal(pruneNotices(entries, sessions, never, 20_000 + AFTER_HOVER_MS).length, 0, "500 ms were left, so it stays the 2-second minimum");

  let long = addNotices([], [{ kind: "completed", session: sessions[0] }], { ...DEFAULTS, completedMs: 10_000 }, 0);
  long = hoverNotices(long, true, 1000, DEFAULTS);
  long = hoverNotices(long, false, 4000, DEFAULTS);
  assert.equal(pruneNotices(long, sessions, never, 12_999).length, 1, "the rest of the time carries on after the pause");
  assert.equal(pruneNotices(long, sessions, never, 13_000).length, 0);
});

test("with hover hold off, hovering does not stop the countdown", () => {
  const off = { ...DEFAULTS, hoverHold: false };
  const sessions = [session("a", "completed")];
  let entries = addNotices([], [{ kind: "completed", session: sessions[0] }], off, 0);
  entries = hoverNotices(entries, true, 1000, off);
  assert.equal(pruneNotices(entries, sessions, never, 3000).length, 0);
});

test("a hover stuck on for more than 30 seconds stops pausing", () => {
  const sessions = [session("a", "completed")];
  let entries = addNotices([], [{ kind: "completed", session: sessions[0] }], DEFAULTS, 0);
  entries = hoverNotices(entries, true, 1000, DEFAULTS);
  assert.equal(pruneNotices(entries, sessions, never, 32_999).length, 1);
  assert.equal(pruneNotices(entries, sessions, never, 33_000).length, 0);
});

test("needs-approval stays until the session stops waiting, whatever the time or hover", () => {
  const waiting = [session("a", "waiting")];
  let entries = addNotices([], [{ kind: "waiting", session: waiting[0] }], DEFAULTS, 0);
  entries = hoverNotices(hoverNotices(entries, true, 10, DEFAULTS), false, 20, DEFAULTS);
  assert.equal(pruneNotices(entries, waiting, never, 10 * 60_000).length, 1);
  assert.equal(pruneNotices(entries, [session("a", "running")], never, 30).length, 0);
  assert.equal(pruneNotices(entries, [], never, 30).length, 0, "a session that went away is handled too");
});

test("0 seconds keeps a notice until it is looked at: hovered, or its window brought to front", () => {
  const failed = [session("a", "failed")];
  let unseen = true;
  const isUnseen = () => unseen;
  let entries = addNotices([], [{ kind: "failed", session: failed[0] }], DEFAULTS, 0);
  entries = pruneNotices(entries, failed, isUnseen, 60_000);
  assert.equal(entries.length, 1, "still there a minute later");
  unseen = false;
  assert.equal(pruneNotices(entries, failed, isUnseen, 60_100).length, 0, "switching to its window counts as looked");

  const turn = [session("b", "completed", "yourTurn")];
  let hovered = addNotices([], [{ kind: "waiting", session: turn[0] }], DEFAULTS, 0);
  hovered = hoverNotices(hovered, true, 5000, DEFAULTS);
  assert.equal(pruneNotices(hovered, turn, () => true, 50_000).length, 1, "stays while the pointer is on it");
  hovered = hoverNotices(hovered, false, 50_000, DEFAULTS);
  assert.equal(pruneNotices(hovered, turn, () => true, 50_000 + AFTER_HOVER_MS - 1).length, 1);
  assert.equal(pruneNotices(hovered, turn, () => true, 50_000 + AFTER_HOVER_MS).length, 0, "goes 2 seconds after the pointer leaves");
});

test("only the notice on top counts as hovered", () => {
  const sessions = [session("bad", "failed"), session("turn", "completed", "yourTurn")];
  let entries = addNotices([], [{ kind: "failed", session: sessions[0] }, { kind: "waiting", session: sessions[1] }], DEFAULTS, 0);
  entries = hoverNotices(hoverNotices(entries, true, 100, DEFAULTS), false, 200, DEFAULTS);
  const left = pruneNotices(entries, sessions, () => true, 200 + AFTER_HOVER_MS);
  assert.deepEqual(keys(left), ["turn"]);
});

test("a notice keeps showing the latest state of its session", () => {
  const before = session("a", "completed");
  const entries = addNotices([], [{ kind: "completed", session: before }], DEFAULTS, 0);
  const after = { ...before, lastMessage: "newer" };
  assert.equal(pruneNotices(entries, [after], never, 10)[0].session, after);
  assert.equal(pruneNotices(entries, [], never, 10)[0].session, before);
});
