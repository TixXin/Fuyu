import assert from "node:assert/strict";
import test from "node:test";
import { summarizeWeek, weekStartOf } from "../../src/features/todos/weekSummary.ts";

let nextId = 0;
const todo = (title, completed = false, extra = {}) => ({ id: `t${nextId++}`, title, completed, createdAt: 0, ...extra });
const done = (count) => Array.from({ length: count }, (_, index) => todo(`done ${index}`, true));
const archive = (date, todos) => ({ date, todos, dailyNote: "", savedAt: 0, savedToDisk: true });

const WEDNESDAY = "2026-11-18";
const ARCHIVES = [
  archive("2026-11-17", [...done(1)]),
  archive("2026-11-16", [...done(3), todo("left open")]),
  archive("2026-11-15", [...done(2)]),
  archive("2026-11-09", [...done(5)]),
];
const TODAY = [...done(2), todo("still open")];

test("a week that starts on Monday leaves last Sunday out and counts today's finished todos", () => {
  const summary = summarizeWeek(ARCHIVES, WEDNESDAY, TODAY, 1);
  assert.deepEqual(summary.days.map((day) => day.date), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.deepEqual(summary.days.map((day) => day.done), [3, 1, 2, 0, 0, 0, 0]);
  assert.deepEqual(summary.days.map((day) => day.today), [false, false, true, false, false, false, false]);
  assert.equal(summary.done, 6);
});

test("a week that starts on Sunday takes that Sunday in", () => {
  const summary = summarizeWeek(ARCHIVES, WEDNESDAY, TODAY, 0);
  assert.equal(summary.days[0].date, "2026-11-15");
  assert.deepEqual(summary.days.map((day) => day.done), [2, 3, 1, 2, 0, 0, 0]);
  assert.equal(summary.done, 8);
  assert.equal(weekStartOf("2026-11-15", 0), "2026-11-15");
  assert.equal(weekStartOf("2026-11-15", 1), "2026-11-09");
});

test("without any focus time there are no focus minutes and no projects", () => {
  const summary = summarizeWeek(ARCHIVES, WEDNESDAY, TODAY, 1);
  assert.equal(summary.focusMinutes, 0);
  assert.deepEqual(summary.projects, []);
});

test("focus time is summed per project, the three largest are kept, and todos without a project count as one group", () => {
  const archives = [
    archive("2026-11-17", [todo("draft", true, { project: "thesis", focusMinutes: 50 }), todo("mail", true, { focusMinutes: 25 })]),
    archive("2026-11-16", [todo("outline", true, { project: "thesis", focusMinutes: 100 }), todo("slides", false, { project: "talk", focusMinutes: 30 })]),
    archive("2026-11-15", [todo("old", true, { project: "thesis", focusMinutes: 500 })]),
  ];
  const today = [
    todo("island", false, { project: "fuyu", focusMinutes: 80 }),
    todo("errand", true, { focusMinutes: 20 }),
    todo("tidy", true, { project: "home", focusMinutes: 10 }),
  ];
  const summary = summarizeWeek(archives, WEDNESDAY, today, 1);
  assert.deepEqual(summary.projects, [
    { project: "thesis", minutes: 150 },
    { project: "fuyu", minutes: 80 },
    { project: null, minutes: 45 },
  ]);
  assert.equal(summary.focusMinutes, 150 + 80 + 45 + 30 + 10);
});

test("a copy of today saved to the archive is not counted on top of today's list", () => {
  const saved = archive(WEDNESDAY, [...done(2), todo("deleted since", true, { focusMinutes: 25 })]);
  const summary = summarizeWeek([saved, ...ARCHIVES], WEDNESDAY, TODAY, 1);
  assert.equal(summary.days[2].done, 2);
  assert.equal(summary.done, 6);
  assert.equal(summary.focusMinutes, 0);
});

test("focus time is what each day recorded, added up day by day", () => {
  const archives = [
    archive("2026-11-17", [todo("write thesis", false, { project: "thesis", focusMinutes: 25 }), todo("read papers", false, { focusMinutes: 50 })]),
    archive("2026-11-16", [todo("write thesis", false, { project: "thesis", focusMinutes: 25 })]),
    archive("2026-11-13", [todo("write thesis", false, { project: "thesis", focusMinutes: 100 })]),
  ];
  const today = [todo("write thesis", false, { project: "thesis", focusMinutes: 25 }), todo("read papers", false)];
  const summary = summarizeWeek(archives, WEDNESDAY, today, 1);
  assert.deepEqual(summary.projects, [{ project: "thesis", minutes: 75 }, { project: null, minutes: 50 }]);
  assert.equal(summary.focusMinutes, 125);
});

test("a date that cannot be read gives an empty summary instead of throwing", () => {
  assert.deepEqual(summarizeWeek(ARCHIVES, "", TODAY, 1), { days: [], done: 0, focusMinutes: 0, projects: [] });
});
