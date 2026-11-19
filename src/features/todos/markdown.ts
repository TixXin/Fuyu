import { todoElapsedLabel, type TodoPrefs } from "./todoPrefs.ts";
import type { TodoItem, TodoPriority } from "./types.ts";

export type TodoMarkdownOptions = {
  markdownPriority?: boolean;
  markdownElapsed?: boolean;
  markdownProject?: boolean;
  markdownSubtasks?: boolean;
  markdownNote?: boolean;
  now?: number;
};

export function todoMarkdownOptions(prefs: Pick<TodoPrefs, "markdownPriority" | "markdownElapsed" | "markdownProject" | "markdownSubtasks" | "markdownNote">): TodoMarkdownOptions {
  return {
    markdownPriority: prefs.markdownPriority,
    markdownElapsed: prefs.markdownElapsed,
    markdownProject: prefs.markdownProject,
    markdownSubtasks: prefs.markdownSubtasks,
    markdownNote: prefs.markdownNote,
  };
}

const PRIORITY_MARKS: Readonly<Record<TodoPriority, string>> = {
  high: "[!高]",
  medium: "[!中]",
  low: "[!低]",
};

export function getTodoSignature(date: string, todos: TodoItem[], dailyNote: string, options?: TodoMarkdownOptions) {
  const includePriority = Boolean(options?.markdownPriority);
  const includeElapsed = Boolean(options?.markdownElapsed);
  const includeProject = options?.markdownProject !== false;
  const includeSubtasks = options?.markdownSubtasks !== false;
  const includeNote = options?.markdownNote !== false;
  return JSON.stringify({
    date,
    todos: todos.map((todo) => ({
      title: todo.title,
      completed: todo.completed,
      ...(includeProject ? { project: todo.project } : {}),
      ...(includeNote && todo.note ? { note: todo.note } : {}),
      ...(includeSubtasks && todo.subtasks?.length
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
  const includeProject = options?.markdownProject !== false;
  const includeSubtasks = options?.markdownSubtasks !== false;
  const includeNote = options?.markdownNote !== false;
  const now = options?.now ?? Date.now();
  return todos
    .map((todo) => {
      const project = includeProject && todo.project ? `[${todo.project}] ` : "";
      const priority = includePriority && todo.priority ? `${PRIORITY_MARKS[todo.priority]} ` : "";
      const elapsed = includeElapsed ? todoElapsedLabel(todo.startedAt, now, true) : null;
      const focus = includeElapsed ? formatFocusBadge(todo.focusMinutes) : null;
      const timeParts = [focus, elapsed].filter((part): part is string => Boolean(part));
      const suffix = timeParts.length > 0 ? ` (${timeParts.join(" · ")})` : "";
      const lines = [`- [${todo.completed ? "x" : " "}] ${project}${priority}${todo.title}${suffix}`];
      if (includeNote && todo.note) {
        lines.push(`  > ${todo.note}`);
      }
      if (includeSubtasks && todo.subtasks && todo.subtasks.length > 0) {
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
