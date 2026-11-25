import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLunarDate,
  lunarDate,
  lunarLeapMonth,
  lunarMonthDays,
  lunarParts,
  lunarToSolar,
} from "../../src/utils/lunar.ts";
import {
  convertDateBetweenCalendars,
  countdownTarget,
  daysBetween,
  formatCountdownLunar,
  normalizeLunarDateText,
} from "../../src/features/daily-widgets/countdowns.ts";
import { parseDaily, serializeDaily } from "../../src/features/daily-widgets/dailyFormat.ts";

const ymd = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("lunarToSolar inverts lunarParts across regular months, leap months, and 29-day clamping", () => {
  assert.equal(lunarLeapMonth(2025), 6);
  assert.equal(lunarLeapMonth(2026), 0);
  assert.equal(lunarMonthDays(2025, 6, true), 29);
  assert.equal(lunarMonthDays(2026, 6, true), 0);

  const samples = [
    [1900, 1, 1, false, "1900-01-31"],
    [2025, 6, 1, true, "2025-07-25"],
    [2026, 8, 15, false, "2026-09-25"],
    [2026, 10, 1, false, "2026-11-09"],
    [2027, 1, 1, false, "2027-02-06"],
  ];
  for (const [y, m, d, leap, expected] of samples) {
    const solar = lunarToSolar(y, m, d, leap, true);
    assert.ok(solar);
    assert.equal(ymd(solar), expected);
    assert.deepEqual(lunarParts(solar), { year: y, month: m, day: d, leap });
  }

  assert.equal(lunarToSolar(2026, 6, 5, true, true), null);
  const fallback = lunarToSolar(2026, 6, 5, true, false);
  assert.ok(fallback);
  assert.deepEqual(lunarDate(fallback), { month: "六月", day: 5 });

  const newYearEve2026 = lunarToSolar(2026, 12, 30, false);
  assert.ok(newYearEve2026);
  assert.equal(ymd(newYearEve2026), "2027-02-05");
  assert.equal(formatLunarDate(8, 15, false), "八月十五");
  assert.equal(formatLunarDate(6, 5, true, 2025), "2025年闰六月初五");
});

test("normalizeLunarDateText parses numeric, Chinese, leap-month, and New Year Eve inputs", () => {
  assert.deepEqual(normalizeLunarDateText("08-15"), { date: "08-15" });
  assert.deepEqual(normalizeLunarDateText("8.15"), { date: "08-15" });
  assert.deepEqual(normalizeLunarDateText("农历八月十五"), { date: "08-15" });
  assert.deepEqual(normalizeLunarDateText("正月初一"), { date: "01-01" });
  assert.deepEqual(normalizeLunarDateText("腊月廿三"), { date: "12-23" });
  assert.deepEqual(normalizeLunarDateText("冬月二十"), { date: "11-20" });
  assert.deepEqual(normalizeLunarDateText("除夕"), { date: "12-30" });
  assert.deepEqual(normalizeLunarDateText("2026年除夕"), { date: "2026-12-29" });
  assert.deepEqual(normalizeLunarDateText("闰六月初五"), { date: "06-05", leap: true });
  assert.deepEqual(normalizeLunarDateText("2025-闰6-15"), { date: "2025-06-15", leap: true });
  assert.equal(normalizeLunarDateText("2026-闰6-15"), null);
  assert.equal(normalizeLunarDateText("2025-闰6-30"), null);
  assert.equal(normalizeLunarDateText("13-01"), null);
  assert.equal(normalizeLunarDateText("bad"), null);
});

test("countdownTarget resolves yearly and fixed lunar dates across Gregorian year boundaries", () => {
  const jan2027 = new Date(2027, 0, 10, 12);
  const spring2027 = countdownTarget({ date: "01-01", calendar: "lunar" }, jan2027);
  assert.equal(ymd(spring2027), "2027-02-06");
  assert.equal(daysBetween(jan2027, spring2027), 27);

  const eve2027 = countdownTarget({ date: "12-30", calendar: "lunar" }, jan2027);
  assert.equal(ymd(eve2027), "2027-02-05");

  const afterMidAutumn = new Date(2026, 8, 26, 12);
  const nextMidAutumn = countdownTarget({ date: "08-15", calendar: "lunar" }, afterMidAutumn);
  assert.equal(ymd(nextMidAutumn), "2027-09-15");

  const fixed = countdownTarget({ date: "2025-06-01", calendar: "lunar", leap: true }, new Date(2025, 6, 20, 12));
  assert.equal(ymd(fixed), "2025-07-25");

  assert.equal(formatCountdownLunar("08-15", false, "zh-CN"), "八月十五");
  assert.equal(formatCountdownLunar("06-05", true, "zh-CN"), "闰六月初五");
  assert.equal(formatCountdownLunar("06-05", true, "en"), "Leap 06-05");

  assert.equal(convertDateBetweenCalendars("2026-09-25", "solar", "lunar", new Date(2026, 0, 1)), "2026-08-15");
  assert.equal(convertDateBetweenCalendars("2026-08-15", "lunar", "solar", new Date(2026, 0, 1)), "2026-09-25");
});

test("parseDaily and serializeDaily preserve lunar countdown entries while keeping solar shape unchanged", () => {
  const raw = {
    version: 1,
    water: {},
    habits: {},
    checkins: [],
    focus: {},
    note: "",
    pomodoro: { endsAt: null, leftMs: 1_500_000, minutes: 25 },
    countdowns: [
      { name: "中秋", date: "08-15", calendar: "lunar" },
      { name: "闰月生日", date: "06-05", calendar: "lunar", leap: true },
      { name: "无效闰年", date: "2026-06-05", calendar: "lunar", leap: true },
      { name: "元旦", date: "01-01" },
    ],
    countdownAt: 1,
  };
  const parsed = parseDaily(raw);
  assert.deepEqual(parsed.countdowns, [
    { name: "中秋", date: "08-15", calendar: "lunar" },
    { name: "闰月生日", date: "06-05", calendar: "lunar", leap: true },
    { name: "元旦", date: "01-01" },
  ]);
  const serialized = serializeDaily(parsed, "2026-01-01");
  assert.deepEqual(serialized.countdowns, parsed.countdowns);
});
