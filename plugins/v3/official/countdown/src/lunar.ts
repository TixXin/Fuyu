const LUNAR_YEARS = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];

const LUNAR_BASE = Date.UTC(1900, 0, 31);
export const LUNAR_MIN_YEAR = 1900;
export const LUNAR_MAX_YEAR = LUNAR_MIN_YEAR + LUNAR_YEARS.length - 1;
const MONTH_NAMES = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
const DAY_DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export type LunarDate = { year: number; month: number; day: number; leap?: boolean };

const pad = (value: number) => String(value).padStart(2, "0");
const monthDays = (info: number, month: number) => (info & (0x10000 >> month) ? 30 : 29);
const leapDays = (info: number) => (info & 0xf ? (info & 0x10000 ? 30 : 29) : 0);

function yearDays(info: number): number {
  let days = leapDays(info);
  for (let month = 1; month <= 12; month += 1) days += monthDays(info, month);
  return days;
}

export function lunarLeapMonth(year: number): number {
  if (!Number.isInteger(year) || year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return 0;
  return LUNAR_YEARS[year - LUNAR_MIN_YEAR] & 0xf;
}

export function lunarMonthDays(year: number, month: number, leap = false): number {
  if (!Number.isInteger(year) || year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return 0;
  if (!Number.isInteger(month) || month < 1 || month > 12) return 0;
  const info = LUNAR_YEARS[year - LUNAR_MIN_YEAR];
  if (leap) return (info & 0xf) === month ? leapDays(info) : 0;
  return monthDays(info, month);
}

export function solarToLunar(dateKey: string): LunarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  let offset = Math.round((Date.UTC(y, m - 1, d) - LUNAR_BASE) / 86_400_000);
  if (offset < 0) return null;
  let index = 0;
  while (index < LUNAR_YEARS.length && offset >= yearDays(LUNAR_YEARS[index])) offset -= yearDays(LUNAR_YEARS[index++]);
  if (index >= LUNAR_YEARS.length) return null;
  const info = LUNAR_YEARS[index];
  const leap = info & 0xf;
  for (let month = 1; month <= 12; month += 1) {
    const days = monthDays(info, month);
    if (offset < days) return { year: LUNAR_MIN_YEAR + index, month, day: offset + 1 };
    offset -= days;
    if (month === leap) {
      if (offset < leapDays(info)) return { year: LUNAR_MIN_YEAR + index, month, day: offset + 1, leap: true };
      offset -= leapDays(info);
    }
  }
  return null;
}

export function lunarToSolarKey(year: number, month: number, day: number, leap = false, strictLeap = false): string | null {
  if (!Number.isInteger(year) || year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 30) return null;
  const index = year - LUNAR_MIN_YEAR;
  let offset = 0;
  for (let y = 0; y < index; y += 1) offset += yearDays(LUNAR_YEARS[y]);
  const info = LUNAR_YEARS[index];
  const yearLeap = info & 0xf;
  for (let m = 1; m < month; m += 1) {
    offset += monthDays(info, m);
    if (m === yearLeap) offset += leapDays(info);
  }
  let maxDays: number;
  if (leap) {
    if (yearLeap === month) {
      offset += monthDays(info, month);
      maxDays = leapDays(info);
    } else if (strictLeap) {
      return null;
    } else {
      maxDays = monthDays(info, month);
    }
  } else {
    maxDays = monthDays(info, month);
  }
  offset += Math.min(day, maxDays) - 1;
  const utc = new Date(LUNAR_BASE + offset * 86_400_000);
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

export function lunarDayName(day: number, isZh: boolean): string {
  if (!isZh) return pad(day);
  if (day <= 10) return `初${DAY_DIGITS[day]}`;
  if (day < 20) return `十${DAY_DIGITS[day - 10]}`;
  if (day === 20) return "二十";
  if (day < 30) return `廿${DAY_DIGITS[day - 20]}`;
  return "三十";
}

export function lunarMonthName(month: number, leap: boolean, isZh: boolean): string {
  if (!isZh) return `${leap ? "Leap " : ""}M${pad(month)}`;
  const base = MONTH_NAMES[month - 1] ?? "";
  return leap ? `闰${base}` : base;
}

export function formatLunarDate(lunar: LunarDate, isZh: boolean, withYear = false): string {
  if (isZh) {
    const base = `${lunarMonthName(lunar.month, Boolean(lunar.leap), true)}${lunarDayName(lunar.day, true)}`;
    return withYear ? `农历${lunar.year}年${base}` : `农历${base}`;
  }
  const leap = lunar.leap ? "Leap " : "";
  const md = `${leap}${pad(lunar.month)}-${pad(lunar.day)}`;
  return withYear ? `Lunar ${lunar.year}-${md}` : `Lunar ${md}`;
}

export function normalizeLunarDate(raw: unknown): LunarDate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const year = Number(obj.year);
  const month = Number(obj.month);
  const day = Number(obj.day);
  const leap = obj.leap === true;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR || month < 1 || month > 12 || day < 1) return null;
  const maxDays = lunarMonthDays(year, month, leap);
  if (maxDays === 0 || day > maxDays) return null;
  return leap ? { year, month, day, leap: true } : { year, month, day };
}
