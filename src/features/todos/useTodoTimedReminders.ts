import { useEffect, useRef } from "react";
import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import { remindersV1, type Reminder } from "@fuyu/plugin-services";
import { windowServices } from "../plugin-kernel/services.ts";
import type { TodoItem } from "./types.ts";

export const TIMED_TODO_REMINDER_SOURCE = "todos";
export const TIMED_REMINDER_WINDOW_MS = 5 * 60_000;
export const TIMED_REMINDER_STARTUP_GRACE_MS = 2 * 60_000;
const POLL_INTERVAL_MS = 15_000;

const LEADING_TIME = /^\s*(\d{1,2})[:：](\d{2})(?:\s*[-~～–—]\s*(\d{1,2})[:：](\d{2}))?\s+(.+)$/u;

const remindedTimedTodos = new Set<string>();

export type ParsedTodoLeadingTime = {
  hours: number;
  minutes: number;
  timeKey: string;
  label: string;
};

export function parseLeadingTodoTime(title: string): ParsedTodoLeadingTime | null {
  const match = LEADING_TIME.exec(title);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  const label = match[5].trim();
  if (!label) return null;
  const timeKey = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { hours, minutes, timeKey, label };
}

export function scheduledTodoTimeMs(date: string, hours: number, minutes: number): number | null {
  const parts = date.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const target = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (target.getFullYear() !== year || target.getMonth() !== month - 1 || target.getDate() !== day) {
    return null;
  }
  return target.getTime();
}

export function timedTodoReminderKey(date: string, todoId: string, timeKey: string): string {
  return `${TIMED_TODO_REMINDER_SOURCE}:${date}:${todoId}:${timeKey}`;
}

export type TimedReminderLead = {
  leadMinutes?: number;
  aheadText?: (minutes: number) => string;
};

export function collectDueTimedTodoReminders({
  date,
  todos,
  nowMs,
  bootedAtMs,
  seen,
  leadMinutes = 0,
  aheadText,
}: {
  date: string;
  todos: readonly Pick<TodoItem, "id" | "title" | "completed">[];
  nowMs: number;
  bootedAtMs: number;
  seen: Set<string>;
} & TimedReminderLead): Reminder[] {
  const leadMs = Math.max(0, leadMinutes) * 60_000;
  const due: Reminder[] = [];
  for (const todo of todos) {
    if (todo.completed) continue;
    const parsed = parseLeadingTodoTime(todo.title);
    if (!parsed) continue;
    const scheduledMs = scheduledTodoTimeMs(date, parsed.hours, parsed.minutes);
    if (scheduledMs === null) continue;
    const key = timedTodoReminderKey(date, todo.id, parsed.timeKey);
    if (seen.has(key)) continue;
    if (scheduledMs < bootedAtMs - TIMED_REMINDER_STARTUP_GRACE_MS) {
      seen.add(key);
      continue;
    }
    if (nowMs >= scheduledMs - leadMs && nowMs < scheduledMs + TIMED_REMINDER_WINDOW_MS) {
      seen.add(key);
      const minutesAhead = Math.ceil((scheduledMs - nowMs) / 60_000);
      due.push({
        id: key,
        source: TIMED_TODO_REMINDER_SOURCE,
        icon: "bell",
        title: todo.title,
        ...(minutesAhead > 0 && aheadText ? { detail: aheadText(minutesAhead) } : {}),
        snoozable: true,
      });
    }
  }
  return due;
}

export function dispatchTimedTodoReminders({
  services = windowServices,
  date,
  todos,
  nowMs = Date.now(),
  bootedAtMs,
  seen = remindedTimedTodos,
  leadMinutes,
  aheadText,
}: {
  services?: Pick<WindowServices, "get" | "has">;
  date: string;
  todos: readonly Pick<TodoItem, "id" | "title" | "completed">[];
  nowMs?: number;
  bootedAtMs: number;
  seen?: Set<string>;
} & TimedReminderLead): Reminder[] {
  if (!services.has(remindersV1.name)) return [];
  const due = collectDueTimedTodoReminders({ date, todos, nowMs, bootedAtMs, seen, leadMinutes, aheadText });
  for (const reminder of due) {
    void services.get(remindersV1).push(reminder).catch(() => undefined);
  }
  return due;
}

export function useTodoTimedReminders({
  enabled,
  date,
  todos,
  leadMinutes = 0,
  aheadText,
}: {
  enabled: boolean;
  date: string;
  todos: readonly TodoItem[];
} & TimedReminderLead) {
  const bootedAtRef = useRef<number | null>(null);
  if (bootedAtRef.current === null) {
    bootedAtRef.current = Date.now();
  }

  useEffect(() => {
    if (!enabled) return;
    const bootedAtMs = bootedAtRef.current ?? Date.now();
    const check = () => {
      dispatchTimedTodoReminders({ date, todos, nowMs: Date.now(), bootedAtMs, leadMinutes, aheadText });
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
  }, [aheadText, date, enabled, leadMinutes, todos]);
}
