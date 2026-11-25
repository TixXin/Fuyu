import { addCalendarSource } from "./api";
import { hasChinaHolidays, hasHolidayRegion, HOLIDAY_REGIONS, holidayLinkFor, type HolidayRegionId } from "./holidayRegions.ts";

export { hasChinaHolidays, hasHolidayRegion, HOLIDAY_REGIONS, holidayLinkFor, type HolidayRegionId };

export function addHolidayRegion(region: HolidayRegionId, name: string) {
  return addCalendarSource({ kind: "ics", name, url: "", username: "", secret: holidayLinkFor(region) });
}

export function addChinaHolidays(name: string) {
  return addHolidayRegion("cn", name);
}
