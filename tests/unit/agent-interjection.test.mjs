import assert from "node:assert/strict";
import test from "node:test";
import { phasesOf, trackWaiting } from "../../src/features/agent-status/alerts.ts";
import { interjectingSession, remindingSession } from "../../src/features/agent-status/interjection.ts";

const session = (sessionId, phase, updatedAt = 0, extra = {}) => ({
  provider: "claudeCode", sessionId, cwd: null, title: sessionId, model: null, effort: null,
  phase, lastMessage: null, updatedAt, host: null, turnStartedAt: null, ...extra,
});

test("lyrics give way for a moment when a session starts, finishes or fails", () => {
  const before = phasesOf([session("a", "running"), session("b", "completed")]);
  assert.equal(interjectingSession(null, [session("a", "completed")]), null);
  assert.equal(interjectingSession(before, [session("a", "completed", 5)])?.sessionId, "a");
  assert.equal(interjectingSession(before, [session("a", "failed", 5)])?.sessionId, "a");
  assert.equal(interjectingSession(before, [session("a", "running"), session("b", "completed"), session("c", "running", 9)])?.sessionId, "c");
});

test("start alerts set to hidden keep a new session's title off the collapsed bar, but not its finish", () => {
  const before = phasesOf([session("a", "running"), session("b", "completed")]);
  const started = [session("a", "running"), session("b", "completed"), session("c", "running", 9)];
  assert.equal(interjectingSession(before, started, "off")?.sessionId, "c");
  assert.equal(interjectingSession(before, started, "hidden"), null);
  assert.equal(interjectingSession(before, [session("a", "completed", 5)], "hidden")?.sessionId, "a");
});

test("nothing interrupts the lyrics while sessions just carry on", () => {
  const before = phasesOf([session("a", "running"), session("b", "completed")]);
  assert.equal(interjectingSession(before, [session("a", "running", 5), session("b", "completed")]), null);
  assert.equal(interjectingSession(before, [session("a", "running"), session("b", "running", 5)]), null);
  assert.equal(interjectingSession(before, [session("a", "running"), session("b", "completed"), session("c", "completed", 9)]), null);
  assert.equal(interjectingSession(before, [session("a", "completed", 5, { title: null })]), null);
});

test("several changes at once show the latest", () => {
  const before = phasesOf([session("a", "running"), session("b", "running")]);
  assert.equal(interjectingSession(before, [session("a", "completed", 7), session("b", "failed", 3)])?.sessionId, "a");
});

test("a session stopped on an approval or question interjects once, not until answered", () => {
  const before = phasesOf([session("a", "running")]);
  assert.equal(interjectingSession(before, [session("a", "waiting", 5)])?.sessionId, "a");
  const after = phasesOf([session("a", "waiting", 5)], before);
  assert.equal(interjectingSession(after, [session("a", "waiting", 6)]), null);
});

test("a session still waiting at the reminder time interjects once more, the latest when several are", () => {
  const state = { since: new Map(), reminded: new Set() };
  const waiting = [session("a", "waiting", 3), session("b", "waiting", 8), session("c", "running", 9)];
  trackWaiting(state, waiting, 0);
  assert.equal(remindingSession(state, waiting, 30_000, 60_000), null);
  assert.equal(remindingSession(state, waiting, 60_000, 60_000)?.sessionId, "b");
  assert.equal(remindingSession(state, waiting, 90_000, 60_000), null);
  assert.equal(remindingSession({ since: new Map(), reminded: new Set() }, waiting, 90_000, 0), null);
});

test("a finished turn whose reply asks something shows for a moment, not until answered", () => {
  const asked = session("a", "completed", 5, { replyMarker: "yourTurn" });
  assert.equal(interjectingSession(phasesOf([session("a", "running")]), [asked])?.sessionId, "a");
});
