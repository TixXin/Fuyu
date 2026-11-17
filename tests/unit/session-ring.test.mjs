import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_GRID_MAX,
  SESSION_RING_STATES,
  SESSION_SIGNAL_MAX,
  sessionGridCells,
  sessionRingCardLines,
  sessionRingCounts,
  sessionRingSegments,
  sessionRingState,
  sessionRingSummary,
  sessionSignal,
  ringSessions,
} from "../../src/features/session-ring/ringCounts.ts";
import { ringConfig, storedRingValue } from "../../src/features/session-ring/ringConfig.ts";
import { en, zhCN } from "../../src/i18n/sections/sessionRing.ts";

function session(sessionId, light, overrides = {}) {
  return {
    key: `claudeCode:${sessionId}`,
    provider: "claudeCode",
    sessionId,
    cwd: "F:\\code\\fuyu",
    title: `title ${sessionId}`,
    phase: "completed",
    light,
    updatedAt: 1,
    remoteHost: null,
    listed: true,
    unseen: false,
    ...overrides,
  };
}
const unseen = (sessionId, light, overrides = {}) => session(sessionId, light, { unseen: true, ...overrides });
const color = (key) => SESSION_RING_STATES.find((state) => state.key === key).color;

test("the agents/v1 light maps to ring states the way the Agent page lights its rows", () => {
  assert.equal(sessionRingState(unseen("a", "needs")), "needs");
  assert.equal(sessionRingState(unseen("a", "failed")), "needs");
  assert.equal(sessionRingState(unseen("a", "yourTurn")), "yourturn");
  assert.equal(sessionRingState(session("a", "working")), "working");
  assert.equal(sessionRingState(session("a", "stale")), "stale");
  assert.equal(sessionRingState(unseen("a", "done")), "done");
  assert.equal(sessionRingState(session("a", "something new")), "done");
});

test("a seen session that asked for you counts as done", () => {
  assert.equal(sessionRingState(session("a", "needs")), "done");
  assert.equal(sessionRingState(session("a", "yourTurn")), "done");
  assert.equal(sessionRingState(session("a", "failed")), "done");
  assert.equal(sessionRingState(session("a", "working")), "working");
});

test("the ring shows the sessions the Agent page lists", () => {
  const listed = session("a", "working");
  assert.deepEqual(ringSessions([listed, session("b", "done", { listed: false })]), [listed]);
});

test("style and count come from plugins.yml, defaults are not written", () => {
  assert.deepEqual(ringConfig({}), { style: "grid", showCount: true });
  assert.deepEqual(ringConfig({ style: "signal", showCount: false }), { style: "signal", showCount: false });
  assert.deepEqual(ringConfig({ style: "spiral", showCount: "no" }), { style: "grid", showCount: true });
  assert.equal(storedRingValue("style", "grid"), null);
  assert.equal(storedRingValue("style", "bar"), "bar");
  assert.equal(storedRingValue("showCount", true), null);
  assert.equal(storedRingValue("showCount", false), false);
});

test("counts, segments in ring order and the summary list only states that have sessions", () => {
  const sessions = [session("r1", "working"), unseen("w1", "needs"), session("r2", "working"), session("old", "done")];
  const counts = sessionRingCounts(sessions);
  assert.deepEqual(counts, { needs: 1, yourturn: 0, working: 2, stale: 0, done: 1, total: 4 });
  assert.deepEqual(sessionRingSegments(counts), [
    { value: 1, color: color("needs") },
    { value: 2, color: color("working") },
    { value: 1, color: color("done") },
  ]);
  assert.equal(sessionRingSummary(counts, zhCN), "等你确认 1 · 运行 2 · 完成 1");
  assert.equal(sessionRingSummary(counts, en), "Needs you 1 · Running 2 · Done 1");
  assert.equal(sessionRingSummary(sessionRingCounts([]), en), en.empty);
});

test("card names up to three sessions waiting on you, those needing you first", () => {
  const sessions = [
    unseen("y1", "yourTurn", { title: "写测试" }),
    unseen("n1", "needs", { title: "修复登录" }),
    unseen("y2", "yourTurn", { title: "x".repeat(45), cwd: null }),
    unseen("n2", "needs", { title: null, cwd: null }),
    unseen("y3", "yourTurn"),
  ];
  const lines = sessionRingCardLines(sessions, zhCN);
  assert.deepEqual(lines, [
    "等你确认 2 · 等你回复 3",
    "等你确认：修复登录 · fuyu",
    "等你确认：n2",
    "等你回复：写测试 · fuyu",
  ]);
  const long = sessionRingCardLines([sessions[2]], en);
  assert.equal(long[1], `Your turn: ${"x".repeat(40)}…`);
});

test("the pixel grid lights one cell per session in ring order, with a plus past nine", () => {
  const counts = { needs: 1, yourturn: 0, working: 2, stale: 1, done: 1, total: 5 };
  assert.deepEqual(sessionGridCells(counts), ["needs", "working", "working", "stale", "done"]);
  const nine = { needs: 0, yourturn: 0, working: 9, stale: 0, done: 0, total: 9 };
  assert.deepEqual(sessionGridCells(nine), Array(9).fill("working"));
  const many = { needs: 2, yourturn: 3, working: 6, stale: 0, done: 4, total: 15 };
  const cells = sessionGridCells(many);
  assert.equal(cells.length, SESSION_GRID_MAX);
  assert.deepEqual(cells, ["needs", "needs", "yourturn", "yourturn", "yourturn", "working", "working", "working", "more"]);
  assert.deepEqual(sessionGridCells(sessionRingCounts([])), []);
});

test("signal bars: a column per colour with sessions, least urgent left, a bar per session", () => {
  const counts = { needs: 1, yourturn: 0, working: 2, stale: 1, done: 3, total: 7 };
  assert.deepEqual(sessionSignal(counts), {
    columns: [
      { key: "done", bars: ["done", "done", "done"] },
      { key: "working", bars: ["working", "working", "stale"] },
      { key: "needs", bars: ["needs"] },
    ],
    slots: 5,
    bar: 3,
  });
  const six = sessionSignal({ needs: 0, yourturn: 6, working: 1, stale: 0, done: 0, total: 7 });
  assert.deepEqual([six.slots, six.bar], [6, 2], "past five in a column, every column gets more, thinner bars");
  const crowd = sessionSignal({ needs: 0, yourturn: 0, working: 12, stale: 0, done: 0, total: 12 });
  assert.equal(crowd.columns[0].bars.length, SESSION_SIGNAL_MAX);
  assert.equal(crowd.slots, SESSION_SIGNAL_MAX);
  assert.deepEqual(sessionSignal(sessionRingCounts([])).columns, []);
});
