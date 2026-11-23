const pad = (value: number) => String(value).padStart(2, "0");

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function lastDays(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, at) => dayKey(shiftDays(today, at - count + 1)));
}

export function weekDays(today: Date): Date[] {
  const fromMonday = (today.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, at) => shiftDays(today, at - fromMonday));
}

export function streakLength(checkins: ReadonlySet<string>, today: Date): number {
  let day = checkins.has(dayKey(today)) ? today : shiftDays(today, -1);
  let count = 0;
  while (checkins.has(dayKey(day))) {
    count += 1;
    day = shiftDays(day, -1);
  }
  return count;
}

export function yearProgress(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
  return (now.getTime() - start) / (end - start);
}

const LUNAR_NEW_YEAR: readonly [number, number, number][] = [
  [2026, 2, 17],
  [2027, 2, 6],
  [2028, 1, 26],
  [2029, 2, 13],
  [2030, 2, 3],
  [2031, 1, 23],
  [2032, 2, 11],
  [2033, 1, 31],
  [2034, 2, 19],
  [2035, 2, 8],
];

export type Countdown = { kind: "lunarNewYear" | "newYear"; date: Date };

export function nextCountdown(now: Date): Countdown {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const [year, month, day] of LUNAR_NEW_YEAR) {
    const date = new Date(year, month - 1, day);
    if (date.getTime() >= today) return { kind: "lunarNewYear", date };
  }
  return { kind: "newYear", date: new Date(now.getFullYear() + 1, 0, 1) };
}

export function focusText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
