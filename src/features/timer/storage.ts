import { readJson, readString, writeJson } from "../../lib/storage.ts";
import { normalizeBreakReminders, type BreakReminderSettings } from "./breakReminders.ts";
import { normalizeTimers, type Timer } from "./timers.ts";

export const BREAK_REMINDERS_KEY = "fuyu-break-reminders";
export const TIMERS_KEY = "fuyu-timers";
export const TIMERS_MIGRATED_KEY = "fuyu-timers-migrated-v1";

export function loadBreakReminders(): BreakReminderSettings {
  return normalizeBreakReminders(readJson(BREAK_REMINDERS_KEY));
}

export function saveBreakReminders(settings: BreakReminderSettings): boolean {
  return writeJson(BREAK_REMINDERS_KEY, settings);
}

export function hasLegacyTimers(): boolean {
  return readString(TIMERS_KEY) !== null;
}

export function loadLegacyTimers(): Timer[] {
  return normalizeTimers(readJson(TIMERS_KEY));
}

export function saveFallbackTimers(timers: readonly Timer[]): boolean {
  return writeJson(TIMERS_KEY, timers);
}

export function isTimersMigrated(): boolean {
  const value = readJson(TIMERS_MIGRATED_KEY);
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function markTimersMigrated(at = Date.now()): boolean {
  return writeJson(TIMERS_MIGRATED_KEY, { at });
}
