const DAY_MS = 86_400_000;

export function parseDate(text: string): number | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const at = Date.UTC(year, month - 1, day);
  const check = new Date(at);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return at;
}

export function formatDate(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function todayText(now = new Date()): string {
  return formatDate(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function weekdayOf(at: number): number {
  return new Date(at).getUTCDay();
}

export interface DateSpan {
  days: number;
  weeks: number;
  restDays: number;
  workdays: number;
  years: number;
  months: number;
  monthDays: number;
}

function countWorkdays(from: number, to: number): number {
  const total = Math.round((to - from) / DAY_MS);
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  const start = weekdayOf(from);
  for (let i = 0; i < total % 7; i += 1) {
    const weekday = (start + i) % 7;
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

export function dateSpan(a: number, b: number): DateSpan {
  const sign = b >= a ? 1 : -1;
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  const days = Math.round((to - from) / DAY_MS);
  const start = new Date(from);
  const end = new Date(to);
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  let anchor = addMonths(from, months);
  if (anchor > to) {
    months -= 1;
    anchor = addMonths(from, months);
  }
  return {
    days: sign * days,
    weeks: Math.floor(days / 7),
    restDays: days % 7,
    workdays: countWorkdays(from, to),
    years: Math.floor(months / 12),
    months: months % 12,
    monthDays: Math.round((to - anchor) / DAY_MS),
  };
}

export function addDays(at: number, days: number): number {
  return at + Math.trunc(days) * DAY_MS;
}

export function addMonths(at: number, months: number): number {
  const date = new Date(at);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay));
}

export function addWorkdays(at: number, workdays: number): number {
  const step = workdays >= 0 ? 1 : -1;
  let left = Math.min(Math.abs(Math.trunc(workdays)), 100_000);
  let cursor = at;
  while (left > 0) {
    cursor += step * DAY_MS;
    const weekday = weekdayOf(cursor);
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return cursor;
}
