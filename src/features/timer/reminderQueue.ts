export type ReminderIcon = "stand" | "eye" | "water" | "stretch" | "coffee" | "bell" | "flag";

export type IslandReminder = {
  id: string;
  source: string;
  icon: ReminderIcon;
  title: string;
  detail?: string;
  snoozable?: boolean;
  onSnooze?: () => void;
  onDismiss?: () => void;
};

export type ReminderQueue = readonly IslandReminder[];

const sameShown = (a: IslandReminder, b: IslandReminder) =>
  a.source === b.source && a.icon === b.icon && a.title === b.title && a.detail === b.detail && a.snoozable === b.snoozable;

export function withReminder(queue: ReminderQueue, reminder: IslandReminder): ReminderQueue {
  const index = queue.findIndex((entry) => entry.id === reminder.id);
  if (index < 0) return [...queue, reminder];
  const current = queue[index];
  if (current && sameShown(current, reminder) && current.onSnooze === reminder.onSnooze && current.onDismiss === reminder.onDismiss) return queue;
  return queue.map((entry, at) => (at === index ? reminder : entry));
}

export function withoutReminder(queue: ReminderQueue, id: string): ReminderQueue {
  return queue.some((entry) => entry.id === id) ? queue.filter((entry) => entry.id !== id) : queue;
}

export function withSource(queue: ReminderQueue, source: string, reminders: readonly IslandReminder[]): ReminderQueue {
  const wanted = new Set(reminders.map((reminder) => reminder.id));
  const kept = queue.filter((entry) => entry.source !== source || wanted.has(entry.id));
  const next = reminders.reduce((current, reminder) => withReminder(current, { ...reminder, source }), kept as ReminderQueue);
  return next.length === queue.length && next.every((entry, index) => entry === queue[index]) ? queue : next;
}
