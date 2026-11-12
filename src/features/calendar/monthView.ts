import type { CalendarEvent } from "./api";
import { CHINESE_DAY_NAMES, chineseDay } from "./lunar.ts";

const DAY_MS = 86_400_000;

export function startOfDay(ms: number) {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function nextDay(dayStart: number) {
  const date = new Date(dayStart);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

export function monthStart(ms: number, months = 0) {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth() + months, 1).getTime();
}

export function monthDays(month: number) {
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - lead + index).getTime());
}

export function eventsOn(events: readonly CalendarEvent[], dayStart: number) {
  const end = nextDay(dayStart);
  return events.filter((event) => event.startMs < end && (event.endMs > dayStart || (event.endMs === event.startMs && event.startMs >= dayStart)));
}

export type DayMark = "off" | "work";

const OFF = /[（(]休[)）]\s*$/u;
const WORK = /[（(]班[)）]\s*$/u;
const LUNAR_DATE_TITLE = /^(?:闰)?[正二三四五六七八九十冬腊]月(?:初|十|廿|二十|三十)/u;

export function dayMark(events: readonly CalendarEvent[]): DayMark | null {
  const allDay = events.filter((event) => event.allDay);
  if (allDay.some((event) => WORK.test(event.title))) return "work";
  if (allDay.some((event) => OFF.test(event.title))) return "off";
  return null;
}

export function namesTheDay(event: CalendarEvent) {
  if (!event.allDay) return false;
  const title = event.title.trim();
  return OFF.test(title) || WORK.test(title) || LUNAR_DATE_TITLE.test(title)
    || CHINESE_DAY_NAMES.has(title) || CHINESE_DAY_NAMES.has(title.replace(/节$/u, "")) || CHINESE_DAY_NAMES.has(`${title}节`);
}

export function nextSpecialDay(from: number, withinDays = 31) {
  let day = startOfDay(from);
  for (let ahead = 1; ahead <= withinDays; ahead++) {
    day = nextDay(day);
    const { festival, term } = chineseDay(new Date(day));
    const name = festival ?? term;
    if (name) return { name, days: ahead };
  }
  return null;
}

export function isRead(snapshot: { fromMs: number; toMs: number }, dayStart: number) {
  return snapshot.toMs > snapshot.fromMs && dayStart >= snapshot.fromMs && dayStart + DAY_MS / 2 < snapshot.toMs;
}
