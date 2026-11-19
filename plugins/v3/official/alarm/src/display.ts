import { firstDayOf, formatAlarmTime, formatDays, systemFirstDay, systemUses12Hour, uses12Hour, weekOrder } from "./format.ts";
import type { AlarmSettings } from "./settingsModel.ts";
import { text } from "./text.ts";

const SYSTEM_12 = systemUses12Hour();
const SYSTEM_FIRST = systemFirstDay();

export type Display = {
  twelve: boolean;
  order: number[];
  time: (hhmm: string) => string;
  days: (days: readonly number[]) => string;
};

export function displayFor(settings: AlarmSettings): Display {
  const twelve = uses12Hour(settings.timeFormat, SYSTEM_12);
  const first = firstDayOf(settings.weekStart, SYSTEM_FIRST);
  const names = { ...text, joiner: text.isZh ? "、" : ", " };
  return {
    twelve,
    order: weekOrder(first),
    time: (hhmm) => formatAlarmTime(hhmm, twelve, text.am, text.pm, text.isZh),
    days: (days) => formatDays(days, first, names),
  };
}

export function clockOf(at: number): string {
  const dt = new Date(at);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}
