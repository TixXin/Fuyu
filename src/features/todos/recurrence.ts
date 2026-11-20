import { getLocalDateString } from "../../utils/date.ts";
import { lunarDate } from "../../utils/lunar.ts";
import { isStatutoryWorkday, type HolidayDayMark } from "../../utils/workday.ts";
import { addDays, isDateString } from "./schedule.ts";
import type { ScheduledTodo, TodoRecurrence, TodoRecurrenceKind } from "./types.ts";

export const TODO_RECURRENCE_KINDS: readonly TodoRecurrenceKind[] = [
  "daily",
  "workdays",
  "weekly",
  "monthly",
  "yearly",
  "lunarYearly",
];

const MAX_RECURRENCE_INTERVAL = 365;
const MAX_WORKDAY_SCAN = 400;
const MAX_LUNAR_YEAR_SCAN = 400;

export function readRecurrence(value: unknown): TodoRecurrence | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const kind = TODO_RECURRENCE_KINDS.find((candidate) => candidate === raw.kind);
  if (!kind) return undefined;
  if (typeof raw.interval === "number" && Number.isFinite(raw.interval)) {
    const clamped = Math.max(1, Math.min(MAX_RECURRENCE_INTERVAL, Math.floor(raw.interval)));
    return clamped > 1 ? { kind, interval: clamped } : { kind };
  }
  return { kind };
}

function addMonthsClamped(dateStr: string, months: number): string {
  const base = new Date(`${dateStr}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth() + months;
  const targetDay = base.getDate();
  const firstOfTarget = new Date(year, month, 1);
  const maxDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  const clamped = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(targetDay, maxDay));
  return getLocalDateString(clamped);
}

function lunarOf(dateStr: string) {
  return lunarDate(new Date(`${dateStr}T00:00:00`));
}

function addLunarYears(dateStr: string, years: number): string {
  const anchor = lunarOf(dateStr);
  if (!anchor) return addMonthsClamped(dateStr, 12 * years);
  const month = anchor.month.replace(/^闰/u, "");
  let cursor = addDays(dateStr, 1);
  let remaining = years;
  for (let step = 0; step < MAX_LUNAR_YEAR_SCAN * years; step += 1) {
    const lunar = lunarOf(cursor);
    if (!lunar) break;
    if (lunar.month === month && lunar.day === Math.min(anchor.day, 29)) {
      const next = addDays(cursor, 1);
      const following = lunarOf(next);
      const hit = anchor.day < 30 ? cursor : following?.month === month && following.day === 30 ? next : cursor;
      remaining -= 1;
      if (remaining <= 0) return hit;
      cursor = addDays(hit, 300);
      continue;
    }
    cursor = addDays(cursor, 1);
  }
  return addMonthsClamped(dateStr, 12 * years);
}

export function nextOccurrenceDate(
  fromDate: string,
  recurrence: TodoRecurrence,
  holidayMarks?: ReadonlyMap<string, HolidayDayMark>,
): string {
  if (!isDateString(fromDate)) return fromDate;
  const interval = recurrence.interval && recurrence.interval > 1 ? Math.floor(recurrence.interval) : 1;
  switch (recurrence.kind) {
    case "daily":
      return addDays(fromDate, interval);
    case "weekly":
      return addDays(fromDate, 7 * interval);
    case "monthly":
      return addMonthsClamped(fromDate, interval);
    case "yearly":
      return addMonthsClamped(fromDate, 12 * interval);
    case "lunarYearly":
      return addLunarYears(fromDate, interval);
    case "workdays": {
      let cursor = fromDate;
      let remaining = interval;
      for (let step = 0; step < MAX_WORKDAY_SCAN * interval; step += 1) {
        cursor = addDays(cursor, 1);
        if (isStatutoryWorkday(cursor, holidayMarks)) {
          remaining -= 1;
          if (remaining <= 0) return cursor;
        }
      }
      return addDays(fromDate, 1);
    }
  }
}

export function sameRecurrence(a: TodoRecurrence | undefined, b: TodoRecurrence | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && (a.interval ?? 1) === (b.interval ?? 1);
}

export function hasPendingRecurringSchedule(
  scheduled: readonly ScheduledTodo[],
  title: string,
  project: string | undefined,
  recurrence: TodoRecurrence,
  afterDate: string,
): boolean {
  const normalizedTitle = title.trim();
  const normalizedProject = project || undefined;
  return scheduled.some(
    (item) =>
      item.date > afterDate &&
      item.title.trim() === normalizedTitle &&
      (item.project || undefined) === normalizedProject &&
      sameRecurrence(item.recurrence, recurrence),
  );
}
