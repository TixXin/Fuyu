import assert from "node:assert/strict";
import test from "node:test";
import { isStale, tightestWindow, untilReset, usageLevel } from "../../src/features/agent-status/usage.ts";

const window = (name, used, resetsAt = null) => ({ name, used, resetsAt });

test("usage levels and the time until a window resets", () => {
  assert.deepEqual([usageLevel(0), usageLevel(49), usageLevel(50), usageLevel(84), usageLevel(85), usageLevel(100)], ["low", "low", "medium", "medium", "high", "high"]);
  const now = 1_000_000_000;
  assert.deepEqual(untilReset(now + (34 * 60 + 10) * 60_000 + 30_000, now), { days: 1, hours: 10, minutes: 11 });
  assert.deepEqual(untilReset(now + 59_000, now), { days: 0, hours: 0, minutes: 1 });
  assert.equal(untilReset(now - 1, now), null);
  assert.equal(untilReset(null, now), null);
});

test("the reset time shown is the fullest window's", () => {
  const usage = { updatedAt: 0, fiveHour: window("", 27), sevenDay: window("", 47), models: [window("Fable", 100)], plan: null };
  assert.equal(tightestWindow(usage)?.name, "Fable");
  assert.equal(tightestWindow({ ...usage, models: [] })?.used, 47);
  assert.equal(tightestWindow({ updatedAt: 0, fiveHour: null, sevenDay: null, models: [], plan: null }), null);
  assert.equal(isStale(usage, 16 * 60_000), true);
  assert.equal(isStale(usage, 10 * 60_000), false);
  assert.equal(isStale({ ...usage, updatedAt: null }, 10 ** 12), false);
});

test("one usage line per agent that reports numbers, and the card names the source", async () => {
  const { EMPTY_USAGES, hasUsageNumbers, usageLineCount, usageSourceLines } = await import("../../src/features/agent-status/usage.ts");
  const { zhCN } = await import("../../src/i18n/sections/claudeUsage.ts");
  const usage = (overrides = {}) => ({ updatedAt: 0, fiveHour: window("", 10), sevenDay: null, models: [], plan: null, ...overrides });
  assert.equal(usageLineCount(EMPTY_USAGES), 0);
  assert.equal(usageLineCount({ claude: usage(), codex: null, readAt: 0 }), 1);
  assert.equal(usageLineCount({ claude: usage(), codex: usage({ source: "codex" }), readAt: 0 }), 2);
  assert.equal(hasUsageNumbers(usage({ fiveHour: null })), false, "an answer with only an error has no line");
  assert.equal(hasUsageNumbers(usage({ fiveHour: null, models: [window("Fable", 1)] })), true);
  assert.deepEqual(usageSourceLines(usage({ source: "codex" }), 60_000, zhCN).map((line) => line.text), ["1 分钟前更新 · 来自 Codex 会话记录"]);
  assert.deepEqual(usageSourceLines(usage(), 0, zhCN).map((line) => line.text), ["刚刚更新 · 来自 claude-hud"]);
});

test("an old snapshot gets one stale line in days with the reason, not two times in different units", async () => {
  const { usageSourceLines } = await import("../../src/features/agent-status/usage.ts");
  const { zhCN, en } = await import("../../src/i18n/sections/claudeUsage.ts");
  const usage = { updatedAt: 0, fiveHour: window("", 29), sevenDay: null, models: [], plan: null, source: "hud" };
  const now = 2758 * 60_000;
  assert.deepEqual(usageSourceLines(usage, now, zhCN), [
    { text: "可能已过时：1 天前更新 · 来自 claude-hud" },
    { text: zhCN.staleReason.hud, muted: true },
  ]);
  assert.equal(usageSourceLines(usage, now, en)[0].text, "May be stale: updated 1 day ago · via claude-hud");
  assert.deepEqual(usageSourceLines({ ...usage, source: "api" }, 20 * 60_000, zhCN).map((line) => line.text), ["可能已过时：20 分钟前更新 · 来自 Anthropic"]);
  assert.deepEqual(usageSourceLines(usage, 3 * 60 * 60_000 - 1, zhCN).map((line) => line.text)[0], "可能已过时：2 小时前更新 · 来自 claude-hud");
});

test("a window that reset after the snapshot was taken is dropped", async () => {
  const { liveUsage } = await import("../../src/features/agent-status/usage.ts");
  const hour = 60 * 60_000;
  const usage = { updatedAt: 0, fiveHour: window("", 29, 2 * hour), sevenDay: window("", 46, 100 * hour), models: [window("Fable", 24, 3 * hour)], plan: null };
  assert.deepEqual(liveUsage(usage, hour), usage);
  const later = liveUsage(usage, 45 * hour);
  assert.equal(later.fiveHour, null);
  assert.equal(later.sevenDay?.used, 46);
  assert.deepEqual(later.models, []);
  assert.equal(liveUsage({ ...usage, updatedAt: null }, 45 * hour).fiveHour?.used, 29);
  assert.equal(liveUsage({ ...usage, updatedAt: 3 * hour }, 45 * hour).fiveHour?.used, 29, "a snapshot taken after the reset time keeps its numbers");
});
