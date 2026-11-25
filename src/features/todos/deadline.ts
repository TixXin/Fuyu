import { isDateString } from "./schedule.ts";
import type { TodoItem } from "./types.ts";

export type DeadlineTone = "normal" | "soon" | "overdue";
export type TodoDeadlineReminder = "off" | "sameDay" | "dayBefore";

export type DeadlineFormatText = {
  dueToday: string;
  dueTomorrow: string;
  dueOn: (dateText: string) => string;
  overdue: (days: number) => string;
};

const MS_PER_DAY = 86_400_000;

function parseUtcDayMs(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function diffDays(fromDate: string, toDate: string): number {
  return Math.round((parseUtcDayMs(toDate) - parseUtcDayMs(fromDate)) / MS_PER_DAY);
}

export function deadlineStatus(deadline: string | undefined, today: string): { daysLeft: number; tone: DeadlineTone } | null {
  if (!isDateString(deadline) || !isDateString(today)) return null;
  const daysLeft = diffDays(today, deadline);
  const tone: DeadlineTone = daysLeft < 0 ? "overdue" : daysLeft <= 1 ? "soon" : "normal";
  return { daysLeft, tone };
}

export function formatDeadlineBadge(
  deadline: string | undefined,
  today: string,
  localeTag: string,
  text: DeadlineFormatText,
): { label: string; tone: DeadlineTone } | null {
  const status = deadlineStatus(deadline, today);
  if (!status || !deadline) return null;
  if (status.daysLeft < 0) return { label: text.overdue(-status.daysLeft), tone: "overdue" };
  if (status.daysLeft === 0) return { label: text.dueToday, tone: "soon" };
  if (status.daysLeft === 1) return { label: text.dueTomorrow, tone: "soon" };
  const dateObj = new Date(`${deadline}T00:00:00`);
  const formatted = status.daysLeft <= 6
    ? new Intl.DateTimeFormat(localeTag, { weekday: "short" }).format(dateObj)
    : new Intl.DateTimeFormat(localeTag, { month: "numeric", day: "numeric" }).format(dateObj);
  return { label: text.dueOn(formatted), tone: "normal" };
}

export function carriedDaysCount(carriedFrom: string | undefined, today: string): number {
  if (!isDateString(carriedFrom) || !isDateString(today)) return 0;
  return Math.max(0, diffDays(carriedFrom, today));
}

export function effectiveCreatedAt(todo: Pick<TodoItem, "createdAt" | "carriedFrom">): number {
  if (!isDateString(todo.carriedFrom)) return todo.createdAt;
  const carriedMs = new Date(`${todo.carriedFrom}T00:00:00`).getTime();
  return Number.isFinite(carriedMs) ? Math.min(todo.createdAt, carriedMs) : todo.createdAt;
}

export function nextCarriedFrom(todo: Pick<TodoItem, "carriedFrom">, currentDate: string): string | undefined {
  if (isDateString(todo.carriedFrom)) return todo.carriedFrom;
  return isDateString(currentDate) ? currentDate : undefined;
}

export const DEADLINE_REMINDER_SOURCE = "todo-deadline";

export function deadlineReminderKey(today: string, todoId: string, deadline: string): string {
  return `${DEADLINE_REMINDER_SOURCE}:${today}:${todoId}:${deadline}`;
}

export function pickDeadlineReminders<T extends Pick<TodoItem, "id" | "title" | "completed" | "deadline">>(
  todos: readonly T[],
  today: string,
  mode: TodoDeadlineReminder,
  seen: Set<string>,
): { id: string; todo: T; daysLeft: 0 | 1 }[] {
  if (mode === "off" || !isDateString(today)) return [];
  const picked: { id: string; todo: T; daysLeft: 0 | 1 }[] = [];
  for (const todo of todos) {
    if (todo.completed || !isDateString(todo.deadline)) continue;
    const daysLeft = diffDays(today, todo.deadline);
    const matches = mode === "sameDay" ? daysLeft === 0 : daysLeft === 0 || daysLeft === 1;
    if (!matches) continue;
    const id = deadlineReminderKey(today, todo.id, todo.deadline);
    if (seen.has(id)) continue;
    seen.add(id);
    picked.push({ id, todo, daysLeft: daysLeft as 0 | 1 });
  }
  return picked;
}
