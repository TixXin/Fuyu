import { todoElapsedLabel } from "./todoPrefs.ts";
import type { TodoItem, TodoPriority } from "./types.ts";

export type TodoMarkdownOptions = {
  markdownPriority?: boolean;
  markdownElapsed?: boolean;
  now?: number;
};

const PRIORITY_MARKS: Readonly<Record<TodoPriority, string>> = {
  high: "[!高]",
  medium: "[!中]",
  low: "[!低]",
};

export function getTodoSignature(date: string, todos: TodoItem[], dailyNote: string, options?: TodoMarkdownOptions) {
  const includePriority = Boolean(options?.markdownPriority);
  const includeElapsed = Boolean(options?.markdownElapsed);
  return JSON.stringify({
    date,
    todos: todos.map((todo) => ({
      title: todo.title,
      completed: todo.completed,
      project: todo.project,
      ...(todo.note ? { note: todo.note } : {}),
      ...(todo.subtasks?.length
        ? { subtasks: todo.subtasks.map((subtask) => ({ title: subtask.title, completed: subtask.completed })) }
        : {}),
      ...(includePriority && todo.priority ? { priority: todo.priority } : {}),
      ...(includeElapsed && todo.focusMinutes ? { focusMinutes: todo.focusMinutes } : {}),
    })),
    dailyNote,
  });
}

function formatFocusBadge(focusMinutes: number | undefined): string | null {
  if (typeof focusMinutes !== "number" || !Number.isFinite(focusMinutes) || focusMinutes <= 0) return null;
  const total = Math.floor(focusMinutes);
  return total > 0 ? `专注 ${total}m` : null;
}

export function formatTodosAsMarkdown(todos: TodoItem[], options?: TodoMarkdownOptions) {
  const includePriority = Boolean(options?.markdownPriority);
  const includeElapsed = Boolean(options?.markdownElapsed);
  const now = options?.now ?? Date.now();
  return todos
    .map((todo) => {
      const project = todo.project ? `[${todo.project}] ` : "";
      const priority = includePriority && todo.priority ? `${PRIORITY_MARKS[todo.priority]} ` : "";
      const elapsed = includeElapsed ? todoElapsedLabel(todo.startedAt, now, true) : null;
      const focus = includeElapsed ? formatFocusBadge(todo.focusMinutes) : null;
      const timeParts = [focus, elapsed].filter((part): part is string => Boolean(part));
      const suffix = timeParts.length > 0 ? ` (${timeParts.join(" · ")})` : "";
      const lines = [`- [${todo.completed ? "x" : " "}] ${project}${priority}${todo.title}${suffix}`];
      if (todo.note) {
        lines.push(`  > ${todo.note}`);
      }
      if (todo.subtasks && todo.subtasks.length > 0) {
        for (const subtask of todo.subtasks) {
          lines.push(`  - [${subtask.completed ? "x" : " "}] ${subtask.title}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n");
}

export function formatTodoDocumentAsMarkdown(todos: TodoItem[], dailyNote: string, options?: TodoMarkdownOptions) {
  const todoMarkdown = formatTodosAsMarkdown(todos, options);
  const dailyMarkdown = dailyNote.trimEnd();

  if (todoMarkdown && dailyMarkdown) {
    return `${todoMarkdown}\n\n${dailyMarkdown}`;
  }

  return todoMarkdown || dailyMarkdown;
}
