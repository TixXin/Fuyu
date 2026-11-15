import { readJson, writeJson } from "../../lib/storage";
import { normalizeBreakReminders, type BreakReminderSettings } from "./breakReminders";

export const BREAK_REMINDERS_KEY = "fuyu-break-reminders";

export function loadBreakReminders(): BreakReminderSettings {
  return normalizeBreakReminders(readJson(BREAK_REMINDERS_KEY));
}

export function saveBreakReminders(settings: BreakReminderSettings): boolean {
  return writeJson(BREAK_REMINDERS_KEY, settings);
}
