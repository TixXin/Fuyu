import type { TodoItem, TodoProject } from "./types";

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

export function groupByProject<T extends Pick<TodoItem, "project">>(todos: readonly T[], order: readonly string[] = []): { project: string | null; todos: T[] }[] {
  const present = new Set(projectsOf(todos));
  const groups = [...new Set([...order.filter((name) => present.has(name)), ...present])].map((project) => ({ project: project as string | null, todos: todos.filter((todo) => todo.project === project) }));
  const rest = todos.filter((todo) => !todo.project);
  return rest.length > 0 ? [...groups, { project: null, todos: rest }] : groups;
}

export const MAX_TODO_PROJECTS = 50;

export function normalizeTodoProjects(value: unknown): TodoProject[] {
  if (!Array.isArray(value)) return [];
  const projects: TodoProject[] = [];
  for (const item of value) {
    const id = typeof item?.id === "string" ? item.id : "";
    const name = readProject(item?.name);
    if (!id || !name || projects.some((project) => project.id === id || project.name === name)) continue;
    projects.push({ id, name });
  }
  return projects.slice(0, MAX_TODO_PROJECTS);
}

export function projectChanges(before: readonly TodoProject[], after: readonly TodoProject[]) {
  const renamed = new Map<string, string>();
  const removed = new Set<string>();
  for (const project of before) {
    const now = after.find((item) => item.id === project.id);
    if (!now) removed.add(project.name);
    else if (now.name !== project.name) renamed.set(project.name, now.name);
  }
  return { renamed, removed };
}

export function mapProjects<T extends { project?: string }>(items: T[], to: (name: string) => string | undefined): T[] {
  let changed = false;
  const next = items.map((item) => {
    if (!item.project) return item;
    const project = to(item.project);
    if (project === item.project) return item;
    changed = true;
    const { project: _old, ...rest } = item;
    return (project ? { ...rest, project } : rest) as T;
  });
  return changed ? next : items;
}
