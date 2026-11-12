import type { TodoItem } from "./types";

const MAX_PROJECT_LENGTH = 20;

export function readProject(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = [...value.trim()].slice(0, MAX_PROJECT_LENGTH).join("");
  return name || undefined;
}

export function splitProjectPrefix(text: string): { title: string; project?: string } {
  const match = /^#([^\s#]+)\s+(\S.*)$/su.exec(text.trim());
  if (!match || /^\d+$/u.test(match[1])) return { title: text.trim() };
  return { title: match[2].trim(), project: readProject(match[1]) };
}

export function projectsOf(todos: readonly Pick<TodoItem, "project">[]): string[] {
  return [...new Set(todos.flatMap((todo) => (todo.project ? [todo.project] : [])))];
}

export function groupByProject<T extends Pick<TodoItem, "project">>(todos: readonly T[]): { project: string | null; todos: T[] }[] {
  const groups = projectsOf(todos).map((project) => ({ project: project as string | null, todos: todos.filter((todo) => todo.project === project) }));
  const rest = todos.filter((todo) => !todo.project);
  return rest.length > 0 ? [...groups, { project: null, todos: rest }] : groups;
}
