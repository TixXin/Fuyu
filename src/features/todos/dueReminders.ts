import type { TodoDueReminderScope } from "./todoPrefs.ts";
import type { ScheduledTodo } from "./types";

export const DUE_REMINDER_SOURCE = "todo-due";

export function dueReminderId(todo: Pick<ScheduledTodo, "id" | "date">) {
  return `${DUE_REMINDER_SOURCE}:${todo.date}:${todo.id}`;
}

export function dueReminderCovers(scope: TodoDueReminderScope, priority: ScheduledTodo["priority"]): boolean {
  if (scope === "off") return false;
  if (scope === "all") return true;
  if (scope === "highMedium") return priority === "high" || priority === "medium";
  return priority === "high";
}

export function pickDueReminders(due: readonly ScheduledTodo[], seen: Set<string>, scope: TodoDueReminderScope = "high"): ScheduledTodo[] {
  const picked: ScheduledTodo[] = [];
  for (const todo of due) {
    const id = dueReminderId(todo);
    if (!dueReminderCovers(scope, todo.priority) || seen.has(id)) continue;
    seen.add(id);
    picked.push(todo);
  }
  return picked;
}
