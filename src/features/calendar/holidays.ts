import { addCalendarSource, type CalendarSource } from "./api";
import { CHINA_HOLIDAYS_LINK } from "./presets";

export function hasChinaHolidays(sources: readonly CalendarSource[]) {
  return sources.some((source) => source.kind === "ics" && source.host === new URL(CHINA_HOLIDAYS_LINK).host);
}

export function addChinaHolidays(name: string) {
  return addCalendarSource({ kind: "ics", name, url: "", username: "", secret: CHINA_HOLIDAYS_LINK });
}
