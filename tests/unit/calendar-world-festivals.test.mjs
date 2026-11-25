import assert from "node:assert/strict";
import test from "node:test";
import { chineseDay } from "../../src/utils/lunar.ts";
import { DEFAULT_CALENDAR_PREFS, normalizeCalendarPrefs } from "../../src/features/calendar/calendarPrefs.ts";
import {
  HOLIDAY_REGIONS,
  ICLOUD_HOLIDAYS_HOST,
  hasChinaHolidays,
  hasHolidayRegion,
  holidayLinkFor,
} from "../../src/features/calendar/holidayRegions.ts";
import { easterDate, internationalFestival } from "../../src/features/calendar/worldFestivals.ts";

const day = (y, m, d) => new Date(y, m - 1, d);

test("internationalFestival returns fixed and floating international holidays in both locales", () => {
  assert.deepEqual(easterDate(2026), { month: 4, day: 5 });
  assert.deepEqual(easterDate(2027), { month: 3, day: 28 });

  assert.equal(internationalFestival(day(2026, 12, 1), "zh-CN"), "艾滋病日");
  assert.equal(internationalFestival(day(2026, 12, 1), "en"), "AIDS Day");
  assert.equal(internationalFestival(day(2026, 10, 31), "zh-CN"), "万圣夜");
  assert.equal(internationalFestival(day(2026, 10, 31), "en"), "Halloween");
  assert.equal(internationalFestival(day(2026, 11, 26), "zh-CN"), "感恩节");
  assert.equal(internationalFestival(day(2026, 11, 26), "en"), "Thanksgiving");
  assert.equal(internationalFestival(day(2027, 3, 28), "zh-CN"), "复活节");
  assert.equal(internationalFestival(day(2027, 3, 28), "en"), "Easter");
  assert.equal(internationalFestival(day(2026, 4, 22), "zh-CN"), "地球日");
  assert.equal(internationalFestival(day(2026, 12, 20), "zh-CN"), "澳门回归");
  assert.equal(internationalFestival(day(2026, 12, 25), "zh-CN"), null);
  assert.equal(internationalFestival(day(2026, 12, 25), "en"), "Christmas");
  assert.equal(internationalFestival(day(2026, 5, 10), "en"), "Mother's Day");
  assert.equal(internationalFestival(day(2026, 6, 21), "en"), "Father's Day");
});

test("Chinese festivals and solar terms stay higher priority than overlapping international days", () => {
  const qingming2026 = chineseDay(day(2026, 4, 5));
  assert.equal(qingming2026.term, "清明");
  assert.equal(internationalFestival(day(2026, 4, 5), "zh-CN"), "复活节");
  const resolved = qingming2026.festival ?? qingming2026.term ?? qingming2026.memorial ?? internationalFestival(day(2026, 4, 5), "zh-CN");
  assert.equal(resolved, "清明");

  const memorialDay = chineseDay(day(2026, 12, 13));
  assert.equal(memorialDay.memorial, "公祭日");
});

test("CalendarPrefs defaults showInternationalFestivals to true and normalizes booleans", () => {
  assert.equal(DEFAULT_CALENDAR_PREFS.showInternationalFestivals, true);
  assert.equal(normalizeCalendarPrefs({}).showInternationalFestivals, true);
  assert.equal(normalizeCalendarPrefs({ showInternationalFestivals: false }).showInternationalFestivals, false);
  assert.equal(normalizeCalendarPrefs({ showInternationalFestivals: 0 }).showInternationalFestivals, false);
});

test("multi-region holiday links and subscription detection coexist without false positives", () => {
  assert.equal(HOLIDAY_REGIONS.length, 13);
  assert.equal(holidayLinkFor("cn"), "https://calendars.icloud.com/holidays/cn_zh.ics");
  assert.equal(holidayLinkFor("us"), "https://calendars.icloud.com/holidays/us_en.ics");
  assert.equal(holidayLinkFor("jp"), "https://calendars.icloud.com/holidays/jp_ja.ics");

  const usOnly = [{ kind: "ics", host: ICLOUD_HOLIDAYS_HOST, name: "美国节假日" }];
  assert.equal(hasHolidayRegion(usOnly, "us"), true);
  assert.equal(hasHolidayRegion(usOnly, "jp"), false);
  assert.equal(hasChinaHolidays(usOnly), false);

  const cnAndJp = [
    { kind: "ics", host: ICLOUD_HOLIDAYS_HOST, name: "中国节假日" },
    { kind: "ics", host: ICLOUD_HOLIDAYS_HOST, name: "Japan holidays" },
  ];
  assert.equal(hasChinaHolidays(cnAndJp), true);
  assert.equal(hasHolidayRegion(cnAndJp, "jp"), true);
  assert.equal(hasHolidayRegion(cnAndJp, "us"), false);

  const legacyCustomCn = [{ kind: "ics", host: ICLOUD_HOLIDAYS_HOST, name: "法定节假日" }];
  assert.equal(hasChinaHolidays(legacyCustomCn), true);
  assert.equal(hasHolidayRegion(legacyCustomCn, "us"), false);
});
