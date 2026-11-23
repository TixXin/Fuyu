import type { CalendarEvent } from "../api";
import { eventsOn, startOfDay } from "../monthView.ts";

const DAY_MS = 86_400_000;

export type MonthGrid = { year: number; month: number; days: number[]; sundayFirst: boolean };

export function monthGrid(now: number, offset: number, sundayFirst: boolean): MonthGrid {
  const today = new Date(now);
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const lead = sundayFirst ? first.getDay() : (first.getDay() + 6) % 7;
  const weeks = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, at) => new Date(year, month, 1 - lead + at).getTime());
  return { year, month, days, sundayFirst };
}

export function weekdayDates(sundayFirst: boolean): Date[] {
  return Array.from({ length: 7 }, (_, at) => new Date(2024, 0, (sundayFirst ? 7 : 8) + at));
}

export function busyDays(events: readonly CalendarEvent[], from: number, to: number): Set<number> {
  const days = new Set<number>();
  for (const event of events) {
    if (event.declined || event.endMs <= from || event.startMs >= to) continue;
    const last = Math.min(to - 1, Math.max(event.startMs, event.endMs - 1));
    for (let day = startOfDay(Math.max(from, event.startMs)); day <= last; day = startOfDay(day + DAY_MS + 3_600_000)) days.add(day);
  }
  return days;
}

export function dayAgenda(events: readonly CalendarEvent[], day: number, now: number): CalendarEvent[] {
  const list = eventsOn(events, day)
    .filter((event) => !event.declined)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMs - b.startMs);
  if (day !== startOfDay(now)) return list;
  const ahead = list.filter((event) => !event.allDay && event.endMs > now);
  return ahead.length > 0 ? [...ahead, ...list.filter((event) => !ahead.includes(event))] : list;
}
