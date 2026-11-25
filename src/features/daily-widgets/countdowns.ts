import {
  LUNAR_MAX_YEAR,
  LUNAR_MIN_YEAR,
  formatLunarDate,
  lunarLeapMonth,
  lunarMonthDays,
  lunarParts,
  lunarToSolar,
} from "../../utils/lunar.ts";

const DAY_MS = 86_400_000;

export type CountdownCalendar = "solar" | "lunar";
export type CountdownDateSpec = { date: string; calendar?: CountdownCalendar; leap?: boolean };
export type NormalizedLunarDate = { date: string; leap?: boolean };

const pad = (value: number) => String(value).padStart(2, "0");

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const CN_MONTHS: Record<string, number> = {
  正: 1,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  冬: 11,
  十一: 11,
  腊: 12,
  臘: 12,
  十二: 12,
};

const CN_DIGITS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseChineseLunarDay(token: string): number | null {
  const clean = token.replace(/[日号]$/u, "");
  if (/^\d{1,2}$/.test(clean)) {
    const num = Number(clean);
    return num >= 1 && num <= 30 ? num : null;
  }
  if (clean === "二十" || clean === "廿") return 20;
  if (clean === "三十" || clean === "卅") return 30;
  if (clean.startsWith("初") && clean.length === 2) return CN_DIGITS[clean[1]] ?? null;
  if (clean.startsWith("十") && clean.length === 2) {
    const ones = CN_DIGITS[clean[1]];
    return ones && ones < 10 ? 10 + ones : null;
  }
  if (clean.startsWith("廿") && clean.length === 2) {
    const ones = CN_DIGITS[clean[1]];
    return ones && ones < 10 ? 20 + ones : null;
  }
  if (clean.startsWith("二十") && clean.length === 3) {
    const ones = CN_DIGITS[clean[2]];
    return ones && ones < 10 ? 20 + ones : null;
  }
  return null;
}

export function normalizeDateText(input: string): string | null {
  const parts = input.trim().replace(/[年月]/g, "-").replace(/[日号]/g, "").split(/[-/.\s]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  const year = numbers.length === 3 ? (numbers[0] ?? null) : null;
  const [month, day] = numbers.slice(-2);
  if (month === undefined || day === undefined || month < 1 || month > 12 || day < 1) return null;
  if (year === null) return day <= daysInMonth(2024, month) ? `${pad(month)}-${pad(day)}` : null;
  if (year < 1900 || year > 2200 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function normalizeLunarDateText(input: string, defaultLeap = false): NormalizedLunarDate | null {
  let raw = input.trim().replace(/^(?:农历|陰曆|阴历|lunar)\s*/iu, "");
  if (!raw) return null;
  let year: number | null = null;
  const yearMatch = /^(\d{4})(?:年|[-/.\s]+)/u.exec(raw);
  if (yearMatch) {
    year = Number(yearMatch[1]);
    raw = raw.slice(yearMatch[0].length).trim();
  }
  if (raw === "除夕") {
    if (year !== null) {
      if (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return null;
      const lastDay = lunarMonthDays(year, 12, false);
      return { date: `${year}-12-${pad(lastDay)}` };
    }
    return { date: "12-30" };
  }
  let leap = defaultLeap;
  const leapMatch = /^(?:闰|閏|leap\s*)/iu.exec(raw);
  if (leapMatch) {
    leap = true;
    raw = raw.slice(leapMatch[0].length).trim();
  }
  let month: number | null = null;
  let day: number | null = null;
  const cnMatch = /^(正|十一|十二|冬|腊|臘|[一二三四五六七八九十]|\d{1,2})月\s*(.+)$/u.exec(raw);
  if (cnMatch) {
    month = /^\d+$/.test(cnMatch[1]) ? Number(cnMatch[1]) : (CN_MONTHS[cnMatch[1]] ?? null);
    day = parseChineseLunarDay(cnMatch[2].trim());
  } else {
    const parts = raw.replace(/[日号]/gu, "").split(/[-/.\s]+/).filter(Boolean);
    if (parts.length === 2 && parts.every((part) => /^\d+$/.test(part))) {
      month = Number(parts[0]);
      day = Number(parts[1]);
    }
  }
  if (month === null || day === null || month < 1 || month > 12 || day < 1 || day > 30) return null;
  if (year !== null) {
    if (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return null;
    if (leap && lunarLeapMonth(year) !== month) return null;
    const maxDays = lunarMonthDays(year, month, leap);
    if (maxDays === 0 || day > maxDays) return null;
    return leap ? { date: `${year}-${pad(month)}-${pad(day)}`, leap: true } : { date: `${year}-${pad(month)}-${pad(day)}` };
  }
  return leap ? { date: `${pad(month)}-${pad(day)}`, leap: true } : { date: `${pad(month)}-${pad(day)}` };
}

export const isYearly = (date: string) => date.length === 5;

function parseDateSegments(date: string): { year: number | null; month: number; day: number } {
  const parts = date.split("-").map(Number);
  if (parts.length === 3) return { year: parts[0] ?? 0, month: parts[1] ?? 1, day: parts[2] ?? 1 };
  return { year: null, month: parts[0] ?? 1, day: parts[1] ?? 1 };
}

export function countdownTarget(entry: string | CountdownDateSpec, now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const spec: CountdownDateSpec = typeof entry === "string" ? { date: entry } : entry;
  const { year, month, day } = parseDateSegments(spec.date);
  if (spec.calendar === "lunar") {
    const leap = Boolean(spec.leap);
    if (year !== null) return lunarToSolar(year, month, day, leap, false) ?? today;
    const baseYear = lunarParts(today)?.year ?? today.getFullYear();
    for (let y = baseYear - 1; y <= baseYear + 2; y += 1) {
      const candidate = lunarToSolar(y, month, day, leap, false);
      if (candidate && candidate.getTime() >= today.getTime()) return candidate;
    }
    return today;
  }
  if (year !== null) return new Date(year, month - 1, day);
  const at = (targetYear: number) => new Date(targetYear, month - 1, Math.min(day, daysInMonth(targetYear, month)));
  const thisYear = at(today.getFullYear());
  return thisYear.getTime() >= today.getTime() ? thisYear : at(today.getFullYear() + 1);
}

export function formatCountdownLunar(date: string, leap = false, locale = "zh-CN"): string | null {
  const { year, month, day } = parseDateSegments(date);
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  if (locale === "zh-CN") return formatLunarDate(month, day, leap, year ?? undefined) || null;
  const prefix = leap ? "Leap " : "";
  return year !== null ? `${year}-${prefix}${pad(month)}-${pad(day)}` : `${prefix}${pad(month)}-${pad(day)}`;
}

export function convertDateBetweenCalendars(
  input: string,
  from: CountdownCalendar,
  to: CountdownCalendar,
  now: Date,
): string | null {
  if (from === to) return input;
  if (from === "solar" && to === "lunar") {
    const solar = normalizeDateText(input);
    if (!solar) return null;
    const target = countdownTarget(solar, now);
    const parts = lunarParts(target);
    if (!parts) return null;
    const leapPrefix = parts.leap ? "闰" : "";
    return isYearly(solar) ? `${leapPrefix}${pad(parts.month)}-${pad(parts.day)}` : `${parts.year}-${leapPrefix}${pad(parts.month)}-${pad(parts.day)}`;
  }
  const lunar = normalizeLunarDateText(input);
  if (!lunar) return null;
  const target = countdownTarget({ date: lunar.date, calendar: "lunar", leap: lunar.leap }, now);
  return isYearly(lunar.date)
    ? `${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
    : `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}

export function daysBetween(now: Date, target: Date): number {
  const from = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const to = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((to - from) / DAY_MS);
}
