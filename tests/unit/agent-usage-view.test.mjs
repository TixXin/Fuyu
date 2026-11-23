import assert from "node:assert/strict";
import test from "node:test";
import { shownUsage } from "../../src/features/agent-status/usage.ts";
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
  assert.equal(normalizeSettings({ agentEmptyStyle: "rainbow" }).agentEmptyStyle, "sleep");
  assert.equal(normalizeSettings({ agentUsageStyle: "ring" }).agentUsageStyle, "ring");
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
