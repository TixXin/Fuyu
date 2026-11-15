import type { ScheduledTodo } from "./types";

export const DUE_REMINDER_SOURCE = "todo-due";

export function dueReminderId(todo: Pick<ScheduledTodo, "id" | "date">) {
  return `${DUE_REMINDER_SOURCE}:${todo.date}:${todo.id}`;
}

export function pickDueReminders(due: readonly ScheduledTodo[], seen: Set<string>): ScheduledTodo[] {
  const picked: ScheduledTodo[] = [];
  for (const todo of due) {
    const id = dueReminderId(todo);
    if (todo.priority !== "high" || seen.has(id)) continue;
    seen.add(id);
    picked.push(todo);
  }
  return picked;
}
