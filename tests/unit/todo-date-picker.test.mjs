import assert from "node:assert/strict";
import test from "node:test";
import { firstDayOfWeek, monthGrid, moveDate, nextMonday, placeCalendar, shiftMonth, weekdayNames } from "../../src/features/todos/datePicker.ts";

test("month grid starts on the locale's first weekday and marks past, today and outside days", () => {
  const sunday = monthGrid("2026-11", "2026-11-14", 0);
  assert.equal(sunday.length, 42);
  assert.equal(sunday[0].date, "2026-11-01");
  const monday = monthGrid("2026-11", "2026-11-14", 1);
  assert.equal(monday[0].date, "2026-10-26");
  assert.deepEqual(monday[0], { date: "2026-10-26", day: 26, inMonth: false, past: true, today: false });
  const today = monday.find((day) => day.today);
  assert.equal(today.date, "2026-11-14");
  assert.equal(today.past, false);
  assert.equal(monday.find((day) => day.date === "2026-11-13").past, true);
  assert.deepEqual(monday.at(-1), { date: "2026-12-06", day: 6, inMonth: false, past: false, today: false });
});

test("months shift across years", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("keyboard moves by day, week, month and to the ends of the week", () => {
  assert.equal(moveDate("2026-11-14", "ArrowRight", 1), "2026-11-15");
  assert.equal(moveDate("2026-11-14", "ArrowUp", 1), "2026-11-07");
  assert.equal(moveDate("2026-11-30", "ArrowDown", 1), "2026-12-07");
  assert.equal(moveDate("2027-01-31", "PageDown", 1), "2027-02-28");
  assert.equal(moveDate("2026-11-14", "Home", 1), "2026-11-09");
  assert.equal(moveDate("2026-11-14", "End", 1), "2026-11-15");
  assert.equal(moveDate("2026-11-14", "Home", 0), "2026-11-08");
  assert.equal(moveDate("2026-11-14", "a", 1), null);
});

test("next Monday is always in the following week", () => {
  assert.equal(nextMonday("2026-11-14"), "2026-11-16");
  assert.equal(nextMonday("2026-11-15"), "2026-11-16");
  assert.equal(nextMonday("2026-11-16"), "2026-11-23");
});

test("week starts Monday in Chinese and Sunday in US English", () => {
  assert.equal(firstDayOfWeek("zh-CN"), 1);
  assert.equal(firstDayOfWeek("en-US"), 0);
  assert.equal(weekdayNames("zh-CN", 1).join(""), "一二三四五六日");
  assert.equal(weekdayNames("en-US", 0)[0], "Su");
});

test("the calendar sits under the button, above it, beside it, or clamped inside the island", () => {
  const island = { left: 0, top: 0, right: 560, bottom: 600 };
  const size = { width: 236, height: 260 };
  const button = { left: 470, top: 80, right: 540, bottom: 104 };
  assert.deepEqual(placeCalendar(button, size, island), { left: 304, top: 110 });
  const low = { left: 470, top: 500, right: 540, bottom: 524 };
  assert.deepEqual(placeCalendar(low, size, island), { left: 304, top: 234 });
  const short = { left: 0, top: 0, right: 560, bottom: 306 };
  assert.deepEqual(placeCalendar(button, size, short), { left: 228, top: 40 });
  const narrow = { left: 0, top: 0, right: 300, bottom: 306 };
  assert.deepEqual(placeCalendar({ left: 200, top: 80, right: 270, bottom: 104 }, size, narrow), { left: 34, top: 40 });
});
