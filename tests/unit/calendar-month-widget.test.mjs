import assert from "node:assert/strict";
import test from "node:test";
import { effectiveWeekStart, localeWeekStart } from "../../src/features/calendar/monthView.ts";
import { dayAgenda, monthGrid } from "../../src/features/calendar/plugin/monthWidgetDays.ts";

const ms = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const event = (title, startMs, endMs, fields = {}) => ({ uid: title, title, startMs, endMs, allDay: false, location: null, meetingLink: null, calendar: "work", ...fields });

test("auto week start follows the interface language, an explicit choice wins", () => {
  assert.equal(localeWeekStart("zh-CN"), "monday");
  assert.equal(localeWeekStart("en"), "sunday");
  assert.equal(localeWeekStart("en-GB"), "monday");
  assert.equal(localeWeekStart("not a locale!"), "monday");
  assert.equal(effectiveWeekStart("auto", "en"), "sunday");
  assert.equal(effectiveWeekStart("monday", "en"), "monday");
  assert.equal(effectiveWeekStart("sunday", "zh-CN"), "sunday");
});

test("the month grid starts on the chosen weekday and only keeps weeks that touch the month", () => {
  const monday = monthGrid(ms(2026, 11, 22), 0, false);
  assert.equal(new Date(monday.days[0]).getDay(), 1);
  assert.equal(monday.days.length, 42);
  const sunday = monthGrid(ms(2026, 11, 22), 0, true);
  assert.equal(new Date(sunday.days[0]).getDay(), 0);
  assert.equal(new Date(sunday.days[0]).getDate(), 1);
  assert.equal(sunday.days.length, 35);
  const next = monthGrid(ms(2026, 12, 31), 1, false);
  assert.deepEqual([next.year, next.month], [2027, 0]);
});

test("a day's agenda skips declined events and puts today's upcoming meetings first", () => {
  const now = ms(2026, 11, 22, 12);
  const events = [
    event("morning", ms(2026, 11, 22, 9), ms(2026, 11, 22, 10)),
    event("afternoon", ms(2026, 11, 22, 15), ms(2026, 11, 22, 16)),
    event("declined", ms(2026, 11, 22, 17), ms(2026, 11, 22, 18), { declined: true }),
    event("tomorrow", ms(2026, 11, 23, 9), ms(2026, 11, 23, 10)),
  ];
  assert.deepEqual(dayAgenda(events, ms(2026, 11, 22), now).map((item) => item.title), ["afternoon", "morning"]);
  assert.deepEqual(dayAgenda(events, ms(2026, 11, 23), now).map((item) => item.title), ["tomorrow"]);
});
