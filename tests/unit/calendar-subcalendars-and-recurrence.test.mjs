import assert from "node:assert/strict";
import test from "node:test";
import { buildHolidayMarkMap, isStatutoryWorkday, parseHolidayTitleMark } from "../../src/utils/workday.ts";
import {
  cycleCalendarColor,
  normalizeCalendarPrefs,
  prepareCalendarEvents,
  resolveCalendarColor,
} from "../../src/features/calendar/calendarPrefs.ts";
import { dueMeetingBanner, upcomingMeeting } from "../../src/features/calendar/upcoming.ts";
import { parseTodoInlineSyntax } from "../../src/features/todos/inlineSyntax.ts";
import { hasPendingRecurringSchedule, nextOccurrenceDate, readRecurrence } from "../../src/features/todos/recurrence.ts";
import { readTags, withTags } from "../../src/features/todos/tags.ts";

test("parseHolidayTitleMark and isStatutoryWorkday handle statutory off days and weekend makeup workdays", () => {
  assert.equal(parseHolidayTitleMark("国庆节（休）"), "off");
  assert.equal(parseHolidayTitleMark("国庆节补班(班)"), "work");
  assert.equal(parseHolidayTitleMark("产品评审会"), null);

  const oct1 = new Date(2026, 9, 1).getTime();
  const oct4 = new Date(2026, 9, 4).getTime();
  const oct10Sat = new Date(2026, 9, 10).getTime();
  const oct11Sun = new Date(2026, 9, 11).getTime();

  const marks = buildHolidayMarkMap([
    { startMs: oct1, endMs: oct4, allDay: true, title: "国庆节（休）" },
    { startMs: oct10Sat, endMs: oct11Sun, allDay: true, title: "国庆节（班）" },
  ]);

  assert.equal(isStatutoryWorkday("2026-10-01", marks), false);
  assert.equal(isStatutoryWorkday("2026-10-02", marks), false);
  assert.equal(isStatutoryWorkday("2026-10-10", marks), true);
  assert.equal(isStatutoryWorkday("2026-10-11", marks), false);
  assert.equal(isStatutoryWorkday("2026-10-12", marks), true);
});

test("nextOccurrenceDate handles daily, weekly, monthly clamping, and Chinese holiday-aware workdays", () => {
  assert.equal(nextOccurrenceDate("2026-11-17", { kind: "daily" }), "2026-11-18");
  assert.equal(nextOccurrenceDate("2026-11-17", { kind: "weekly" }), "2026-11-24");
  assert.equal(nextOccurrenceDate("2026-01-31", { kind: "monthly" }), "2026-02-28");
  assert.equal(nextOccurrenceDate("2028-01-31", { kind: "monthly" }), "2028-02-29");

  const marks = new Map([
    ["2026-09-30", "work"],
    ["2026-10-01", "off"],
    ["2026-10-02", "off"],
    ["2026-10-05", "off"],
    ["2026-10-06", "off"],
    ["2026-10-07", "off"],
    ["2026-10-10", "work"],
  ]);

  assert.equal(nextOccurrenceDate("2026-09-30", { kind: "workdays" }, marks), "2026-10-08");
  assert.equal(nextOccurrenceDate("2026-10-09", { kind: "workdays" }, marks), "2026-10-10");
});

test("inline syntax, tag helpers and duplicate schedule guard support recurrence", () => {
  const parsed = parseTodoInlineSyntax("#工作 !1 @工作日 晨会同步", "2026-11-17", true);
  assert.deepEqual(parsed, {
    title: "晨会同步",
    project: "工作",
    priority: "high",
    recurrence: { kind: "workdays" },
  });

  assert.equal(readRecurrence({ kind: "unknown" }), undefined);
  assert.deepEqual(readRecurrence({ kind: "daily", interval: 1 }), { kind: "daily" });
  assert.deepEqual(readRecurrence({ kind: "weekly", interval: 2 }), { kind: "weekly", interval: 2 });

  const tagged = withTags({ title: "周报" }, { priority: "medium", recurrence: { kind: "weekly" } });
  assert.deepEqual(readTags(tagged), { priority: "medium", recurrence: { kind: "weekly" } });
  const cleared = withTags(tagged, { recurrence: undefined });
  assert.equal(cleared.recurrence, undefined);

  const scheduled = [
    { id: "s1", title: "晨会同步", date: "2026-11-18", createdAt: 1, project: "工作", recurrence: { kind: "workdays" } },
  ];
  assert.equal(hasPendingRecurringSchedule(scheduled, "晨会同步", "工作", { kind: "workdays" }, "2026-11-17"), true);
  assert.equal(hasPendingRecurringSchedule(scheduled, "晨会同步", "个人", { kind: "workdays" }, "2026-11-17"), false);
});

test("sub-calendar visibility, countdown exclusion and color overrides work end-to-end", () => {
  const prefs = normalizeCalendarPrefs({
    hiddenCalendars: [" 团队请假 ", "团队请假", ""],
    noCountdownCalendars: ["公共假期"],
    calendarColors: { 研发日历: "#3B82F6", bad: "not-a-color" },
  });
  assert.deepEqual(prefs.hiddenCalendars, ["团队请假"]);
  assert.deepEqual(prefs.noCountdownCalendars, ["公共假期"]);
  assert.deepEqual(prefs.calendarColors, { 研发日历: "#3b82f6" });

  assert.equal(resolveCalendarColor("研发日历", prefs.calendarColors, { 研发日历: "#10b981" }), "#3b82f6");
  assert.equal(resolveCalendarColor("个人日历", prefs.calendarColors, { 个人日历: "#10B981FF" }), "#10b981");
  assert.equal(cycleCalendarColor(null), "#3b82f6");
  assert.equal(cycleCalendarColor("#ec4899"), null);

  const now = 1_000_000;
  const events = [
    { uid: "1", title: "请假", startMs: now + 3 * 60_000, endMs: now + 60 * 60_000, allDay: false, location: null, meetingLink: "https://meet.google.com/aaa-bbbb-ccc", calendar: "团队请假" },
    { uid: "2", title: "值班提醒", startMs: now + 4 * 60_000, endMs: now + 60 * 60_000, allDay: false, location: null, meetingLink: "https://meet.google.com/ddd-eeee-fff", calendar: "公共假期" },
    { uid: "3", title: "架构评审", startMs: now + 5 * 60_000, endMs: now + 60 * 60_000, allDay: false, location: null, meetingLink: "https://meet.google.com/ggg-hhhh-iii", calendar: "研发日历" },
  ];

  const visible = prepareCalendarEvents(events, prefs);
  assert.deepEqual(visible.map((item) => item.uid), ["2", "3"]);

  const upcoming = upcomingMeeting(visible, now, 10, prefs);
  assert.equal(upcoming?.event.uid, "3");

  const banner = dueMeetingBanner(visible, now + 4 * 60_000 + 30_000, prefs, new Set());
  assert.equal(banner?.event.uid, "3");
});
