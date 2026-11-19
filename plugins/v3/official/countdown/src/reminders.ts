import { dateKeyOf, daysDelta, effectiveDate, yearsSince } from "./days.ts";
import type { CountdownItem, CountdownSettings, Reminded } from "./model.ts";

export const REMIND_HOUR = 9;

export type DueReminder = { item: CountdownItem; type: "day" | "ahead"; days: number; years: number };

export function dueReminders(
  items: readonly CountdownItem[],
  settings: CountdownSettings,
  reminded: Reminded,
  at: number,
): DueReminder[] {
  if (new Date(at).getHours() < REMIND_HOUR) return [];
  const today = dateKeyOf(at);
  const done = reminded.day === today ? new Set(reminded.ids) : new Set<string>();
  const due: DueReminder[] = [];
  for (const item of items) {
    if (done.has(item.id)) continue;
    const days = daysDelta(effectiveDate(item, at), at);
    const years = item.repeat ? yearsSince(item, at) : 0;
    if (days === 0 && settings.remindOnDay) due.push({ item, type: "day", days, years });
    else if (days > 0 && settings.remindAhead && days === settings.aheadDays) due.push({ item, type: "ahead", days, years });
  }
  return due;
}

export function markReminded(reminded: Reminded, ids: readonly string[], at: number): Reminded {
  const today = dateKeyOf(at);
  const base = reminded.day === today ? reminded.ids : [];
  return { day: today, ids: [...new Set([...base, ...ids])] };
}
