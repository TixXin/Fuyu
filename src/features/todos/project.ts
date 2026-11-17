import type { TodoItem } from "./types";

export { MAX_TODO_PROJECTS, normalizeTodoProjects, readProject, splitProjectPrefix } from "../../lib/todo-projects/prefix.ts";

export function projectsOf(todos: readonly Pick<TodoItem, "project">[]): string[] {
  return [...new Set(todos.flatMap((todo) => (todo.project ? [todo.project] : [])))];
}

export function groupByProject<T extends Pick<TodoItem, "project">>(todos: readonly T[], order: readonly string[] = []): { project: string | null; todos: T[] }[] {
  const present = new Set(projectsOf(todos));
  const groups = [...new Set([...order.filter((name) => present.has(name)), ...present])].map((project) => ({ project: project as string | null, todos: todos.filter((todo) => todo.project === project) }));
  const rest = todos.filter((todo) => !todo.project);
  return rest.length > 0 ? [...groups, { project: null, todos: rest }] : groups;
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
