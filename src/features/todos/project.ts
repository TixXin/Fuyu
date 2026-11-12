import type { TodoItem } from "./types";

/** Longest project name kept; longer ones are cut. */
const MAX_PROJECT_LENGTH = 20;

/** A todo's project as stored: a trimmed, non-empty name, else none. */
export function readProject(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = [...value.trim()].slice(0, MAX_PROJECT_LENGTH).join("");
  return name || undefined;
}

/**
 * "#论文 写引言" adds "写引言" to the project "论文" (issue #44). A number after # is not a project,
 * so "#40 修好" keeps its title.
 */
export function splitProjectPrefix(text: string): { title: string; project?: string } {
  const match = /^#([^\s#]+)\s+(\S.*)$/su.exec(text.trim());
  if (!match || /^\d+$/u.test(match[1])) return { title: text.trim() };
  return { title: match[2].trim(), project: readProject(match[1]) };
}

/** The projects in `todos`, in the order they first appear. */
export function projectsOf(todos: readonly Pick<TodoItem, "project">[]): string[] {
  return [...new Set(todos.flatMap((todo) => (todo.project ? [todo.project] : [])))];
}

/** `todos` by project, in the order the projects first appear; those without one last (`project` null). */
export function groupByProject<T extends Pick<TodoItem, "project">>(todos: readonly T[]): { project: string | null; todos: T[] }[] {
  const groups = projectsOf(todos).map((project) => ({ project: project as string | null, todos: todos.filter((todo) => todo.project === project) }));
  const rest = todos.filter((todo) => !todo.project);
  return rest.length > 0 ? [...groups, { project: null, todos: rest }] : groups;
}
