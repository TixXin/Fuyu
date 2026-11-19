import type { Reading } from "./days.ts";
import { text } from "./text.ts";

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
