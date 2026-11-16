import assert from "node:assert/strict";
import test from "node:test";
import { meetingStartsIn, nextMeeting, trayAgents, trayMedia } from "../../src/windows/tray-menu/trayCard.ts";
import { normalizeTrayMenuLayout } from "../../src/windows/tray-menu/storage.ts";
import { entryShown, shownFeatures, shownStatus } from "../../src/windows/tray-menu/builtinEntries.ts";

const NOW = Date.UTC(2026, 10, 15, 7, 0);
const event = (uid, startMin, endMin, extra = {}) => ({
  uid, title: uid, startMs: NOW + startMin * 60_000, endMs: NOW + endMin * 60_000, allDay: false, location: null, meetingLink: null, calendar: "c", ...extra,
});

test("the tray card layout falls back to the shortcuts layout", () => {
  assert.equal(normalizeTrayMenuLayout("status"), "status");
  assert.equal(normalizeTrayMenuLayout("compact"), "compact");
  assert.equal(normalizeTrayMenuLayout(null), "entry");
  assert.equal(normalizeTrayMenuLayout("\"status\""), "entry");
});

test("the next meeting skips all-day and finished events and looks 12 hours ahead", () => {
  const events = [event("over", -60, -5), event("allday", -60, 600, { allDay: true }), event("later", 90, 120), event("soon", 25, 55), event("far", 800, 860)];
  assert.equal(nextMeeting(events, NOW)?.title, "soon");
  assert.equal(nextMeeting([event("now", -10, 20)], NOW)?.title, "now");
  assert.equal(nextMeeting([event("far", 800, 860)], NOW), null);
});

test("meeting start reads as now, minutes or hours", () => {
  assert.deepEqual(meetingStartsIn({ startMs: NOW - 1, endMs: NOW }, NOW), { kind: "now" });
  assert.deepEqual(meetingStartsIn({ startMs: NOW + 24.5 * 60_000, endMs: NOW }, NOW), { kind: "minutes", value: 25 });
  assert.deepEqual(meetingStartsIn({ startMs: NOW + 150 * 60_000, endMs: NOW }, NOW), { kind: "hours", value: 3 });
});

test("agents count working sessions and ones waiting for you, not closed ones or subagents", () => {
  const base = { provider: "claudeCode", cwd: null, title: null, model: null, effort: null, lastMessage: null, updatedAt: 0, host: null, turnStartedAt: null };
  const sessions = [
    { ...base, sessionId: "a", phase: "running" },
    { ...base, sessionId: "b", phase: "waiting" },
    { ...base, sessionId: "c", phase: "running", closed: true },
    { ...base, sessionId: "d", phase: "running", parentId: "a" },
    { ...base, sessionId: "e", phase: "completed" },
  ];
  assert.deepEqual(trayAgents(sessions), { running: 1, waiting: 1 });
  assert.equal(trayAgents([]), null);
});

test("media shows only when something is loaded", () => {
  const media = { available: true, playbackStatus: "paused", title: "Song", artist: null, sourceApp: "App", thumbnail: null, positionMs: 50, durationMs: 100, canNext: false };
  assert.deepEqual(trayMedia(media), { title: "Song", artist: null, source: "App", thumbnail: null, playing: false, progress: 0.5, canNext: false });
  assert.equal(trayMedia({ ...media, playbackStatus: "unavailable" }), null);
  assert.equal(trayMedia({ ...media, title: null }), null);
});

test("tray card page names map onto island pages and nothing else gets through", async () => {
  const { trayMenuIslandPage } = await import("../../src/windows/island/trayMenuPage.ts");
  assert.equal(trayMenuIslandPage("file-shelf"), "shelf");
  assert.equal(trayMenuIslandPage("agent"), "agents");
  assert.equal(trayMenuIslandPage("notes"), "todo");
  assert.equal(trayMenuIslandPage("settings"), null);
  assert.equal(trayMenuIslandPage("toString"), null);
  assert.equal(trayMenuIslandPage(3), null);
});

test("tray card entries follow the built-in plugin switches", () => {
  const off = new Set(["translation", "todos", "music"]);
  assert.equal(entryShown(off, "translate"), false);
  assert.equal(entryShown(off, "notes"), false);
  assert.equal(entryShown(off, "file-shelf"), true);
  assert.deepEqual(shownFeatures(off, ["screenshot", "translate", "clipboard"]), ["screenshot", "clipboard"]);
  const status = shownStatus({ media: { title: "x" }, meeting: { title: "m" }, agents: { total: 1 }, now: 1 }, off);
  assert.equal(status.media, null);
  assert.deepEqual(status.meeting, { title: "m" });
  assert.equal(status.now, 1);
});
