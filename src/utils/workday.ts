import { getLocalDateString } from "./date.ts";

export type HolidayDayMark = "off" | "work";

const OFF_MARK = /[（(]休[)）]\s*$/u;
const WORK_MARK = /[（(]班[)）]\s*$/u;
const DAY_MS = 86_400_000;

export function holidayTitleName(title: string): string {
  return title.trim().replace(OFF_MARK, "").replace(WORK_MARK, "").trim();
}

export function parseHolidayTitleMark(title: string): HolidayDayMark | null {
  const trimmed = title.trim();
  if (WORK_MARK.test(trimmed)) return "work";
  if (OFF_MARK.test(trimmed)) return "off";
  return null;
}

export function buildHolidayMarkMap(
  events: ReadonlyArray<{ startMs: number; endMs: number; allDay: boolean; title: string }>,
): Map<string, HolidayDayMark> {
  const map = new Map<string, HolidayDayMark>();
  for (const event of events) {
    if (!event.allDay) continue;
    const mark = parseHolidayTitleMark(event.title);
    if (!mark) continue;
    const start = new Date(event.startMs);
    const firstDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const spanDays = Math.max(1, Math.min(31, Math.round((event.endMs - event.startMs) / DAY_MS)));
    for (let offset = 0; offset < spanDays; offset += 1) {
      const dateStr = getLocalDateString(new Date(firstDay + offset * DAY_MS));
      if (mark === "work" || !map.has(dateStr)) {
        map.set(dateStr, mark);
      }
    }
  }
  return map;
}

export function isStatutoryWorkday(
  dateStr: string,
  marks?: ReadonlyMap<string, HolidayDayMark>,
): boolean {
  const override = marks?.get(dateStr);
  if (override === "work") return true;
  if (override === "off") return false;
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return true;
  const day = parsed.getDay();
  return day >= 1 && day <= 5;
}
