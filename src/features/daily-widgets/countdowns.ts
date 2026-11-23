const DAY_MS = 86_400_000;

const pad = (value: number) => String(value).padStart(2, "0");

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

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

export const isYearly = (date: string) => date.length === 5;

export function countdownTarget(date: string, now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [first = 0, second = 1, third = 1] = date.split("-").map(Number);
  if (!isYearly(date)) return new Date(first, second - 1, third);
  const at = (year: number) => new Date(year, first - 1, Math.min(second, daysInMonth(year, first)));
  const thisYear = at(today.getFullYear());
  return thisYear.getTime() >= today.getTime() ? thisYear : at(today.getFullYear() + 1);
}

export function daysBetween(now: Date, target: Date): number {
  const from = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const to = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((to - from) / DAY_MS);
}
