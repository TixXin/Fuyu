import { effectiveDate, resolveLunarRef, type Reading } from "./days.ts";
import { formatLunarDate } from "./lunar.ts";
import type { CountdownItem } from "./model.ts";
import { text } from "./text.ts";

export function formatItemDate(item: CountdownItem, at: number, includeSolar = true): string {
  if (item.calendar !== "lunar") return item.date;
  const lunar = resolveLunarRef(item);
  if (!lunar) return item.date;
  const lunarLabel = formatLunarDate(lunar, text.isZh, !item.repeat);
  if (!includeSolar) return lunarLabel;
  const solar = item.repeat ? effectiveDate(item, at) : item.date;
  return `${lunarLabel} (${solar})`;
}

export function rowLabel(reading: Reading): string {
  if (reading.type === "today") return text.today;
  if (reading.type === "left") return text.daysLeft(reading.days);
  if (reading.type === "past") return text.daysPast(reading.days);
  return text.dayN(reading.n);
}

export function heroLabel(reading: Reading): string {
  if (reading.type === "left") return text.heroDays(reading.days);
  return rowLabel(reading);
}

export function barLabel(reading: Reading): string {
  if (reading.type === "today") return text.today;
  if (reading.type === "left") return text.barLeft(reading.days);
  if (reading.type === "past") return text.barPast(reading.days);
  return text.barDayN(reading.n);
}
