export type HistoryDay<T> = {
  key: string;
  kind: "today" | "yesterday" | "date";
  year: number;
  month: number;
  day: number;
  items: T[];
};

const DAY_MS = 86_400_000;

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function groupByDay<T extends { takenAt: number }>(items: readonly T[], now: number): HistoryDay<T>[] {
  const today = startOfDay(now);
  const days: HistoryDay<T>[] = [];
  for (const item of items) {
    const start = startOfDay(item.takenAt);
    const date = new Date(start);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const last = days[days.length - 1];
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    const kind = start >= today ? "today" : start >= startOfDay(today - DAY_MS / 2) ? "yesterday" : "date";
    days.push({ key, kind, year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), items: [item] });
  }
  return days;
}

export function clockTime(time: number) {
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
