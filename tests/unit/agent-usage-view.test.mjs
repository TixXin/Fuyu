import assert from "node:assert/strict";
import test from "node:test";
import { availableLines, EMPTY_USAGES, formatCredit, rulerSpots, shownUsage, usageLines, usageWindows } from "../../src/features/agent-status/usage.ts";
import { emptyTide, normalizeTide, recordTide, tideArea, tideDayKey, tideMinutes, tideSlot } from "../../src/features/agent-status/tide.ts";

const window = (name, used, resetsAt = null) => ({ name, used, resetsAt });
const usage = { updatedAt: 0, fiveHour: window("5h", 42), sevenDay: window("7d", 16), models: [window("Opus", 63)], plan: null };

test("settings saved before the usage options keep showing every window and the sleeping jellyfish", async () => {
  const { normalizeSettings, DEFAULT_SETTINGS } = await import("../../src/lib/settings/settings.ts");
  const old = normalizeSettings({ agentShowUsage: true });
  assert.deepEqual(old.agentUsageHidden, []);
  assert.equal(old.agentUsageTightest, false);
  assert.equal(old.agentUsageReset, "tightest");
  assert.equal(old.agentUsageStyle, "number");
  assert.equal(old.agentEmptyStyle, "sleep");
  assert.equal(DEFAULT_SETTINGS.agentEmptyStyle, "sleep");
  assert.deepEqual(normalizeSettings({ agentUsageHidden: ["codex", "bogus", 3, "codex", "models"] }).agentUsageHidden, ["codex", "models"]);
  assert.deepEqual(normalizeSettings({ agentUsageHidden: "codex" }).agentUsageHidden, []);
  assert.deepEqual(normalizeSettings({ agentUsageHidden: ["cursor", "dsh", "grok"] }).agentUsageHidden, ["cursor", "dsh"], "only sources that have usage can be hidden");
  assert.equal(normalizeSettings({ agentEmptyStyle: "rainbow" }).agentEmptyStyle, "sleep");
  assert.equal(normalizeSettings({ agentUsageStyle: "ring" }).agentUsageStyle, "ring");
  assert.equal(old.agentUsageLayout, "chips", "settings saved before the layouts open on the one-row chips");
  assert.equal(normalizeSettings({ agentUsageLayout: "ruler" }).agentUsageLayout, "ruler");
  assert.equal(normalizeSettings({ agentUsageLayout: "grid" }).agentUsageLayout, "chips");
});

test("ruler markers never sit on top of each other and stay on the scale", () => {
  assert.deepEqual(rulerSpots([]), []);
  assert.deepEqual(rulerSpots([10, 60]), [10, 60]);
  const close = rulerSpots([40, 41, 42]);
  assert.ok(close[1] - close[0] >= 13 && close[2] - close[1] >= 13, `markers spread apart: ${close}`);
  const crowdedTop = rulerSpots([99, 100, 100]);
  assert.ok(crowdedTop.every((spot) => spot >= 0 && spot <= 100), `markers stay on the scale: ${crowdedTop}`);
  assert.ok(crowdedTop[1] - crowdedTop[0] >= 13 && crowdedTop[2] - crowdedTop[1] >= 13, `markers near 100 spread to the left: ${crowdedTop}`);
  const reordered = rulerSpots([80, 20]);
  assert.ok(reordered[0] > reordered[1], "each marker keeps its own value's place");
});

test("credits read without long decimals and raw window names get readable labels", () => {
  assert.equal(formatCredit(1240), "1,240");
  assert.equal(formatCredit(31.416), "31.42");
  assert.equal(formatCredit(8930.1234), "8,930", "big balances drop the decimals so they fit a tile");
  assert.equal(formatCredit(0), "0");
  const cursor = { updatedAt: 0, fiveHour: null, sevenDay: null, models: [window("month", 12), window("cursorAuto", 30), window("Opus", 5)], plan: null };
  const labels = usageWindows(cursor, { fiveHour: "5h", sevenDay: "7d", names: { month: "This month", cursorAuto: "Auto" } }).map((cell) => cell.label);
  assert.deepEqual(labels, ["This month", "Auto", "Opus"]);
});

test("hidden windows drop out and 'tightest' keeps only the fullest of what is left", () => {
  const view = (hidden, tightest = false) => shownUsage(usage, { hidden, tightest });
  assert.deepEqual(view([]), usage);
  const noModels = view(["models"]);
  assert.deepEqual([noModels.fiveHour?.name, noModels.sevenDay?.name, noModels.models.length], ["5h", "7d", 0]);
  const tight = view([], true);
  assert.deepEqual([tight.fiveHour, tight.sevenDay, tight.models.map((model) => model.name)], [null, null, ["Opus"]]);
  const tightNoModels = view(["models"], true);
  assert.deepEqual([tightNoModels.fiveHour?.name, tightNoModels.sevenDay], ["5h", null]);
  const nothing = view(["fiveHour", "sevenDay", "models"], true);
  assert.deepEqual([nothing.fiveHour, nothing.sevenDay, nothing.models], [null, null, []]);
});

test("every source this computer can read gets a line, in a fixed order, and credits read as figures", () => {
  const credit = (fields) => ({ provider: "workbuddy", updatedAt: 0, source: null, available: true, credits: null, wallets: [], error: null, ...fields });
  const usages = {
    ...EMPTY_USAGES,
    codex: usage,
    others: { cursor: { ...usage, fiveHour: null, sevenDay: null }, glm: { ...usage, fiveHour: null, sevenDay: null, models: [] }, antigravity: usage },
    credits: {
      dsh: credit({ provider: "dsh", wallets: [{ currency: "CNY", total: "32.10", toppedUp: "30", granted: "2.10" }] }),
      workbuddy: credit({ credits: { today: 5, sevenDay: 40, total: 90, totalTokens: 0, sessions: 1 } }),
    },
  };
  const lines = availableLines(usages);
  assert.deepEqual(lines.map((line) => line.source), ["codex", "antigravity", "cursor", "workbuddy", "dsh"], "a plan with no numbers has no line");
  assert.deepEqual(lines[3].credit, { kind: "credits", today: 5, sevenDay: 40 });
  assert.deepEqual(lines[4].credit, { kind: "balance", currency: "CNY", total: "32.10" });
  assert.equal(availableLines({ ...usages, credits: { workbuddy: credit({}) } }).some((line) => line.source === "workbuddy"), false, "no credits and no wallet means no line");
  const view = { hidden: ["cursor", "fiveHour"], tightest: false, reset: "tightest", style: "number", agentsOff: ["antigravity", "dsh"] };
  const shown = usageLines(usages, view);
  assert.deepEqual(shown.map((line) => line.source), ["codex", "workbuddy"], "agents turned off and sources hidden here both drop out");
  assert.equal(shown[0].usage.fiveHour, null);
  assert.deepEqual(usageLines(usages, { ...view, hidden: ["fiveHour", "sevenDay"], agentsOff: [] }).map((line) => line.source), ["codex", "antigravity", "cursor", "workbuddy", "dsh"], "lines with only per-model windows stay");
  assert.deepEqual(usageLines(usages, { ...view, hidden: ["models"], agentsOff: [] }).map((line) => line.source), ["codex", "antigravity", "workbuddy", "dsh"], "a line left with no window drops out");
});

const at = (hours, minutes) => new Date(2026, 10, 23, hours, minutes).getTime();
const session = (provider, sessionId, phase = "running") => ({ provider, sessionId, phase, updatedAt: 0 });

test("the tide counts running sessions per quarter hour and starts over the next day", () => {
  const nine = at(9, 20);
  const day = tideDayKey(nine);
  const first = recordTide(emptyTide(day), [session("claudeCode", "a"), session("claudeCode", "b"), session("codex", "c", "completed"), session("cursor", "d")], nine);
  const slot = tideSlot(nine);
  assert.equal(slot, 37);
  assert.equal(first.slots.claude[slot], 2);
  assert.equal(first.slots.codex[slot], 0);
  assert.equal(first.slots.other[slot], 1);
  assert.deepEqual(first.sessions, { claude: ["a", "b"], codex: [], other: ["d"] });
  assert.equal(first.lastActiveAt, nine);
  assert.equal(tideMinutes(first, "claude"), 15);

  assert.equal(recordTide(first, [session("claudeCode", "a")], nine + 1000), first, "nothing new within the same minute must not rewrite storage");
  assert.equal(recordTide(first, [], at(10, 0)), first);

  const later = recordTide(first, [session("claudeCode", "a")], at(9, 50));
  assert.equal(later.slots.claude[slot], 2);
  assert.equal(later.slots.claude[tideSlot(at(9, 50))], 1);
  assert.deepEqual(later.sessions.claude, ["a", "b"]);

  const tomorrow = recordTide(later, [session("codex", "e")], new Date(2026, 10, 24, 0, 5).getTime());
  assert.equal(tomorrow.day, "2026-11-24");
  assert.deepEqual(tomorrow.sessions, { claude: [], codex: ["e"], other: [] });
  assert.equal(tomorrow.slots.claude.some((count) => count > 0), false);
});

test("a saved tide from another day or in a broken shape reads as an empty day", () => {
  const today = "2026-11-23";
  assert.deepEqual(normalizeTide(null, today), emptyTide(today));
  assert.deepEqual(normalizeTide({ ...emptyTide("2026-11-22"), lastActiveAt: 5 }, today), emptyTide(today));
  const broken = normalizeTide({ day: today, slots: { claude: [1, -2, "x", 2.6] }, sessions: { codex: ["a", "a", 7] }, lastActiveAt: "soon" }, today);
  assert.equal(broken.slots.claude.length, 96);
  assert.deepEqual(broken.slots.claude.slice(0, 4), [1, 0, 0, 3]);
  assert.deepEqual(broken.sessions, { claude: [], codex: ["a"], other: [] });
  assert.equal(broken.lastActiveAt, null);
});

test("the tide wave is flat where nothing ran and closes back on the baseline", () => {
  assert.equal(tideArea(Array(96).fill(0), 640, 60, 50), null);
  const counts = Array(96).fill(0);
  counts[40] = 3;
  const path = tideArea(counts, 640, 60, 50);
  assert.match(path, /^M0 60/);
  assert.match(path, /640 60Z$/);
  assert.match(path, / 10\b/);
});
