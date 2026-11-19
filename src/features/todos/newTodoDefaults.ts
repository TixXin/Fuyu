import type { TodoDefaultPriority } from "./todoPrefs.ts";
import type { TodoPriority, TodoProject } from "./types.ts";

const INBOX = "";

export function defaultProjectName(projectId: string, projects: readonly TodoProject[]): string | undefined {
  if (!projectId) return undefined;
  return projects.find((project) => project.id === projectId)?.name;
}

export function newTodoPriority(written: TodoPriority | undefined, fallback: TodoDefaultPriority): TodoPriority | undefined {
  return written ?? (fallback === "none" ? undefined : fallback);
}

export function composerTarget({ picked, filter, defaultProject, projects }: {
  picked: string | null;
  filter: string | null;
  defaultProject?: string;
  projects: readonly string[];
}): string {
  const wanted = picked ?? filter ?? defaultProject ?? INBOX;
  return wanted === INBOX || projects.includes(wanted) ? wanted : INBOX;
}

export function hasNoteContent(note: string, template: string): boolean {
  const text = note.trim();
  return text !== "" && text !== template.trim();
}
