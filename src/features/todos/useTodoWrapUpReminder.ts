import { useEffect, useRef } from "react";
import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import { remindersV1, type Reminder } from "@fuyu/plugin-services";
import { windowServices } from "../plugin-kernel/services.ts";
import { parseClockTime } from "./todoPrefs.ts";
import type { TodoItem } from "./types.ts";
import { TIMED_REMINDER_STARTUP_GRACE_MS, scheduledTodoTimeMs } from "./useTodoTimedReminders.ts";

export const WRAP_UP_REMINDER_SOURCE = "todo-wrap-up";
export const WRAP_UP_REMINDER_WINDOW_MS = 30 * 60_000;
const POLL_INTERVAL_MS = 30_000;

const remindedWrapUps = new Set<string>();

type WrapUpCheck = {
  date: string;
  time: string;
  todos: readonly Pick<TodoItem, "completed">[];
  nowMs: number;
  armedAtMs: number;
  seen: Set<string>;
};

export function wrapUpReminderKey(date: string): string {
  return `${WRAP_UP_REMINDER_SOURCE}:${date}`;
}

export function dueWrapUpReminder({ date, time, todos, nowMs, armedAtMs, seen }: WrapUpCheck): { id: string; openCount: number } | null {
  const clock = parseClockTime(time);
  if (!clock) return null;
  const targetMs = scheduledTodoTimeMs(date, clock.hours, clock.minutes);
  if (targetMs === null) return null;
  const id = wrapUpReminderKey(date);
  if (seen.has(id) || nowMs < targetMs) return null;
  seen.add(id);
  if (targetMs < armedAtMs - TIMED_REMINDER_STARTUP_GRACE_MS || nowMs >= targetMs + WRAP_UP_REMINDER_WINDOW_MS) return null;
  const openCount = todos.filter((todo) => !todo.completed).length;
  return openCount > 0 ? { id, openCount } : null;
}

export function dispatchWrapUpReminder({
  services = windowServices,
  title,
  seen = remindedWrapUps,
  ...check
}: Omit<WrapUpCheck, "seen"> & {
  services?: Pick<WindowServices, "get" | "has">;
  title: (openCount: number) => string;
  seen?: Set<string>;
}): Reminder | null {
  if (!services.has(remindersV1.name)) return null;
  const due = dueWrapUpReminder({ ...check, seen });
  if (!due) return null;
  const reminder: Reminder = { id: due.id, source: WRAP_UP_REMINDER_SOURCE, icon: "bell", title: title(due.openCount), snoozable: true };
  void services.get(remindersV1).push(reminder).catch(() => undefined);
  return reminder;
}

export function useTodoWrapUpReminder({
  enabled,
  time,
  date,
  todos,
  title,
}: {
  enabled: boolean;
  time: string;
  date: string;
  todos: readonly TodoItem[];
  title: (openCount: number) => string;
}) {
  const todosRef = useRef(todos);
  todosRef.current = todos;

  useEffect(() => {
    if (!enabled) return;
    const armedAtMs = Date.now();
    const check = () => {
      dispatchWrapUpReminder({ date, time, todos: todosRef.current, nowMs: Date.now(), armedAtMs, title });
    };
    check();
    const unwatch = windowServices.watch(check);
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", check);
    return () => {
      unwatch();
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, [date, enabled, time, title]);
}
