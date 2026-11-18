import { readJson, writeJson } from "../../lib/storage.ts";
import { normalizeCalendarPrefs, type CalendarPrefs } from "./calendarPrefs.ts";

export const CALENDAR_PREFS_KEY = "fuyu-calendar-prefs";
export const CALENDAR_REFRESH_KEY = "fuyu-calendar-refresh-at";

export function loadCalendarPrefs(): CalendarPrefs {
  return normalizeCalendarPrefs(readJson(CALENDAR_PREFS_KEY));
}

export function saveCalendarPrefs(prefs: CalendarPrefs): boolean {
  return writeJson(CALENDAR_PREFS_KEY, normalizeCalendarPrefs(prefs));
}

export function notifyCalendarRefresh(at = Date.now()): boolean {
  return writeJson(CALENDAR_REFRESH_KEY, at);
}
