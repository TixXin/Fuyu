import assert from "node:assert/strict";
import test from "node:test";
import { alertTag, freshAlerts, islandHiddenByFullscreen, phasesOf } from "../../src/features/agent-status/fullscreenAlerts.ts";

const session = (sessionId, phase, extra = {}) => ({ provider: "claudeCode", sessionId, phase, title: "修复登录", cwd: null, model: null, effort: null, lastMessage: null, updatedAt: 0, host: null, turnStartedAt: null, ...extra });
const tuck = { gameAutoTuck: true, gameDoNotDisturb: false };

test("a system notification stands in only while a full-screen app has tucked the island away", () => {
  assert.equal(islandHiddenByFullscreen({ active: true, onIslandMonitor: true }, tuck), true);
  assert.equal(islandHiddenByFullscreen({ active: true, onIslandMonitor: false }, tuck), false, "the island is still on screen elsewhere");
  assert.equal(islandHiddenByFullscreen({ active: true, onIslandMonitor: true }, { ...tuck, gameAutoTuck: false }), false, "the island stays over the app");
  assert.equal(islandHiddenByFullscreen({ active: true, onIslandMonitor: true }, { ...tuck, gameDoNotDisturb: true }), false, "do not disturb means no notifications at all");
  assert.equal(islandHiddenByFullscreen({ active: false, onIslandMonitor: true }, tuck), false);
});

test("only a session that starts waiting for you or fails is announced, once per change", () => {
  const before = phasesOf([session("a", "running"), session("b", "waiting"), session("c", "running")]);
  const now = [session("a", "waiting"), session("b", "waiting"), session("c", "completed"), session("d", "failed")];
  assert.deepEqual(freshAlerts(before, now).map((alert) => [alert.session.sessionId, alert.phase]), [["a", "waiting"], ["d", "failed"]]);
  assert.deepEqual(freshAlerts(phasesOf(now), now), [], "nothing new, nothing sent again");
});

test("tags keep remote sessions apart and fit the 64 characters a Windows toast tag allows", () => {
  assert.notEqual(alertTag(session("a", "waiting")), alertTag(session("a", "waiting", { remoteHost: "vps" })));
  assert.ok(alertTag(session("x".repeat(80), "waiting")).length <= 64);
});
