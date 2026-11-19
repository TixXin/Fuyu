export type CountdownKind = "countdown" | "anniversary";

export type Datable = {
  id: string;
  date: string;
  pinned: boolean;
  kind?: CountdownKind;
  repeat?: boolean;
};

export type Reading =
  | { type: "left"; days: number }
  | { type: "today" }
  | { type: "past"; days: number }
  | { type: "day"; n: number };

const DAY_MS = 86_400_000;

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function startOfLocalDay(timestamp: number): number {
  const dt = new Date(timestamp);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

export function parseLocalDate(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function dateKeyOf(timestamp: number): string {
  const dt = new Date(timestamp);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${m}-${d}`;
}

export function daysDelta(dateKey: string, at: number): number {
  return Math.round((parseLocalDate(dateKey) - startOfLocalDay(at)) / DAY_MS);
}

export function occurrenceIn(dateKey: string, year: number): string {
  const [, m, d] = dateKey.split("-").map(Number);
  const last = new Date(year, m, 0).getDate();
  return `${year}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function effectiveDate(item: Pick<Datable, "date" | "repeat">, at: number): string {
  if (!item.repeat || daysDelta(item.date, at) >= 0) return item.date;
  const year = new Date(at).getFullYear();
  const thisYear = occurrenceIn(item.date, year);
  return daysDelta(thisYear, at) >= 0 ? thisYear : occurrenceIn(item.date, year + 1);
}

export function readItem(item: Pick<Datable, "date" | "repeat" | "kind">, at: number): Reading {
  const since = daysDelta(item.date, at);
  if (item.kind === "anniversary" && since <= 0) return { type: "day", n: 1 - since };
  const delta = daysDelta(effectiveDate(item, at), at);
  if (delta === 0) return { type: "today" };
  return delta > 0 ? { type: "left", days: delta } : { type: "past", days: -delta };
}

export function yearsSince(item: Pick<Datable, "date" | "repeat">, at: number): number {
  return Number(effectiveDate(item, at).slice(0, 4)) - Number(item.date.slice(0, 4));
}

function rank(item: Datable, at: number): [number, number] {
  const reading = readItem(item, at);
  if (reading.type === "today") return [0, 0];
  if (reading.type === "left") return [0, reading.days];
  if (reading.type === "day") {
    if (item.repeat) return [0, daysDelta(effectiveDate(item, at), at)];
    return [1, reading.n];
  }
  return [2, reading.days];
}

export function sortByDate<T extends Datable>(items: readonly T[], at: number): T[] {
  return [...items].sort((a, b) => {
    const [ra, ka] = rank(a, at);
    const [rb, kb] = rank(b, at);
    return ra !== rb ? ra - rb : ka - kb;
  });
}

export function sortCountdownItems<T extends Datable>(items: readonly T[], at: number): T[] {
  const sorted = sortByDate(items, at);
  return [...sorted.filter((item) => item.pinned), ...sorted.filter((item) => !item.pinned)];
}

export function primaryCountdown<T extends Datable>(items: readonly T[], at: number): T | null {
  return sortCountdownItems(items, at)[0] ?? null;
}
