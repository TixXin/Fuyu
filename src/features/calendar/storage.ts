import { readJson, writeJson } from "../../lib/storage.ts";
import { normalizeCalendarPrefs, type CalendarPrefs } from "./calendarPrefs.ts";

export const CALENDAR_PREFS_KEY = "fuyu-calendar-prefs";
export const CALENDAR_REFRESH_KEY = "fuyu-calendar-refresh-at";
export const CALENDAR_EVE_KEY = "fuyu-calendar-eve-reminded";

export function loadCalendarPrefs(): CalendarPrefs {
  return normalizeCalendarPrefs(readJson(CALENDAR_PREFS_KEY));
}

export function saveCalendarPrefs(prefs: CalendarPrefs): boolean {
  return writeJson(CALENDAR_PREFS_KEY, normalizeCalendarPrefs(prefs));
}

export function notifyCalendarRefresh(at = Date.now()): boolean {
  return writeJson(CALENDAR_REFRESH_KEY, at);
}

export function loadEveReminded(): string {
  const saved = readJson(CALENDAR_EVE_KEY);
  return typeof saved === "string" ? saved : "";
}

export function saveEveReminded(date: string): boolean {
  return writeJson(CALENDAR_EVE_KEY, date);
}
