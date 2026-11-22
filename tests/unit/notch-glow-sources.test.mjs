import assert from "node:assert/strict";
import { test } from "node:test";
import { agentGlow, justCompleted, sessionPhases } from "../../src/features/agent-status/plugin/agentGlow.ts";
import { playbackContribution } from "../../src/features/media/plugin/playbackContribution.ts";
import { messageGlowColor } from "../../src/features/messages/messageGlow.ts";

const session = (sessionId, phase) => ({ provider: "claude", sessionId, phase });

test("an agent counts as just done only when it moves from working to completed", () => {
  const running = sessionPhases([session("a", "running"), session("b", "completed")]);
  assert.equal(justCompleted(running, sessionPhases([session("a", "completed"), session("b", "completed")])), true);
  assert.equal(justCompleted(running, sessionPhases([session("a", "running"), session("b", "completed")])), false);
  assert.equal(justCompleted(new Map(), sessionPhases([session("c", "completed")])), false);
  assert.equal(justCompleted(sessionPhases([session("a", "waiting")]), sessionPhases([session("a", "failed")])), false);
});

test("waiting outranks a fresh completion and pulses", () => {
  assert.equal(agentGlow(true, true).reason, "agent-status.waiting");
  assert.equal(agentGlow(true, false).pulse, true);
  assert.equal(agentGlow(false, true).reason, "agent-status.done");
  assert.equal(agentGlow(false, false), null);
});

test("playback is only written while playing a track with a length", () => {
  const base = { playbackStatus: "playing", positionMs: 30_000, durationMs: 180_000, updatedAt: 1_000_000 };
  assert.deepEqual(playbackContribution(base), { kind: "playback", startedAt: 970_000, durationMs: 180_000 });
  assert.equal(playbackContribution({ ...base, playbackStatus: "paused" }), null);
  assert.equal(playbackContribution({ ...base, durationMs: 0 }), null);
  assert.equal(playbackContribution({ ...base, updatedAt: 1_000_120, positionMs: 30_120 }).startedAt, 970_000);
});

test("every message source has its own glow colour and unknown ones fall back", () => {
  assert.equal(messageGlowColor("qq"), "#12b7f5");
  assert.equal(messageGlowColor("wechat"), "#07c160");
  assert.match(messageGlowColor("nope"), /^#[0-9a-f]{6}$/);
});
