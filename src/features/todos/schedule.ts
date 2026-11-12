import { getLocalDateString } from "../../utils/date.ts";
import { readProject } from "./project.ts";
import type { ScheduledTodo, TodoItem } from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && getLocalDateString(date) === value;
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return getLocalDateString(next);
}

export function sortScheduledTodos(todos: ScheduledTodo[]) {
  return [...todos].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export function splitDueTodos(todos: ScheduledTodo[], date: string) {
  const sorted = sortScheduledTodos(todos);
  return {
    due: sorted.filter((todo) => todo.date <= date),
    later: sorted.filter((todo) => todo.date > date),
  };
}

export function toTodoItems(todos: ScheduledTodo[]): TodoItem[] {
  return todos.map(({ id, title, createdAt, project }) => ({ id, title, completed: false, createdAt, ...(project ? { project } : {}) }));
}

export function normalizeScheduledTodo(value: Partial<ScheduledTodo>): ScheduledTodo | null {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title || !isDateString(value.date) || typeof value.id !== "string" || !value.id) return null;
  return {
    id: value.id,
    title,
    date: value.date,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : 0,
    ...(readProject(value.project) ? { project: readProject(value.project) } : {}),
  };
}
