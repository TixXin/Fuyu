import { getLocalDateString } from "../../utils/date.ts";
import { buildHolidayMarkMap, holidayTitleName, isStatutoryWorkday, parseHolidayTitleMark, type HolidayDayMark } from "../../utils/workday.ts";

type HolidayEvent = { startMs: number; endMs: number; allDay: boolean; title: string };
type Marks = ReadonlyMap<string, HolidayDayMark>;

export const EVE_HOUR = 20;
const MAX_BREAK_DAYS = 31;
const DAY_MS = 86_400_000;

export type HolidayBreak = { name: string | null; start: string; days: number; length: number };
export type HolidayEve =
  | { kind: "work"; date: string }
  | { kind: "off"; date: string; name: string | null; length: number };

function shift(date: string, days: number) {
  const base = new Date(`${date}T00:00:00`);
  return getLocalDateString(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / DAY_MS);
}

function restLength(start: string, marks: Marks) {
  let length = 0;
  let cursor = start;
  while (length < MAX_BREAK_DAYS && !isStatutoryWorkday(cursor, marks)) {
    length += 1;
    cursor = shift(cursor, 1);
  }
  return length;
}

function breakNames(events: readonly HolidayEvent[]) {
  const names = new Map<string, string>();
  for (const event of events) {
    if (!event.allDay || parseHolidayTitleMark(event.title) !== "off") continue;
    const name = holidayTitleName(event.title);
    if (!name) continue;
    const span = Math.max(1, Math.min(MAX_BREAK_DAYS, Math.round((event.endMs - event.startMs) / DAY_MS)));
    const first = getLocalDateString(new Date(event.startMs));
    for (let offset = 0; offset < span; offset += 1) {
      const date = shift(first, offset);
      if (!names.has(date)) names.set(date, name);
    }
  }
  return names;
}

function nameOf(start: string, length: number, names: ReadonlyMap<string, string>) {
  for (let offset = 0; offset < length; offset += 1) {
    const name = names.get(shift(start, offset));
    if (name) return name;
  }
  return null;
}

export function nextHolidayBreak(events: readonly HolidayEvent[], now: Date, withinDays = 120): HolidayBreak | null {
  const marks = buildHolidayMarkMap(events);
  if (marks.size === 0) return null;
  const today = getLocalDateString(now);
  let cursor = shift(today, 1);
  if (!isStatutoryWorkday(today, marks)) {
    while (!isStatutoryWorkday(cursor, marks) && daysBetween(today, cursor) <= MAX_BREAK_DAYS) cursor = shift(cursor, 1);
  }
  const names = breakNames(events);
  for (; daysBetween(today, cursor) <= withinDays; cursor = shift(cursor, 1)) {
    if (marks.get(cursor) !== "off") continue;
    let start = cursor;
    while (daysBetween(today, start) > 1 && !isStatutoryWorkday(shift(start, -1), marks)) start = shift(start, -1);
    const length = restLength(start, marks);
    return { name: nameOf(start, length, names), start, days: daysBetween(today, start), length };
  }
  return null;
}

export function holidayEve(events: readonly HolidayEvent[], now: Date, hour = EVE_HOUR): HolidayEve | null {
  if (now.getHours() < hour) return null;
  const marks = buildHolidayMarkMap(events);
  const today = getLocalDateString(now);
  const tomorrow = shift(today, 1);
  const mark = marks.get(tomorrow);
  if (mark === "work") {
    const weekday = new Date(`${tomorrow}T00:00:00`).getDay();
    return weekday === 0 || weekday === 6 ? { kind: "work", date: tomorrow } : null;
  }
  if (!isStatutoryWorkday(today, marks) || isStatutoryWorkday(tomorrow, marks)) return null;
  const length = restLength(tomorrow, marks);
  const covers = Array.from({ length }, (_, offset) => marks.get(shift(tomorrow, offset))).includes("off");
  if (!covers) return null;
  return { kind: "off", date: tomorrow, name: nameOf(tomorrow, length, breakNames(events)), length };
}
