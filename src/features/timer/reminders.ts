import { useSyncExternalStore } from "react";
import { SNOOZE_MS } from "./breakReminders.ts";
import { withoutReminder, withReminder, withSource, type IslandReminder, type ReminderQueue } from "./reminderQueue.ts";

export type { IslandReminder, ReminderIcon } from "./reminderQueue.ts";

let queue: ReminderQueue = [];
const listeners = new Set<() => void>();
const snoozes = new Map<string, number>();

function set(next: ReminderQueue) {
  if (next === queue) return;
  queue = next;
  listeners.forEach((listener) => listener());
}

function clearSnooze(id: string) {
  const timeout = snoozes.get(id);
  if (timeout === undefined) return;
  window.clearTimeout(timeout);
  snoozes.delete(id);
}

export function pushIslandReminder(reminder: IslandReminder) {
  clearSnooze(reminder.id);
  set(withReminder(queue, reminder));
}

export function replaceIslandReminders(source: string, reminders: readonly IslandReminder[]) {
  set(withSource(queue, source, reminders));
}

export function dismissIslandReminder(id: string) {
  const reminder = queue.find((entry) => entry.id === id);
  clearSnooze(id);
  set(withoutReminder(queue, id));
  reminder?.onDismiss?.();
}

export function snoozeIslandReminder(id: string) {
  const reminder = queue.find((entry) => entry.id === id);
  if (!reminder) return;
  set(withoutReminder(queue, id));
  if (reminder.onSnooze) {
    reminder.onSnooze();
    return;
  }
  clearSnooze(id);
  snoozes.set(id, window.setTimeout(() => {
    snoozes.delete(id);
    set(withReminder(queue, reminder));
  }, SNOOZE_MS));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIslandReminders(): ReminderQueue {
  return useSyncExternalStore(subscribe, () => queue);
}
