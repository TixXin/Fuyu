export type DayGroup = "today" | "yesterday" | "earlier";

export function dayGroup(time: number, now: number): DayGroup {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (time >= today.getTime()) return "today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return time >= yesterday.getTime() ? "yesterday" : "earlier";
}

export function dayGroupStarts(times: readonly number[], now: number): (DayGroup | null)[] {
  return times.map((time, index) => {
    const group = dayGroup(time, now);
    return index === 0 || dayGroup(times[index - 1], now) !== group ? group : null;
  });
}
