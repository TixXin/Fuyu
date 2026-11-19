import type { DateMode, DiffMode, TimeFormat } from "./model.ts";

export type ZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type ZoneInfo = {
  parts: ZoneParts;
  offsetHours: number;
  utcOffsetMinutes: number;
  dayDiff: -1 | 0 | 1;
  isDaytime: boolean;
};

export type TimeText = {
  time: string;
  period: string;
};

export type Lang = "zh" | "en";

export function zoneParts(at: number, timeZone?: string): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return {
    year: map.year ?? 1970,
    month: map.month ?? 1,
    day: map.day ?? 1,
    hour: (map.hour ?? 0) % 24,
    minute: map.minute ?? 0,
    second: map.second ?? 0,
  };
}

function epochMinutes(p: ZoneParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 60_000;
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function zoneInfo(at: number, timeZone: string, localZone?: string): ZoneInfo {
  const z = zoneParts(at, timeZone);
  const local = zoneParts(at, localZone);
  const utc = zoneParts(at, "UTC");
  const offsetHours = Math.round(((epochMinutes(z) - epochMinutes(local)) / 60) * 4) / 4;
  const utcOffsetMinutes = Math.round((epochMinutes(z) - epochMinutes(utc)) / 15) * 15;
  const zDay = Date.UTC(z.year, z.month - 1, z.day);
  const lDay = Date.UTC(local.year, local.month - 1, local.day);
  const dayDiff: -1 | 0 | 1 = zDay > lDay ? 1 : zDay < lDay ? -1 : 0;
  return { parts: z, offsetHours, utcOffsetMinutes, dayDiff, isDaytime: z.hour >= 6 && z.hour < 18 };
}

export function systemUses12Hour(locale?: string): boolean {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
    return cycle === "h11" || cycle === "h12";
  } catch {
    return false;
  }
}

export function uses12Hour(format: TimeFormat, systemIs12: boolean): boolean {
  return format === "12" || (format === "system" && systemIs12);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatTime(parts: ZoneParts, twelve: boolean, seconds: boolean, lang: Lang): TimeText {
  const tail = `:${pad(parts.minute)}${seconds ? `:${pad(parts.second)}` : ""}`;
  if (!twelve) return { time: `${pad(parts.hour)}${tail}`, period: "" };
  const am = parts.hour < 12;
  const period = lang === "zh" ? (am ? "上午" : "下午") : am ? "AM" : "PM";
  return { time: `${parts.hour % 12 || 12}${tail}`, period };
}

export function joinTime(text: TimeText, lang: Lang): string {
  if (!text.period) return text.time;
  return lang === "zh" ? `${text.period} ${text.time}` : `${text.time} ${text.period}`;
}

export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${pad(m)}` : ""}`;
}

export type DayWords = { tomorrow: string; yesterday: string };

export function dateText(at: number, timeZone: string, info: ZoneInfo, mode: DateMode, lang: Lang, words: DayWords): string {
  if (mode === "none") return "";
  if (mode === "relative") return info.dayDiff === 1 ? words.tomorrow : info.dayDiff === -1 ? words.yesterday : "";
  const weekday = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { timeZone, weekday: "short" }).format(new Date(at));
  if (lang === "zh") return `${info.parts.month}月${info.parts.day}日 ${weekday}`;
  const month = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(new Date(at));
  return `${weekday}, ${month} ${info.parts.day}`;
}

export type DiffWords = {
  same: string;
  ahead: (hours: number) => string;
  behind: (hours: number) => string;
};

function hoursText(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
}

export function diffText(offsetHours: number, mode: DiffMode, words: DiffWords): string {
  if (mode === "none") return "";
  if (offsetHours === 0) return words.same;
  if (mode === "short") return `${offsetHours > 0 ? "+" : "-"}${hoursText(Math.abs(offsetHours))}`;
  return offsetHours > 0 ? words.ahead(Math.abs(offsetHours)) : words.behind(Math.abs(offsetHours));
}

export function msUntilNextTick(now: number, seconds: boolean): number {
  const step = seconds ? 1000 : 60_000;
  return step - (now % step) + 5;
}
