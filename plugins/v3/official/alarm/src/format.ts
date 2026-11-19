import type { TimeFormat, WeekStart } from "./settingsModel.ts";

export type DayNames = {
  weekdays: readonly string[];
  once: string;
  everyday: string;
  workdays: string;
  weekend: string;
  joiner: string;
};

export function systemUses12Hour(locale?: string): boolean {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
    return cycle === "h11" || cycle === "h12";
  } catch {
    return false;
  }
}

export function systemFirstDay(locale?: string): number {
  try {
    const tag = locale ?? Intl.DateTimeFormat().resolvedOptions().locale;
    const loc = new Intl.Locale(tag) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info && typeof info.firstDay === "number") return info.firstDay % 7;
    return /^(en-US|en-CA|ja|ko|he|pt-BR|zh-TW|zh-HK)/i.test(tag) ? 0 : 1;
  } catch {
    return 1;
  }
}

export function firstDayOf(setting: WeekStart, systemDay: number): number {
  if (setting === "mon") return 1;
  if (setting === "sun") return 0;
  if (setting === "sat") return 6;
  return systemDay;
}

export function weekOrder(firstDay: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (firstDay + i) % 7);
}

export function uses12Hour(format: TimeFormat, systemIs12: boolean): boolean {
  return format === "12" || (format === "system" && systemIs12);
}

export function formatAlarmTime(hhmm: string, twelve: boolean, am: string, pm: string, zh: boolean): string {
  if (!twelve) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  const mark = h < 12 ? am : pm;
  const clock = `${hour}:${String(m).padStart(2, "0")}`;
  return zh ? `${mark}${clock}` : `${clock} ${mark}`;
}

export function formatDays(days: readonly number[], firstDay: number, names: DayNames): string {
  if (days.length === 0) return names.once;
  if (days.length === 7) return names.everyday;
  const key = [...days].sort((a, b) => a - b).join();
  if (key === "1,2,3,4,5") return names.workdays;
  if (key === "0,6") return names.weekend;
  return weekOrder(firstDay)
    .filter((d) => days.includes(d))
    .map((d) => names.weekdays[d])
    .join(names.joiner);
}
