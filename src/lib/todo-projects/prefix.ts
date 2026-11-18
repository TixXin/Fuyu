export type TodoProject = { id: string; name: string };

const MAX_PROJECT_LENGTH = 20;
export const MAX_TODO_PROJECTS = 50;

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
