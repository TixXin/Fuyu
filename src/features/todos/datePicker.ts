import { getLocalDateString } from "../../utils/date.ts";
import { addDays } from "./schedule.ts";

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
  past: boolean;
  today: boolean;
};

const parse = (date: string) => new Date(`${date}T00:00:00`);

export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split("-").map(Number);
  const next = new Date(year, index - 1 + delta, 1);
  return getLocalDateString(next).slice(0, 7);
}

export function weekdayOf(date: string) {
  return parse(date).getDay();
}

export function monthGrid(month: string, today: string, firstDay: number): CalendarDay[] {
  const first = `${month}-01`;
  const lead = (weekdayOf(first) - firstDay + 7) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return { date, day: parse(date).getDate(), inMonth: monthOf(date) === month, past: date < today, today: date === today };
  });
}

export function weekdayNames(localeTag: string, firstDay: number) {
  const narrow = localeTag.toLowerCase().startsWith("zh");
  const format = new Intl.DateTimeFormat(localeTag, { weekday: narrow ? "narrow" : "short" });
  return Array.from({ length: 7 }, (_, index) => {
    const name = format.format(new Date(2024, 0, 7 + ((firstDay + index) % 7)));
    return narrow ? name : name.slice(0, 2);
  });
}

export function firstDayOfWeek(localeTag: string) {
  try {
    const locale = new Intl.Locale(localeTag) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info && Number.isInteger(info.firstDay)) return info.firstDay % 7;
  } catch {
    return 0;
  }
  return localeTag.toLowerCase().startsWith("zh") ? 1 : 0;
}

export function nextMonday(today: string) {
  return addDays(today, ((8 - weekdayOf(today)) % 7) || 7);
}

function addMonthsClamped(date: string, delta: number) {
  const month = shiftMonth(monthOf(date), delta);
  const day = Number(date.slice(8, 10));
  const [year, index] = month.split("-").map(Number);
  const last = new Date(year, index, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export function moveDate(date: string, key: string, firstDay: number): string | null {
  switch (key) {
    case "ArrowLeft": return addDays(date, -1);
    case "ArrowRight": return addDays(date, 1);
    case "ArrowUp": return addDays(date, -7);
    case "ArrowDown": return addDays(date, 7);
    case "PageUp": return addMonthsClamped(date, -1);
    case "PageDown": return addMonthsClamped(date, 1);
    case "Home": return addDays(date, -((weekdayOf(date) - firstDay + 7) % 7));
    case "End": return addDays(date, 6 - ((weekdayOf(date) - firstDay + 7) % 7));
    default: return null;
  }
}

export type Box = { left: number; top: number; right: number; bottom: number };

export function placeCalendar(anchor: Box, size: { width: number; height: number }, bounds: Box, gap = 6, edge = 6) {
  const clampX = (left: number) => Math.max(bounds.left + edge, Math.min(left, bounds.right - edge - size.width));
  const clampY = (top: number) => Math.max(bounds.top + edge, Math.min(top, bounds.bottom - edge - size.height));
  const alignedLeft = clampX(anchor.right - size.width);
  if (anchor.bottom + gap + size.height <= bounds.bottom - edge) return { left: alignedLeft, top: anchor.bottom + gap };
  if (anchor.top - gap - size.height >= bounds.top + edge) return { left: alignedLeft, top: anchor.top - gap - size.height };
  const beside = anchor.left - gap - size.width;
  if (beside >= bounds.left + edge) return { left: beside, top: clampY(anchor.top) };
  return { left: alignedLeft, top: clampY(anchor.bottom + gap) };
}
