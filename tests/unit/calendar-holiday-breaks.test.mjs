import assert from "node:assert/strict";
import test from "node:test";
import { holidayEve, nextHolidayBreak } from "../../src/features/calendar/holidayBreaks.ts";
import { holidayTitleName } from "../../src/utils/workday.ts";

const DAY = 86_400_000;
const allDay = (title, y, m, d, days = 1) => {
  const startMs = new Date(y, m - 1, d).getTime();
  return { uid: title, title, startMs, endMs: startMs + days * DAY, allDay: true };
};
const EVENTS = [
  allDay("中秋节（休）", 2026, 9, 25, 3),
  allDay("国庆节（休）", 2026, 10, 1, 7),
  allDay("补班（班）", 2026, 9, 20),
  allDay("补班（班）", 2026, 10, 10),
  allDay("中秋节", 2026, 9, 25),
];
const at = (y, m, d, h = 9) => new Date(y, m - 1, d, h, 30);

test("holiday names drop the off and work marks", () => {
  assert.equal(holidayTitleName("国庆节（休）"), "国庆节");
  assert.equal(holidayTitleName("春节 (休)"), "春节");
  assert.equal(holidayTitleName("补班（班）"), "补班");
});

test("the next break counts the days until it starts and how long it runs", () => {
  assert.deepEqual(nextHolidayBreak(EVENTS, at(2026, 9, 10)), { name: "中秋节", start: "2026-09-25", days: 15, length: 3 });
  assert.deepEqual(nextHolidayBreak(EVENTS, at(2026, 9, 24)), { name: "中秋节", start: "2026-09-25", days: 1, length: 3 });
  assert.deepEqual(nextHolidayBreak(EVENTS, at(2026, 9, 26)), { name: "国庆节", start: "2026-10-01", days: 5, length: 7 });
  assert.equal(nextHolidayBreak(EVENTS, at(2026, 10, 12)), null);
  assert.equal(nextHolidayBreak([], at(2026, 9, 10)), null);
});

test("a break that starts after a plain weekend begins on the Saturday", () => {
  const events = [allDay("清明节（休）", 2027, 4, 5)];
  assert.deepEqual(nextHolidayBreak(events, at(2027, 3, 31)), { name: "清明节", start: "2027-04-03", days: 3, length: 3 });
});

test("the evening before a make-up workday or the first day off gets one reminder", () => {
  assert.deepEqual(holidayEve(EVENTS, at(2026, 9, 19, 20)), { kind: "work", date: "2026-09-20" });
  assert.equal(holidayEve(EVENTS, at(2026, 9, 19, 19)), null);
  assert.deepEqual(holidayEve(EVENTS, at(2026, 9, 24, 21)), { kind: "off", date: "2026-09-25", name: "中秋节", length: 3 });
  assert.deepEqual(holidayEve(EVENTS, at(2026, 9, 30, 21)), { kind: "off", date: "2026-10-01", name: "国庆节", length: 7 });
  assert.deepEqual(holidayEve(EVENTS, at(2026, 10, 9, 22)), { kind: "work", date: "2026-10-10" });
  assert.equal(holidayEve(EVENTS, at(2026, 9, 25, 21)), null);
  assert.equal(holidayEve(EVENTS, at(2026, 11, 20, 21)), null);
});

test("a plain weekend before a day off counts as the start of the break", () => {
  const events = [allDay("清明节（休）", 2027, 4, 5)];
  assert.deepEqual(holidayEve(events, at(2027, 4, 2, 20)), { kind: "off", date: "2027-04-03", name: "清明节", length: 3 });
});
