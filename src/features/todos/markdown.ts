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
  return JSON.stringify({
    date,
    todos: todos.map((todo) => ({
      title: todo.title,
      completed: todo.completed,
      project: todo.project,
      ...(includePriority && todo.priority ? { priority: todo.priority } : {}),
    })),
    dailyNote,
  });
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
      const suffix = elapsed ? ` (${elapsed})` : "";
      return `- [${todo.completed ? "x" : " "}] ${project}${priority}${todo.title}${suffix}`;
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
