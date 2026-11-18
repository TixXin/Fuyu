import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CALENDAR_PREFS,
  extractCustomMeetingLink,
  normalizeCalendarPrefs,
  parseMeetingDomain,
  prepareCalendarEvents,
} from "../../src/features/calendar/calendarPrefs.ts";
import { CALENDAR_REMIND_MINUTES, normalizeCalendarSettings } from "../../src/features/calendar/calendarSettings.ts";
import { agendaDayStarts, isoWeekNumber, monthDays, monthStart, monthWeekNumbers } from "../../src/features/calendar/monthView.ts";
import { scheduledTodoEvents } from "../../src/features/calendar/todoEvents.ts";
import {
  dueMeetingBanner,
  formatMeetingBanner,
  meetingBannerId,
  nextChangeAt,
  upcomingMeeting,
} from "../../src/features/calendar/upcoming.ts";

const MIN = 60_000;
const dayMs = (year, month, day, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const event = (title, startMs, endMs, fields = {}) => ({
  uid: title,
  title,
  startMs,
  endMs,
  allDay: false,
  location: null,
  meetingLink: null,
  calendar: "工作",
  ...fields,
});

test("calendar remind minutes include 60 and normalizeCalendarPrefs tolerates malformed inputs", () => {
  assert.deepEqual(CALENDAR_REMIND_MINUTES, [0, 5, 10, 15, 30, 60]);
  assert.equal(normalizeCalendarSettings({ calendarRemindMinutes: 60 }).calendarRemindMinutes, 60);

  assert.deepEqual(normalizeCalendarPrefs(undefined), DEFAULT_CALENDAR_PREFS);
  assert.deepEqual(normalizeCalendarPrefs(null), DEFAULT_CALENDAR_PREFS);
  assert.deepEqual(normalizeCalendarPrefs("corrupt"), DEFAULT_CALENDAR_PREFS);
  assert.deepEqual(normalizeCalendarPrefs([1, 2, 3]), DEFAULT_CALENDAR_PREFS);
  assert.deepEqual(
    normalizeCalendarPrefs({
      countdownScope: "invalid",
      countdownFormat: "compact",
      holdMinutes: 99,
      bannerEnabled: false,
      bannerMinutes: 7,
      pauseMediaOnJoin: 0,
      agendaRange: "sevenDays",
      hideDeclined: false,
      ignoreFreeInCountdown: false,
      foldAllDay: true,
      showWeekNumbers: 1,
      weekStartsOn: "sunday",
      includeTimedTodos: false,
      customMeetingDomain: "  vc.corp.example.com\n ",
    }),
    {
      ...DEFAULT_CALENDAR_PREFS,
      countdownFormat: "compact",
      bannerEnabled: false,
      pauseMediaOnJoin: false,
      agendaRange: "sevenDays",
      hideDeclined: false,
      ignoreFreeInCountdown: false,
      foldAllDay: true,
      showWeekNumbers: true,
      weekStartsOn: "sunday",
      includeTimedTodos: false,
      customMeetingDomain: "vc.corp.example.com",
    },
  );
});

test("custom meeting domain validates hostnames and backfills location links only for matching HTTPS hosts", () => {
  assert.equal(parseMeetingDomain("vc.corp.example.com"), "vc.corp.example.com");
  assert.equal(parseMeetingDomain("  HTTPS://Room.Corp.Example.com/j/42?pw=1 "), "room.corp.example.com");
  assert.equal(parseMeetingDomain("vc.corp.example.com:8443"), "vc.corp.example.com:8443");
  assert.equal(parseMeetingDomain(""), null);
  assert.equal(parseMeetingDomain("localhost"), null);
  assert.equal(parseMeetingDomain("ftp://vc.corp.example.com"), null);
  assert.equal(parseMeetingDomain("vc.corp.example.com:99999"), null);
  assert.equal(parseMeetingDomain("bad domain.com"), null);

  assert.equal(
    extractCustomMeetingLink("3F 会议室 https://vc.corp.example.com/r/987654。", "corp.example.com"),
    "https://vc.corp.example.com/r/987654",
  );
  assert.equal(extractCustomMeetingLink("http://vc.corp.example.com/r/1", "vc.corp.example.com"), null);
  assert.equal(extractCustomMeetingLink("https://evil-example.com/r/1", "example.com"), null);

  const raw = [
    event("内部评审", 100 * MIN, 130 * MIN, { location: "线上 https://vc.corp.example.com/m/11" }),
    event("已拒绝周会", 100 * MIN, 130 * MIN, { declined: true }),
    event("已有链接", 100 * MIN, 130 * MIN, {
      location: "https://vc.corp.example.com/m/22",
      meetingLink: "https://vc.feishu.cn/j/99",
    }),
  ];
  const prepared = prepareCalendarEvents(raw, { hideDeclined: true, customMeetingDomain: "vc.corp.example.com" });
  assert.equal(prepared.length, 2);
  assert.equal(prepared[0].meetingLink, "https://vc.corp.example.com/m/11");
  assert.equal(prepared[1].meetingLink, "https://vc.feishu.cn/j/99");
  assert.equal(prepareCalendarEvents(raw, { hideDeclined: false, customMeetingDomain: "" }).length, 3);
});

test("countdown respects meetingsOnly, ignoreFreeInCountdown, hideDeclined and customMeetingDomain", () => {
  const now = 1_000 * MIN;
  const plain = event("写周报提醒", now + 5 * MIN, now + 35 * MIN);
  const freeBlock = event("弹性办公", now + 3 * MIN, now + 60 * MIN, {
    free: true,
    meetingLink: "https://vc.feishu.cn/j/free",
  });
  const declined = event("拒绝的评审", now + 2 * MIN, now + 30 * MIN, {
    declined: true,
    meetingLink: "https://vc.feishu.cn/j/declined",
  });
  const corpMeet = event("私有云例会", now + 8 * MIN, now + 38 * MIN, {
    location: "参会：https://vc.corp.example.com/room/abc",
  });

  assert.equal(upcomingMeeting([plain], now, 10, { countdownScope: "meetingsOnly" }), null);
  assert.equal(upcomingMeeting([plain], now, 10, { countdownScope: "all" })?.event.uid, "写周报提醒");

  const picked = upcomingMeeting([plain, freeBlock, declined, corpMeet], now, 10, {
    countdownScope: "meetingsOnly",
    hideDeclined: true,
    ignoreFreeInCountdown: true,
    customMeetingDomain: "vc.corp.example.com",
  });
  assert.equal(picked?.event.uid, "私有云例会");
  assert.equal(picked?.event.meetingLink, "https://vc.corp.example.com/room/abc");
  assert.equal(picked?.minutes, 8);

  assert.equal(
    upcomingMeeting([freeBlock], now, 10, { ignoreFreeInCountdown: false })?.event.uid,
    "弹性办公",
  );
  assert.equal(
    upcomingMeeting([declined], now, 10, { hideDeclined: false })?.event.uid,
    "拒绝的评审",
  );
});

test("holdMinutes supports 0, 5, 15 and -1 until endMs with accurate nextChangeAt wakeups", () => {
  const start = 1_000 * MIN;
  const end = start + 30 * MIN;
  const review = event("架构评审", start, end);

  assert.equal(upcomingMeeting([review], start, 10, { holdMinutes: 0 }), null);
  assert.equal(nextChangeAt([review], start - 30_000, 10, { holdMinutes: 0 }), start);

  assert.deepEqual(upcomingMeeting([review], start + 4 * MIN, 10, { holdMinutes: 5 }), { event: review, minutes: 0 });
  assert.equal(upcomingMeeting([review], start + 5 * MIN, 10, { holdMinutes: 5 }), null);
  assert.equal(nextChangeAt([review], start + 2 * MIN, 10, { holdMinutes: 5 }), start + 5 * MIN);

  assert.deepEqual(upcomingMeeting([review], start + 14 * MIN, 10, { holdMinutes: 15 }), { event: review, minutes: 0 });
  assert.equal(upcomingMeeting([review], start + 15 * MIN, 10, { holdMinutes: 15 }), null);
  assert.equal(nextChangeAt([review], start + 6 * MIN, 10, { holdMinutes: 15 }), start + 15 * MIN);

  const mid = start + 8 * MIN + 20_000;
  assert.deepEqual(upcomingMeeting([review], mid, 10, { holdMinutes: -1 }), {
    event: review,
    minutes: 0,
    remainingEndMinutes: 22,
  });
  assert.equal(nextChangeAt([review], mid, 10, { holdMinutes: -1 }), start + 9 * MIN);
  assert.equal(upcomingMeeting([review], end, 10, { holdMinutes: -1 }), null);
});

test("dueMeetingBanner fires once per meeting id, respects privacy masking, and wakes even when remindMinutes is 0", () => {
  const start = 2_000 * MIN;
  const sync = event("薪酬委员会", start, start + 30 * MIN, {
    location: "https://vc.corp.example.com/j/secret",
  });
  const reminded = new Set();
  const opts = {
    bannerEnabled: true,
    bannerMinutes: 3,
    hideDeclined: true,
    ignoreFreeInCountdown: true,
    customMeetingDomain: "vc.corp.example.com",
  };

  assert.equal(nextChangeAt([sync], start - 10 * MIN, 0, opts), start - 3 * MIN);
  assert.equal(dueMeetingBanner([sync], start - 4 * MIN, opts, reminded), null);

  const due = dueMeetingBanner([sync], start - 3 * MIN, opts, reminded);
  assert.ok(due);
  assert.equal(due.id, meetingBannerId(sync));
  assert.equal(due.id, `calendar-meeting:薪酬委员会:${start}`);
  assert.equal(due.minutes, 3);

  const copy = { meeting: "会议", inMinutes: (m) => `${m} 分钟后`, started: "已开始" };
  const masked = formatMeetingBanner(due, false, copy);
  assert.equal(masked.title, "会议");
  assert.equal(masked.detail, "3 分钟后");
  assert.equal(masked.meetingLink, "https://vc.corp.example.com/j/secret");

  const visible = formatMeetingBanner(due, true, copy);
  assert.equal(visible.title, "薪酬委员会");

  reminded.add(due.id);
  assert.equal(dueMeetingBanner([sync], start - MIN, opts, reminded), null);
});

test("ISO week numbers, Monday/Sunday month grids, 7-day agenda starts and timed todo toggle", () => {
  assert.equal(isoWeekNumber(dayMs(2025, 12, 29)), 1);
  assert.equal(isoWeekNumber(dayMs(2026, 1, 1)), 1);
  assert.equal(isoWeekNumber(dayMs(2026, 11, 18)), 47);
  assert.equal(isoWeekNumber(dayMs(2027, 1, 1)), 53);

  const nov = monthStart(dayMs(2026, 11, 18));
  const autoGrid = monthDays(nov, "auto");
  const monGrid = monthDays(nov, "monday");
  const sunGrid = monthDays(nov, "sunday");
  assert.deepEqual(autoGrid, monGrid);
  assert.equal(monGrid[0], dayMs(2026, 10, 26));
  assert.equal(sunGrid[0], dayMs(2026, 11, 1));
  assert.equal(sunGrid.length, 42);
  assert.deepEqual(monthWeekNumbers(monGrid, "monday"), [44, 45, 46, 47, 48, 49]);
  assert.deepEqual(monthWeekNumbers(sunGrid, "sunday"), [45, 46, 47, 48, 49, 50]);

  const today = dayMs(2026, 11, 18);
  const picked = dayMs(2026, 11, 20);
  assert.equal(agendaDayStarts(today, today, "twoDays").length, 2);
  assert.deepEqual(agendaDayStarts(today, picked, "twoDays"), [picked]);
  const seven = agendaDayStarts(today, picked, "sevenDays");
  assert.equal(seven.length, 7);
  assert.equal(seven[0], picked);
  assert.equal(seven[6], dayMs(2026, 11, 26));

  const items = [{ id: "1", title: "14:00 评审", date: "2026-11-19" }];
  assert.equal(scheduledTodoEvents(items, "待办", true)[0].allDay, false);
  assert.equal(scheduledTodoEvents(items, "待办", false)[0].allDay, true);
});
